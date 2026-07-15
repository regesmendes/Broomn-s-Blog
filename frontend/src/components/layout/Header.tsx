'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Fora do Programa
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            Home
          </Link>
          <Link href="/newsletter" className="text-gray-600 hover:text-gray-900">
            Newsletter
          </Link>
          <Link
            href="/auth/login"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Sign in
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg
            className="h-6 w-6 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="border-t border-gray-200 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
            <Link href="/newsletter" className="text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
              Newsletter
            </Link>
            <Link href="/auth/login" className="text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
