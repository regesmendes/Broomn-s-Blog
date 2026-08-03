import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// setup.ts mocks lib/s3 globally — undo that for this file so we can test
// the real implementation, and mock the AWS SDK client it wraps instead.
vi.unmock('../lib/s3')

const sendMock = vi.fn().mockResolvedValue({})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

describe('lib/s3 uploadObject', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    sendMock.mockClear()
    process.env.S3_BUCKET_NAME = 'broomns-blog-media-123'
    process.env.AWS_REGION = 'us-east-1'
    delete process.env.MEDIA_CDN_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('sets a long-lived immutable Cache-Control header on upload', async () => {
    const { uploadObject } = await import('../lib/s3')

    await uploadObject('abc123.webp', Buffer.from('data'), 'image/webp')

    expect(sendMock).toHaveBeenCalledTimes(1)
    const command = sendMock.mock.calls[0][0]
    expect(command.input.CacheControl).toBe('public, max-age=31536000, immutable')
  })

  it('falls back to the direct S3 URL when MEDIA_CDN_URL is unset', async () => {
    const { uploadObject } = await import('../lib/s3')

    const url = await uploadObject('abc123.webp', Buffer.from('data'), 'image/webp')

    expect(url).toBe('https://broomns-blog-media-123.s3.us-east-1.amazonaws.com/abc123.webp')
  })

  it('returns a CDN URL when MEDIA_CDN_URL is set', async () => {
    process.env.MEDIA_CDN_URL = 'https://media.blogdobroomn.com'
    const { uploadObject } = await import('../lib/s3')

    const url = await uploadObject('abc123.webp', Buffer.from('data'), 'image/webp')

    expect(url).toBe('https://media.blogdobroomn.com/abc123.webp')
  })
})
