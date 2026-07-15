// JWT payload type — attached to request after authentication
export interface JwtPayload {
  sub: string       // user id
  email: string
  role: 'admin' | 'user'
  iat?: number
  exp?: number
}

// Extend Fastify's type definitions to include our JWT payload
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}
