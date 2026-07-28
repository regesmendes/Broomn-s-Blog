import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    htmlEmbed: {
      /** Inserts a raw HTML/script embed (e.g. a third-party widget snippet) at the current selection. */
      setHtmlEmbed: (html: string) => ReturnType;
    };
  }
}

// Lets an admin embed a raw third-party script/HTML snippet (e.g. the Buy Me a
// Coffee widget) that Tiptap's normal paste handling can't preserve — pasting a
// <script> tag directly into the editor gets reduced to its escaped text
// content, since `script` isn't a node type in this schema. Instead the raw
// markup is entered once (via a prompt, not typed/pasted into the document)
// and stored base64-encoded in a data attribute rather than as parsed
// ProseMirror content, so it round-trips through editor reloads unescaped and
// untouched. It only becomes live markup again at final render time
// (resolveHtmlEmbeds in frontend/src/lib/htmlEmbeds.ts), and is deliberately
// excluded from translation (localizeContent.ts) — an arbitrary third-party
// translation API has no reason to preserve a base64 blob byte-for-byte.
export const HtmlEmbed = Node.create({
  name: 'htmlEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      html: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-html-embed]',
        getAttrs: (el) => {
          const encoded = (el as HTMLElement).getAttribute('data-html-embed') || '';
          try {
            return { html: decodeURIComponent(escape(atob(encoded))) };
          } catch {
            return { html: '' };
          }
        },
      },
    ];
  },

  renderHTML({ node }) {
    const encoded = btoa(unescape(encodeURIComponent(node.attrs.html || '')));
    return ['div', mergeAttributes({ 'data-html-embed': encoded })];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className =
        'my-2 rounded border border-dashed border-gray-400 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400';
      dom.textContent = `🔌 Embedded HTML/script (${node.attrs.html.length} characters) — not rendered here, only on the public page.`;
      return { dom };
    };
  },

  addCommands() {
    return {
      setHtmlEmbed:
        (html: string) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: { html } });
        },
    };
  },
});
