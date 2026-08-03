import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// setup.ts mocks lib/cloudfront globally — undo that for this file so we can
// test the real implementation, and mock the AWS SDK client it wraps instead.
vi.unmock('../lib/cloudfront')

const sendMock = vi.fn().mockResolvedValue({})

vi.mock('@aws-sdk/client-cloudfront', () => ({
  CloudFrontClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
  CreateInvalidationCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

describe('lib/cloudfront invalidateMediaPath', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    sendMock.mockClear()
    delete process.env.MEDIA_DISTRIBUTION_ID
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('is a no-op when MEDIA_DISTRIBUTION_ID is unset (local dev)', async () => {
    const { invalidateMediaPath } = await import('../lib/cloudfront')

    await invalidateMediaPath('abc123.webp')

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('invalidates the exact deleted object path when configured', async () => {
    process.env.MEDIA_DISTRIBUTION_ID = 'DISTRIBUTION123'
    const { invalidateMediaPath } = await import('../lib/cloudfront')

    await invalidateMediaPath('abc123.webp')

    expect(sendMock).toHaveBeenCalledTimes(1)
    const command = sendMock.mock.calls[0][0]
    expect(command.input.DistributionId).toBe('DISTRIBUTION123')
    expect(command.input.InvalidationBatch.Paths.Items).toEqual(['/abc123.webp'])
    expect(command.input.InvalidationBatch.Paths.Quantity).toBe(1)
  })
})
