'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { PageViewTracker } from '@/components/PageViewTracker';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PageViewTracker />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
