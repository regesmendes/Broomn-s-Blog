import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { FigureImage, Caption } from './tiptapFigureImage';

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, Image, FigureImage, Caption],
    content,
  });
}

describe('FigureImage / Caption', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('inserts a figure with an empty caption, cursor placed inside the caption', () => {
    editor = createEditor('<p></p>');
    editor.chain().focus().setFigureImage({ src: 'https://example.com/pic.jpg' }).run();

    expect(editor.getHTML()).toBe(
      '<figure><img src="https://example.com/pic.jpg" alt=""><figcaption></figcaption></figure><p></p>'
    );

    // Typing right after insertion should land the text inside the caption.
    editor.chain().insertContent('A caption').run();
    expect(editor.getHTML()).toContain('<figcaption>A caption</figcaption>');
  });

  it('inserts at the cursor position, not always at the end', () => {
    editor = createEditor('<p>AAAA BBBB</p>');
    // Place cursor right after "AAAA " (position 6 in the doc: 1 for entering
    // the paragraph + 5 characters "AAAA ").
    editor.commands.setTextSelection(6);
    editor.chain().focus().setFigureImage({ src: 'https://example.com/pic.jpg' }).run();

    const html = editor.getHTML();
    // The figure should split the paragraph, landing between "AAAA" and "BBBB"
    // — not appended after the whole paragraph.
    expect(html).toBe(
      '<p>AAAA </p><figure><img src="https://example.com/pic.jpg" alt=""><figcaption></figcaption></figure><p>BBBB</p>'
    );
  });

  it('parses existing bare <img> content (pre-caption posts) without errors', () => {
    editor = createEditor('<p>Hello</p><img src="https://example.com/old.jpg" alt="">');
    expect(editor.getHTML()).toContain('<img src="https://example.com/old.jpg"');
    expect(editor.getHTML()).not.toContain('<figure>');
  });

  it('parses <figure><img><figcaption> content back correctly (round-trip)', () => {
    const html = '<figure><img src="https://example.com/pic.jpg" alt=""><figcaption>Legenda aqui</figcaption></figure>';
    editor = createEditor(html);
    expect(editor.getHTML()).toBe(html);
  });
});
