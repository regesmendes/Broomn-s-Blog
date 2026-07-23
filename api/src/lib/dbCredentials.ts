import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

let cachedDatabaseUrl: string | undefined

/**
 * Resolves the Postgres connection string. In local dev/tests, DATABASE_URL
 * is already set via .env and is returned as-is. In Lambda, it's built from
 * a live Secrets Manager fetch (DB_SECRET_ARN) plus the stable
 * DB_HOST/DB_PORT/DB_NAME env vars — deliberately not baked in at CDK deploy
 * time, so a scheduled credential rotation (see database-stack.ts's
 * addRotationSingleUser) doesn't leave the Lambda holding a stale password
 * until the next redeploy. Cached per warm container; a 90-day rotation
 * cadence makes a cold-start-only refresh sufficient.
 */
export async function getDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (cachedDatabaseUrl) return cachedDatabaseUrl

  const { DB_SECRET_ARN, DB_HOST, DB_PORT, DB_NAME } = process.env
  if (!DB_SECRET_ARN || !DB_HOST || !DB_PORT || !DB_NAME) {
    throw new Error(
      'Missing DB_SECRET_ARN/DB_HOST/DB_PORT/DB_NAME env vars needed to fetch DB credentials'
    )
  }

  const client = new SecretsManagerClient({})
  const result = await client.send(new GetSecretValueCommand({ SecretId: DB_SECRET_ARN }))
  const { username, password } = JSON.parse(result.SecretString!) as {
    username: string
    password: string
  }

  cachedDatabaseUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  return cachedDatabaseUrl
}
