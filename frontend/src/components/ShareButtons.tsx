'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShareablePost,
  buildTwitterShareUrl,
  buildFacebookShareUrl,
  buildLinkedInShareUrl,
  buildWhatsAppShareUrl,
} from '@/lib/shareLinks';

type ShareButtonsProps = ShareablePost;

function openShareWindow(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function XIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.02 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.878h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.92 8.437-9.94z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.94v5.666H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 110-4.124 2.062 2.062 0 010 4.124zM7.114 20.452H3.56V9h3.554v11.452z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2c-5.523 0-10 4.477-10 10 0 1.766.46 3.49 1.334 5.007L2 22l5.13-1.345A9.96 9.96 0 0012.04 22c5.523 0 10-4.477 10-10s-4.477-10-10-10zm0 18.2a8.17 8.17 0 01-4.166-1.14l-.299-.177-3.043.798.812-2.966-.194-.305A8.13 8.13 0 013.85 12c0-4.522 3.669-8.19 8.19-8.19 4.523 0 8.19 3.668 8.19 8.19 0 4.522-3.667 8.2-8.19 8.2zm4.494-6.14c-.246-.123-1.456-.719-1.682-.801-.226-.082-.39-.123-.554.123-.164.246-.636.8-.78.965-.144.164-.287.184-.533.061-.246-.123-1.04-.383-1.98-1.221-.732-.653-1.227-1.46-1.371-1.706-.144-.246-.016-.379.108-.501.11-.11.246-.287.369-.43.123-.144.164-.246.246-.41.082-.164.041-.308-.02-.43-.062-.123-.554-1.334-.759-1.827-.2-.48-.403-.415-.554-.423-.144-.007-.308-.009-.472-.009a.906.906 0 00-.656.308c-.226.246-.862.842-.862 2.054 0 1.212.883 2.383 1.006 2.547.123.164 1.738 2.654 4.211 3.723.588.254 1.047.406 1.404.52.59.188 1.126.161 1.55.098.473-.07 1.456-.595 1.661-1.17.205-.574.205-1.066.144-1.17-.062-.103-.226-.164-.472-.287z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.332.014 7.052.072 2.695.272.273 2.69.073 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.69.072 4.949.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.668-.072-4.948C23.728 2.7 21.306.273 16.951.073 15.67.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
    </svg>
  );
}

export function ShareButtons({ url, title, excerpt }: ShareButtonsProps) {
  const t = useTranslations('share');
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const post: ShareablePost = { url, title, excerpt };

  const showCopiedMessage = (message: string) => {
    setCopiedMessage(message);
    setTimeout(() => setCopiedMessage(null), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(url);
    showCopiedMessage(t('copied'));
  };

  const handleInstagram = async () => {
    await navigator.clipboard.writeText(url);
    showCopiedMessage(t('instagramCopied'));
  };

  const buttonClassName =
    'text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-sm text-gray-500 dark:text-gray-400">{t('label')}</span>

      <button
        type="button"
        onClick={() => openShareWindow(buildTwitterShareUrl(post))}
        className={buttonClassName}
        aria-label={t('x')}
        title={t('x')}
      >
        <XIcon />
      </button>

      <button
        type="button"
        onClick={() => openShareWindow(buildFacebookShareUrl(post))}
        className={buttonClassName}
        aria-label={t('facebook')}
        title={t('facebook')}
      >
        <FacebookIcon />
      </button>

      <button
        type="button"
        onClick={() => openShareWindow(buildLinkedInShareUrl(post))}
        className={buttonClassName}
        aria-label={t('linkedin')}
        title={t('linkedin')}
      >
        <LinkedInIcon />
      </button>

      <button
        type="button"
        onClick={() => openShareWindow(buildWhatsAppShareUrl(post))}
        className={buttonClassName}
        aria-label={t('whatsapp')}
        title={t('whatsapp')}
      >
        <WhatsAppIcon />
      </button>

      <button
        type="button"
        onClick={handleInstagram}
        className={buttonClassName}
        aria-label={t('instagram')}
        title={t('instagram')}
      >
        <InstagramIcon />
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className={buttonClassName}
        aria-label={t('copyLink')}
        title={t('copyLink')}
      >
        <LinkIcon />
      </button>

      {copiedMessage && (
        <span className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {copiedMessage}
        </span>
      )}
    </div>
  );
}
