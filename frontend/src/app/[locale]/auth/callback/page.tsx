'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const COGNITO_REDIRECT_URI = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const code = searchParams?.get('code');
  const authError = searchParams?.get('error');

  useEffect(() => {
    if (authError) {
      setError(authError);
      return;
    }

    if (!code) {
      setError('No authorization code received.');
      return;
    }

    handleCallback(code);
  }, [code, authError]);

  async function handleCallback(authCode: string) {
    try {
      // Step 1: Exchange the authorization code for tokens via Cognito's token endpoint
      const tokenResponse = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: COGNITO_CLIENT_ID || '',
          code: authCode,
          redirect_uri: COGNITO_REDIRECT_URI || '',
        }),
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.json().catch(() => null);
        throw new Error(body?.error_description || 'Failed to exchange authorization code');
      }

      const tokens = await tokenResponse.json();
      const idToken = tokens.id_token;

      if (!idToken) {
        throw new Error('No ID token received from Cognito');
      }

      // Step 2: Send the ID token to our API to get our own JWT
      const apiResponse = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!apiResponse.ok) {
        const body = await apiResponse.json().catch(() => null);
        throw new Error(body?.error || 'Failed to authenticate with API');
      }

      const { user, accessToken, refreshToken } = await apiResponse.json();

      // Step 3: Store tokens and redirect
      login(accessToken, refreshToken, user);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-600 dark:text-red-400">Authentication Failed</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">{error}</p>
        <a
          href="/auth/login"
          className="text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Signing you in...</h1>
      <p className="text-gray-600 dark:text-gray-400">Please wait while we complete authentication.</p>
      <div className="mt-6 flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20">
      <Suspense
        fallback={
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Loading...</h1>
            <p className="text-gray-600 dark:text-gray-400">Processing authentication...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
