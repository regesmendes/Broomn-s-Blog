'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

function BrazilFlag() {
  return (
    <svg className="h-4 w-6 rounded-sm" viewBox="0 0 640 480">
      <rect width="640" height="480" fill="#009c3b" />
      <polygon points="320,40 600,240 320,440 40,240" fill="#ffdf00" />
      <circle cx="320" cy="240" r="90" fill="#002776" />
      <path d="M200,240 C240,200 400,200 440,240" fill="none" stroke="#fff" strokeWidth="12" />
    </svg>
  );
}

function UKFlag() {
  return (
    <svg className="h-4 w-6 rounded-sm" viewBox="0 0 640 480">
      <rect width="640" height="480" fill="#012169" />
      <path d="M0,0 L640,480 M640,0 L0,480" stroke="#fff" strokeWidth="60" />
      <path d="M0,0 L640,480 M640,0 L0,480" stroke="#C8102E" strokeWidth="40" />
      <path d="M320,0 V480 M0,240 H640" stroke="#fff" strokeWidth="100" />
      <path d="M320,0 V480 M0,240 H640" stroke="#C8102E" strokeWidth="60" />
    </svg>
  );
}

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const nextLocale = locale === 'pt' ? 'en' : 'pt';
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <button
      onClick={switchLocale}
      className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"
      title={locale === 'pt' ? 'Switch to English' : 'Mudar para Português'}
    >
      {locale === 'pt' ? (
        <>
          <UKFlag />
          <span>EN</span>
        </>
      ) : (
        <>
          <BrazilFlag />
          <span>PT</span>
        </>
      )}
    </button>
  );
}
