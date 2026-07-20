'use client';

import { useTranslationContext } from './TranslationProvider';

export function PostContent() {
  const { displayContent } = useTranslationContext();
  return <div className="prose" dangerouslySetInnerHTML={{ __html: displayContent }} />;
}
