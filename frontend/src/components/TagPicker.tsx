'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { TagWithCount } from '@/lib/api';

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Chip-style tag input with autocomplete against existing tags. Still lets
 * an admin type a brand-new tag name (created on post save, same as before)
 * — the point is just to surface existing tags so a near-duplicate typo
 * doesn't get created in the first place.
 */
export function TagPicker({ value, onChange }: TagPickerProps) {
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    api.getTags().then(setAllTags).catch(() => {});
  }, []);

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...value, trimmed]);
    setInput('');
  };

  const removeTag = (name: string) => {
    onChange(value.filter((t) => t !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const query = input.trim().toLowerCase();
  const suggestions = query
    ? allTags
        .filter(
          (t) => t.name.toLowerCase().includes(query) && !value.some((v) => v.toLowerCase() === t.name.toLowerCase())
        )
        .slice(0, 8)
    : [];

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-700">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="cursor-pointer text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? 'Add a tag...' : ''}
          className="min-w-[8rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm text-gray-900 outline-none dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700">
          {suggestions.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(tag.name)}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <span>{tag.name}</span>
                <span className="text-xs text-gray-400">
                  {tag.postCount} post{tag.postCount !== 1 ? 's' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Press Enter or comma to add. Pick an existing tag from the list to avoid creating a near-duplicate.
      </p>
    </div>
  );
}
