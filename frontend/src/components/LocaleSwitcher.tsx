'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

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
      className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"
      title={locale === 'pt' ? 'Switch to English' : 'Mudar para Português'}
    >
      {locale === 'pt' ? '🇬🇧 EN' : '🇧🇷 PT'}
    </button>
  );
}
