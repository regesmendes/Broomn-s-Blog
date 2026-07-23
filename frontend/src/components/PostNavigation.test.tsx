import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PostNavigation } from './PostNavigation';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const previous = { slug: 'newer-post', title: 'Newer Post' };
const next = { slug: 'older-post', title: 'Older Post' };

afterEach(() => {
  cleanup();
});

describe('PostNavigation', () => {
  it('renders both links when both neighbors exist', () => {
    render(<PostNavigation previous={previous} next={next} />);

    const previousLink = screen.getByRole('link', { name: /newer post/i });
    expect(previousLink).toHaveAttribute('href', '/posts/newer-post');

    const nextLink = screen.getByRole('link', { name: /older post/i });
    expect(nextLink).toHaveAttribute('href', '/posts/older-post');
  });

  it('renders only the previous link when there is no next post', () => {
    render(<PostNavigation previous={previous} next={null} />);

    expect(screen.getByRole('link', { name: /newer post/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /older post/i })).not.toBeInTheDocument();
  });

  it('renders only the next link when there is no previous post', () => {
    render(<PostNavigation previous={null} next={next} />);

    expect(screen.queryByRole('link', { name: /newer post/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /older post/i })).toBeInTheDocument();
  });

  it('renders nothing when there are no neighbors', () => {
    const { container } = render(<PostNavigation previous={null} next={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
