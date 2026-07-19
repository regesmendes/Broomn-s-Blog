import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <h1 className="mb-4 text-6xl font-bold text-gray-900">404</h1>
      <p className="mb-8 text-lg text-gray-600">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="rounded-md bg-gray-900 px-6 py-3 text-white hover:bg-gray-700"
      >
        Go home
      </Link>
    </div>
  );
}
