import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <p className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Fora do Programa. All rights reserved.
        </p>
        <Link
          href="/newsletter"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Newsletter
        </Link>
      </div>
    </footer>
  );
}
