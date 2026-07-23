export interface ShareablePost {
  url: string;
  title: string;
  excerpt?: string;
}

export function buildTwitterShareUrl(post: ShareablePost): string {
  const params = new URLSearchParams({ url: post.url, text: post.title });
  return `https://twitter.com/intent/tweet?${params}`;
}

export function buildFacebookShareUrl(post: ShareablePost): string {
  const params = new URLSearchParams({ u: post.url });
  return `https://www.facebook.com/sharer/sharer.php?${params}`;
}

export function buildLinkedInShareUrl(post: ShareablePost): string {
  const params = new URLSearchParams({ url: post.url });
  return `https://www.linkedin.com/sharing/share-offsite/?${params}`;
}

export function buildWhatsAppShareUrl(post: ShareablePost): string {
  const params = new URLSearchParams({ text: `${post.title} ${post.url}` });
  return `https://api.whatsapp.com/send?${params}`;
}
