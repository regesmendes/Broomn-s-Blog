import { Extension, InputRule } from '@tiptap/core';

// Replaces a typed "--" with an em dash (—), the one rule we want from
// @tiptap/extension-typography without pulling in its other rules (smart
// quotes, ellipsis, etc.) that would silently rewrite existing content.
export const EmDash = Extension.create({
  name: 'emDash',

  addInputRules() {
    return [
      new InputRule({
        find: /--$/,
        handler: ({ state, range }) => {
          state.tr.insertText('—', range.from, range.to);
        },
      }),
    ];
  },
});
