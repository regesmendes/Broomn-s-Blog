import jwksRsa from 'jwks-rsa'
import jwt from 'jsonwebtoken'
import { FastifyInstance } from 'fastify'
import { userRepository } from '../repositories/user.repository'
import { JwtPayload } from '../types'

// ─── Cognito token claims shape ────────────────────────────────────────────────

interface CognitoIdTokenClaims {
  sub:             string   // Cognito user ID
  email:           string
  name:            string
  picture?:        string
  'cognito:username': string
  aud:             string   // must match our Cognito client ID
  iss:             string   // must match our Cognito user pool URL
  exp:             number
  iat:             number
}

// ─── JWKS client (cached, lazy-initialised) ────────────────────────────────────

let jwksClient: jwksRsa.JwksClient | null = null

function getJwksClient(): jwksRsa.JwksClient {
  if (jwksClient) return jwksClient

  const region   = process.env.AWS_REGION!
  const poolId   = process.env.COGNITO_USER_POOL_ID!

  jwksClient = jwksRsa({
    jwksUri: `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`,
    cache:       true,
    cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  })

  return jwksClient
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Verify a Cognito ID token, upsert the user in our DB,
   * and issue our own access + refresh JWTs.
   */
  async loginWithGoogle(idToken: string, app: FastifyInstance) {
    const claims = await verifyCognitoToken(idToken)

    const user = await userRepository.upsertByCognitoId(claims.sub, {
      email:     claims.email,
      name:      claims.name,
      avatarUrl: claims.picture,
      googleId:  claims.sub,
      cognitoId: claims.sub,
    })

    const payload: JwtPayload = {
      sub:   user.id,
      email: user.email,
      role:  user.role === 'ADMIN' ? 'admin' : 'user',
    }

    const accessToken  = app.jwt.sign(payload, { expiresIn: '15m' })
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh' } as unknown as JwtPayload,
      { expiresIn: '7d' }
    )

    return { user, accessToken, refreshToken }
  },

  /**
   * Verify a refresh token and issue a new access token.
   */
  async refresh(refreshToken: string, app: FastifyInstance) {
    let decoded: { sub: string }

    try {
      decoded = app.jwt.verify<{ sub: string }>(refreshToken)
    } catch {
      return null
    }

    const user = await userRepository.findById(decoded.sub)
    if (!user) return null

    const payload: JwtPayload = {
      sub:   user.id,
      email: user.email,
      role:  user.role === 'ADMIN' ? 'admin' : 'user',
    }

    const accessToken = app.jwt.sign(payload, { expiresIn: '15m' })

    return { user, accessToken }
  },

  /**
   * Return the current user from a verified JWT payload.
   */
  async me(userId: string) {
    return userRepository.findById(userId)
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function verifyCognitoToken(idToken: string): Promise<CognitoIdTokenClaims> {
  const region   = process.env.AWS_REGION
  const poolId   = process.env.COGNITO_USER_POOL_ID
  const clientId = process.env.COGNITO_CLIENT_ID

  if (!region || !poolId || !clientId) {
    throw new Error('Cognito environment variables are not configured')
  }

  // Decode header to get the key ID (kid)
  const decoded = jwt.decode(idToken, { complete: true })
  if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
    throw new Error('Invalid token format')
  }

  // Fetch the matching public key from Cognito's JWKS endpoint
  const key = await getJwksClient().getSigningKey(decoded.header.kid)
  const publicKey = key.getPublicKey()

  // Verify signature, expiry, issuer and audience
  const claims = jwt.verify(idToken, publicKey, {
    issuer:   `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
    audience: clientId,
  }) as CognitoIdTokenClaims

  return claims
}
