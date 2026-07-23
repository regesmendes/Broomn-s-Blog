import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import MediaLibraryPage from './page';
import api from '@/lib/api';
import type { MediaItem, MediaDetail } from '@/lib/api';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// getToken must be a stable reference across renders — this page's
// loadMedia is a useCallback that legitimately depends on it (unlike some
// other admin pages' effects, which have an intentionally incomplete dep
// array). A fresh arrow function per useAuth() call would make loadMedia's
// identity change every render, re-triggering its effect forever.
const mockGetToken = () => 'test-token';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getMedia: vi.fn(),
      getMediaById: vi.fn(),
    },
  };
});

const mockGetMedia = vi.mocked(api.getMedia);
const mockGetMediaById = vi.mocked(api.getMediaById);

const mediaItem: MediaItem = {
  id: 'm1',
  filename: 'abc123.png',
  originalName: 'photo.png',
  mimeType: 'image/png',
  size: 204_800,
  url: 'https://cdn.example.com/abc123.png',
  createdAt: '2026-01-01T00:00:00.000Z',
  usageCount: 0,
};

const mediaDetail: MediaDetail = {
  ...mediaItem,
  posts: [],
  usedInAboutPage: false,
  usedInSupportPage: false,
};

async function renderAndLoad() {
  render(<MediaLibraryPage />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MediaLibraryPage — resolution display', () => {
  it('shows the file size without a resolution until the thumbnail image loads', async () => {
    mockGetMedia.mockResolvedValue({ data: [mediaItem], meta: { hasMore: false, nextCursor: null } });

    await renderAndLoad();

    expect(screen.getByText('200.0 KB')).toBeInTheDocument();
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();

    const thumbnail = screen.getByAltText('photo.png') as HTMLImageElement;
    Object.defineProperty(thumbnail, 'naturalWidth', { value: 1920, configurable: true });
    Object.defineProperty(thumbnail, 'naturalHeight', { value: 1080, configurable: true });
    fireEvent.load(thumbnail);

    expect(screen.getByText('200.0 KB · 1920×1080')).toBeInTheDocument();
  });

  it('shows the resolution in the detail panel once its image loads', async () => {
    mockGetMedia.mockResolvedValue({ data: [mediaItem], meta: { hasMore: false, nextCursor: null } });
    mockGetMediaById.mockResolvedValue(mediaDetail);

    await renderAndLoad();

    fireEvent.click(screen.getByRole('button', { name: /photo\.png/i }));
    await act(async () => {
      await Promise.resolve();
    });

    const images = screen.getAllByAltText('photo.png');
    const detailImage = images[images.length - 1] as HTMLImageElement;
    Object.defineProperty(detailImage, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(detailImage, 'naturalHeight', { value: 600, configurable: true });
    fireEvent.load(detailImage);

    expect(screen.getByText('200.0 KB · image/png · 800×600')).toBeInTheDocument();
  });
});
