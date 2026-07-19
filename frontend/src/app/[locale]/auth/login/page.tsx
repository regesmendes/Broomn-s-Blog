'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const isDev = process.env.NODE_ENV === 'development';

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  if (isAuthenticated) {
    router.push('/admin/posts');
    return null;
  }

  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;

  const googleAuthUrl = cognitoDomain
    ? `${cognitoDomain}/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || '')}&identity_provider=Google&scope=openid+email+profile`
    : null;

  async function handleDevLogin(email: string) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || t('loginFailed'));
      }

      const { accessToken, refreshToken, user } = await res.json();
      login(accessToken, refreshToken, user);
      router.push('/admin/posts');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">{t('title')}</h1>
      <p className="mb-8 text-center text-gray-600">{t('description')}</p>

      {/* Google OAuth (production) */}
      {googleAuthUrl ? (
        <a
          href={googleAuthUrl}
          className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-6 py-3 text-gray-700 shadow-sm transition hover:shadow-md"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t('googleButton')}
        </a>
      ) : (
        <div className="w-full rounded-md bg-yellow-50 p-4 text-center text-sm text-yellow-800">
          {t('cognitoNotConfigured')}
        </div>
      )}

      {/* Dev Login (development only) */}
      {isDev && (
        <div className="mt-8 w-full border-t border-gray-200 pt-8">
          <p className="mb-4 text-center text-sm font-medium text-gray-500">{t('devLogin')}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleDevLogin('admin@broomns-blog.local')}
              disabled={loading}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? t('signingIn') : t('loginAsAdmin')}
            </button>
            <button
              onClick={() => handleDevLogin('user@broomns-blog.local')}
              disabled={loading}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? t('signingIn') : t('loginAsUser')}
            </button>
          </div>
          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
