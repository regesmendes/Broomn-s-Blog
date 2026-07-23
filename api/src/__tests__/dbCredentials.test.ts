import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
  GetSecretValueCommand: vi.fn().mockImplementation((input) => input),
}))

describe('getDatabaseUrl', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    sendMock.mockReset()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.DATABASE_URL
    delete process.env.DB_SECRET_ARN
    delete process.env.DB_HOST
    delete process.env.DB_PORT
    delete process.env.DB_NAME
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns DATABASE_URL directly when already set, without calling Secrets Manager', async () => {
    process.env.DATABASE_URL = 'postgresql://local:local@localhost:5432/test'
    const { getDatabaseUrl } = await import('../lib/dbCredentials')

    const url = await getDatabaseUrl()

    expect(url).toBe('postgresql://local:local@localhost:5432/test')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('fetches credentials from Secrets Manager and builds the connection string', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:broomns-blog/database'
    process.env.DB_HOST = 'db.example.com'
    process.env.DB_PORT = '5432'
    process.env.DB_NAME = 'broomnsblog'
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'broomn_admin', password: 'p@ss' }),
    })

    const { getDatabaseUrl } = await import('../lib/dbCredentials')
    const url = await getDatabaseUrl()

    expect(url).toBe(
      `postgresql://broomn_admin:${encodeURIComponent('p@ss')}@db.example.com:5432/broomnsblog`
    )
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('caches the fetched URL so a second call does not hit Secrets Manager again', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret:broomns-blog/database'
    process.env.DB_HOST = 'db.example.com'
    process.env.DB_PORT = '5432'
    process.env.DB_NAME = 'broomnsblog'
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    })

    const { getDatabaseUrl } = await import('../lib/dbCredentials')
    await getDatabaseUrl()
    await getDatabaseUrl()

    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('throws a clear error when required env vars are missing', async () => {
    const { getDatabaseUrl } = await import('../lib/dbCredentials')

    await expect(getDatabaseUrl()).rejects.toThrow(/DB_SECRET_ARN/)
  })
})
