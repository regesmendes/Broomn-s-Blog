'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { RichTextEditor, RichTextEditorHandle } from './RichTextEditor';
import { translateHtml } from '@/lib/translate';

export interface ContentLocaleFieldsHandle {
  insertImage: (locale: 'pt' | 'en', url: string) => void;
}

interface ContentLocaleFieldsProps {
  pt: string;
  en: string;
  onChangePt: (content: string) => void;
  onChangeEn: (content: string) => void;
  onRequestImagePick: (locale: 'pt' | 'en') => void;
}

function isBlankHtml(value: string): boolean {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length === 0;
}

export const ContentLocaleFields = forwardRef<ContentLocaleFieldsHandle, ContentLocaleFieldsProps>(
  ({ pt, en, onChangePt, onChangeEn, onRequestImagePick }, ref) => {
    const [activeTab, setActiveTab] = useState<'pt' | 'en'>('pt');
    const [translating, setTranslating] = useState(false);
    const [translateError, setTranslateError] = useState<string | null>(null);
    const ptEditorRef = useRef<RichTextEditorHandle>(null);
    const enEditorRef = useRef<RichTextEditorHandle>(null);

    useImperativeHandle(ref, () => ({
      insertImage: (locale, url) => {
        (locale === 'pt' ? ptEditorRef : enEditorRef).current?.insertImage(url);
      },
    }));

    async function handleTranslate() {
      const source = activeTab === 'pt' ? pt : en;
      const target = activeTab === 'pt' ? en : pt;
      const langpair = activeTab === 'pt' ? 'pt|en' : 'en|pt';
      const targetLabel = activeTab === 'pt' ? 'English' : 'Portuguese';

      if (!isBlankHtml(target)) {
        const confirmed = window.confirm(
          `This will overwrite the existing ${targetLabel} content. Continue?`
        );
        if (!confirmed) return;
      }

      setTranslating(true);
      setTranslateError(null);

      try {
        const result = await translateHtml(source, langpair);
        const onChangeTarget = activeTab === 'pt' ? onChangeEn : onChangePt;
        onChangeTarget(result.html);

        if (result.partial) {
          setTranslateError('Part of the content could not be translated — please review before saving.');
        }
      } catch (err) {
        setTranslateError(err instanceof Error ? err.message : 'Translation failed.');
      } finally {
        setTranslating(false);
      }
    }

    return (
      <div>
        <div className="mb-3 flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('pt')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'pt'
                ? 'border-b-2 border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Português
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('en')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'en'
                ? 'border-b-2 border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            English
          </button>

          <button
            type="button"
            onClick={handleTranslate}
            disabled={translating}
            className="ml-auto mb-1 rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {translating ? 'Translating...' : `Translate to ${activeTab === 'pt' ? 'English' : 'Portuguese'}`}
          </button>
        </div>

        {translateError && (
          <p className="mb-3 text-xs text-red-600 dark:text-red-400">{translateError}</p>
        )}

        {/* Both editors stay mounted so switching tabs never loses editor
            state — only the inactive one is hidden. */}
        <div className={activeTab === 'pt' ? '' : 'hidden'}>
          <RichTextEditor
            ref={ptEditorRef}
            content={pt}
            onChange={onChangePt}
            placeholder="Write the content (Português)..."
            onImagePick={() => onRequestImagePick('pt')}
          />
        </div>
        <div className={activeTab === 'en' ? '' : 'hidden'}>
          <RichTextEditor
            ref={enEditorRef}
            content={en}
            onChange={onChangeEn}
            placeholder="Write the content (English)..."
            onImagePick={() => onRequestImagePick('en')}
          />
        </div>
      </div>
    );
  }
);

ContentLocaleFields.displayName = 'ContentLocaleFields';
