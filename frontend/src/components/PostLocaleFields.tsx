'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { RichTextEditor, RichTextEditorHandle } from './RichTextEditor';
import { translateHtml, translatePlainText } from '@/lib/translate';

export interface LocaleContent {
  title: string;
  excerpt: string;
  content: string;
}

export interface PostLocaleFieldsHandle {
  insertImage: (locale: 'pt' | 'en', url: string) => void;
}

interface PostLocaleFieldsProps {
  pt: LocaleContent;
  en: LocaleContent;
  onChangePt: (next: LocaleContent) => void;
  onChangeEn: (next: LocaleContent) => void;
  onRequestImagePick: (locale: 'pt' | 'en') => void;
}

function isBlankHtml(value: string): boolean {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length === 0;
}

function isLocaleBlank(value: LocaleContent): boolean {
  return !value.title.trim() && !value.excerpt.trim() && isBlankHtml(value.content);
}

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400';

export const PostLocaleFields = forwardRef<PostLocaleFieldsHandle, PostLocaleFieldsProps>(
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

      if (!isLocaleBlank(target)) {
        const confirmed = window.confirm(
          `This will overwrite the existing ${targetLabel} content. Continue?`
        );
        if (!confirmed) return;
      }

      setTranslating(true);
      setTranslateError(null);

      try {
        const [title, excerpt, contentResult] = await Promise.all([
          translatePlainText(source.title, langpair),
          source.excerpt ? translatePlainText(source.excerpt, langpair) : Promise.resolve(''),
          translateHtml(source.content, langpair),
        ]);

        const onChangeTarget = activeTab === 'pt' ? onChangeEn : onChangePt;
        onChangeTarget({ title, excerpt, content: contentResult.html });

        if (contentResult.partial) {
          setTranslateError('Part of the content could not be translated — please review before publishing.');
        }
      } catch (err) {
        setTranslateError(err instanceof Error ? err.message : 'Translation failed.');
      } finally {
        setTranslating(false);
      }
    }

    const active = activeTab === 'pt' ? pt : en;
    const onChangeActive = activeTab === 'pt' ? onChangePt : onChangeEn;

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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title {activeTab === 'pt' && '*'}
          </label>
          <input
            type="text"
            value={active.title}
            onChange={(e) => onChangeActive({ ...active, title: e.target.value })}
            required={activeTab === 'pt'}
            className={inputClass}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Excerpt</label>
          <input
            type="text"
            value={active.excerpt}
            onChange={(e) => onChangeActive({ ...active, excerpt: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content {activeTab === 'pt' && '*'}
          </label>
          {/* Both editors stay mounted so switching tabs never loses editor
              state — only the inactive one is hidden. */}
          <div className={`mt-1 ${activeTab === 'pt' ? '' : 'hidden'}`}>
            <RichTextEditor
              ref={ptEditorRef}
              content={pt.content}
              onChange={(html) => onChangePt({ ...pt, content: html })}
              placeholder="Start writing your post (Português)..."
              onImagePick={() => onRequestImagePick('pt')}
            />
          </div>
          <div className={`mt-1 ${activeTab === 'en' ? '' : 'hidden'}`}>
            <RichTextEditor
              ref={enEditorRef}
              content={en.content}
              onChange={(html) => onChangeEn({ ...en, content: html })}
              placeholder="Start writing your post (English)..."
              onImagePick={() => onRequestImagePick('en')}
            />
          </div>
        </div>
      </div>
    );
  }
);

PostLocaleFields.displayName = 'PostLocaleFields';
