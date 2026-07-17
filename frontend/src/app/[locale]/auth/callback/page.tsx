'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CallbackContent() {
  const searchParams = useSearchParams();
  const code = searchParams?.get('code');
  const error = searchParams?.get('error');

  if (error) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-600">Authentication Error</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Invalid Callback</h1>
        <p className="text-gray-600">No authorization code received.</p>
      </div>
    );
  }

  // TODO: Exchange code for tokens via Cognito token endpoint
  // Call api.loginWithGoogle(code) and store tokens

  return (
    <div className="text-center">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Signing you in...</h1>
      <p className="text-gray-600">Please wait while we complete authentication.</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20">
      <Suspense
        fallback={
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-gray-900">Loading...</h1>
            <p className="text-gray-600">Processing authentication...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
