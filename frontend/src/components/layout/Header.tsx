'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ThemeToggle } from '@/lib/theme-context';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
          Broomn&apos;s Blog
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            Home
          </Link>
          <Link href="/newsletter" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            Newsletter
          </Link>
          {isAdmin && (
            <Link href="/admin/posts" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
              Admin
            </Link>
          )}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-gray-400">{user?.name}</span>
              <button
                onClick={logout}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/auth/login"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
              >
                Sign in
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
        <nav className="border-t border-gray-200 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-gray-600" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link href="/newsletter" className="text-gray-600" onClick={() => setMenuOpen(false)}>Newsletter</Link>
            {isAdmin && (
              <Link href="/admin/posts" className="text-gray-600" onClick={() => setMenuOpen(false)}>Admin</Link>
            )}
            {isAuthenticated ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="text-left text-gray-600">
                Logout ({user?.name})
              </button>
            ) : (
              <Link href="/auth/login" className="text-gray-600" onClick={() => setMenuOpen(false)}>Sign in</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
