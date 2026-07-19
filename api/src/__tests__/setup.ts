import { vi, beforeEach } from 'vitest'

// Mock SES globally for all tests — no real email sending in the test suite
vi.mock('../lib/ses', () => ({
  sendEmail: vi.fn(),
}))

// Mock S3 globally for all tests — no real uploads/deletes in the test suite
vi.mock('../lib/s3', () => ({
  uploadObject: vi.fn(),
  deleteObject: vi.fn(),
}))

// Mock Prisma globally for all tests
vi.mock('../lib/prisma', () => ({
  prisma: {
    post: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    comment: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    newsletter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    tag: {
      upsert: vi.fn(),
    },
    media: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    mediaOnPosts: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})
