import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-emerald-200/50 bg-white dark:border-emerald-900/50 dark:bg-gray-800">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Broomn&apos;s Blog. All rights reserved.
        </p>
        <Link
          href="/newsletter"
          className="text-sm text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Newsletter
        </Link>
      </div>
    </footer>
  );
}
