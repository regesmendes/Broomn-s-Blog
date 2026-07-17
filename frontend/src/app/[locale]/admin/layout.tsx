'use client';

import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requireAdmin>
      <div className="flex min-h-[calc(100vh-140px)]">
        <aside className="w-64 border-r border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Admin</h2>
          <nav className="flex flex-col gap-2">
            <Link
              href="/admin/posts"
              className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Posts
            </Link>
            <Link
              href="/admin/comments"
              className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Comments
            </Link>
            <Link
              href="/admin/newsletter"
              className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Newsletter
            </Link>
          </nav>
        </aside>
        <div className="flex-1 p-8">{children}</div>
      </div>
    </ProtectedRoute>
  );
}
