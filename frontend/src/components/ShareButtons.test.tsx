import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareButtons } from './ShareButtons';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const post = {
  url: 'https://blogdobroomn.com/pt/posts/a-story',
  title: 'A Story',
  excerpt: 'An excerpt',
};

// `userEvent.setup()` installs its own `navigator.clipboard` stub as a
// getter-only accessor (see @testing-library/user-event's Clipboard.js), so
// a plain `Object.assign(navigator, { clipboard: ... })` throws ("has only
// a getter"). Redefining the property outright (configurable, so it can be
// redefined again) works regardless of the existing descriptor — but it
// must run AFTER `userEvent.setup()`, otherwise `setup()` runs next and
// silently replaces our stub with its own, and our mock is never called.
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShareButtons', () => {
  it('opens a Twitter/X intent URL in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(<ShareButtons {...post} />);
    await user.click(screen.getByRole('button', { name: 'x' }));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/intent/tweet'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('opens a WhatsApp share URL in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(<ShareButtons {...post} />);
    await user.click(screen.getByRole('button', { name: 'whatsapp' }));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://api.whatsapp.com/send'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('copies the link and shows the generic copied message', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    stubClipboard(writeText);

    render(<ShareButtons {...post} />);
    await user.click(screen.getByRole('button', { name: 'copyLink' }));

    expect(writeText).toHaveBeenCalledWith(post.url);
    expect(await screen.findByRole('status')).toHaveTextContent('copied');
  });

  it('copies the link and shows the Instagram-specific hint', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    stubClipboard(writeText);

    render(<ShareButtons {...post} />);
    await user.click(screen.getByRole('button', { name: 'instagram' }));

    expect(writeText).toHaveBeenCalledWith(post.url);
    expect(await screen.findByRole('status')).toHaveTextContent('instagramCopied');
  });
});
