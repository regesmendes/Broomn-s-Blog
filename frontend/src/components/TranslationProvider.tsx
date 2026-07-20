'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTranslatedContent } from '@/lib/useTranslatedContent';

interface TranslationContextValue {
  displayContent: string;
  isTranslated: boolean;
  translating: boolean;
  error: string;
  toggle: () => void;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

/**
 * Shares translation state between TranslateControls (rendered next to the
 * title) and PostContent (rendered lower down) without requiring either the
 * page — a Server Component that fetches data directly — or the translate
 * button to live in the same DOM position. Both consume this context
 * instead of one passing props down to the other.
 */
export function TranslationProvider({ content, children }: { content: string; children: ReactNode }) {
  const value = useTranslatedContent(content);
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslationContext() {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error('useTranslationContext must be used within a TranslationProvider');
  }
  return ctx;
}
