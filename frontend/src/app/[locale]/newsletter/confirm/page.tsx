import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations('newsletter');
  const { token } = await searchParams;

  let success = false;

  if (token) {
    try {
      await api.confirmSubscription(token);
      success = true;
    } catch {
      success = false;
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">{t('title')}</h1>

      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <p className="text-green-800">{t('confirmSuccess')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-800">{t('confirmError')}</p>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block text-blue-700 hover:underline">
        {t('backHome')}
      </Link>
    </div>
  );
}
