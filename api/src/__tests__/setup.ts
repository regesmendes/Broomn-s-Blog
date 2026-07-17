import { vi, beforeEach } from 'vitest'

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
      findMany: vi.fn(),
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
