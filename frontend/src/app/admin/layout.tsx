import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-140px)]">
      <aside className="w-64 border-r border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-lg font-bold text-gray-900">Admin</h2>
        <nav className="flex flex-col gap-2">
          <Link
            href="/admin/posts"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Posts
          </Link>
          <Link
            href="/admin/comments"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Comments
          </Link>
          <Link
            href="/admin/newsletter"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Newsletter
          </Link>
        </nav>
      </aside>
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
