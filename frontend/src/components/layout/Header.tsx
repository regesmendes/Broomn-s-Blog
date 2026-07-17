'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { ThemeToggle } from '@/lib/theme-context';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const t = useTranslations('header');

  return (
    <header className="border-b border-emerald-200/50 bg-white/95 backdrop-blur-sm dark:border-emerald-900/50 dark:bg-gray-800/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" className="h-9 w-auto" />
          <span className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
            {t('blogName')}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-emerald-800 hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-400">
            {t('home')}
          </Link>
          <Link href="/newsletter" className="text-emerald-800 hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-400">
            {t('newsletter')}
          </Link>
          {isAdmin && (
            <Link href="/admin/posts" className="text-emerald-800 hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-400">
              {t('admin')}
            </Link>
          )}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-gray-400">{user?.name}</span>
              <button
                onClick={logout}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <ThemeToggle />
              <Link
                href="/auth/login"
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {t('signIn')}
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="border-t border-emerald-200/50 px-4 py-4 dark:border-emerald-900/50 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-emerald-800 dark:text-emerald-200" onClick={() => setMenuOpen(false)}>{t('home')}</Link>
            <Link href="/newsletter" className="text-emerald-800 dark:text-emerald-200" onClick={() => setMenuOpen(false)}>{t('newsletter')}</Link>
            {isAdmin && (
              <Link href="/admin/posts" className="text-emerald-800 dark:text-emerald-200" onClick={() => setMenuOpen(false)}>{t('admin')}</Link>
            )}
            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
            {isAuthenticated ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="text-left text-emerald-800 dark:text-emerald-200">
                {t('logout')} ({user?.name})
              </button>
            ) : (
              <Link href="/auth/login" className="text-emerald-800 dark:text-emerald-200" onClick={() => setMenuOpen(false)}>{t('signIn')}</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
