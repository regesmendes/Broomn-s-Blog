import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { HtmlEmbed } from './tiptapHtmlEmbed';

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, HtmlEmbed],
    content,
  });
}

describe('HtmlEmbed', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('stores inserted HTML as a base64 data attribute, not as literal markup', () => {
    editor = createEditor('<p></p>');
    const script = '<script src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="reges"></script>';

    editor.chain().focus().setHtmlEmbed(script).run();

    const html = editor.getHTML();
    expect(html).not.toContain('<script');
    expect(html).toMatch(/<div data-html-embed="[A-Za-z0-9+/=]+"><\/div>/);
  });

  it('round-trips through parseHTML/renderHTML without altering the original snippet', () => {
    const script = '<script data-id="reges" data-message="thanks &amp; welcome"></script>';
    editor = createEditor('<p></p>');
    editor.chain().focus().setHtmlEmbed(script).run();
    const serialized = editor.getHTML();

    // Reload the editor from the serialized HTML, exactly like re-opening the
    // admin editor for an existing post — the embed's attrs.html must survive.
    const reloaded = createEditor(serialized);
    expect(reloaded.getHTML()).toBe(serialized);

    reloaded.destroy();
  });

  it('handles unicode content in the embed without corruption', () => {
    editor = createEditor('<p></p>');
    const html = '<script data-message="Café ☕ obrigado"></script>';
    editor.chain().focus().setHtmlEmbed(html).run();

    const reloaded = createEditor(editor.getHTML());
    // Extract the node's attrs back out to confirm the decoded text matches.
    let decoded = '';
    reloaded.state.doc.descendants((node) => {
      if (node.type.name === 'htmlEmbed') decoded = node.attrs.html;
    });
    expect(decoded).toBe(html);

    reloaded.destroy();
  });

  it('is atomic — selecting/deleting it removes the whole embed in one step', () => {
    editor = createEditor('<p>before</p>');
    editor.chain().focus().setHtmlEmbed('<script></script>').run();
    expect(editor.getHTML()).toContain('data-html-embed');

    editor.commands.setTextSelection({ from: 0, to: editor.state.doc.content.size });
    editor.commands.deleteSelection();
    expect(editor.getHTML()).not.toContain('data-html-embed');
  });
});
