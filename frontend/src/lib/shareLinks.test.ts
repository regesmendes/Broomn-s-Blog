import { describe, it, expect } from 'vitest';
import {
  buildTwitterShareUrl,
  buildFacebookShareUrl,
  buildLinkedInShareUrl,
  buildWhatsAppShareUrl,
} from './shareLinks';

const post = {
  url: 'https://blogdobroomn.com/pt/posts/a-story',
  title: 'A Story & Its Chapters',
};

describe('shareLinks', () => {
  it('builds a Twitter/X intent URL with the post url and title, encoded', () => {
    const shareUrl = buildTwitterShareUrl(post);
    const parsed = new URL(shareUrl);

    expect(parsed.origin + parsed.pathname).toBe('https://twitter.com/intent/tweet');
    expect(parsed.searchParams.get('url')).toBe(post.url);
    expect(parsed.searchParams.get('text')).toBe(post.title);
  });

  it('builds a Facebook sharer URL with the post url', () => {
    const shareUrl = buildFacebookShareUrl(post);
    const parsed = new URL(shareUrl);

    expect(parsed.origin + parsed.pathname).toBe('https://www.facebook.com/sharer/sharer.php');
    expect(parsed.searchParams.get('u')).toBe(post.url);
  });

  it('builds a LinkedIn share-offsite URL with the post url', () => {
    const shareUrl = buildLinkedInShareUrl(post);
    const parsed = new URL(shareUrl);

    expect(parsed.origin + parsed.pathname).toBe('https://www.linkedin.com/sharing/share-offsite/');
    expect(parsed.searchParams.get('url')).toBe(post.url);
  });

  it('builds a WhatsApp send URL with the title and url combined in the text param', () => {
    const shareUrl = buildWhatsAppShareUrl(post);
    const parsed = new URL(shareUrl);

    expect(parsed.origin + parsed.pathname).toBe('https://api.whatsapp.com/send');
    expect(parsed.searchParams.get('text')).toBe(`${post.title} ${post.url}`);
  });
});
