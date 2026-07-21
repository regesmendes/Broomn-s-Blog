import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EmDash } from './tiptapEmDash';

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, EmDash],
    content,
  });
}

// Input rules fire off ProseMirror's `handleTextInput(view, from, to, text)`
// prop, invoked by the DOM observer on a real text-input event — calling
// editor.commands.insertContent() bypasses input rules entirely, so it can't
// be used to exercise this extension.
function typeText(editor: Editor, text: string) {
  const { from, to } = editor.state.selection;
  return editor.view.someProp('handleTextInput', (f) =>
    f(editor.view, from, to, text, () => editor.state.tr)
  );
}

describe('EmDash input rule', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('replaces a typed "--" with an em dash', () => {
    editor = createEditor('<p></p>');
    editor.commands.setTextSelection(1);

    const handled = typeText(editor, '--');

    expect(handled).toBe(true);
    expect(editor.getHTML()).toBe('<p>—</p>');
  });

  it('does not fire on a single "-"', () => {
    editor = createEditor('<p></p>');
    editor.commands.setTextSelection(1);

    const handled = typeText(editor, '-');

    expect(handled).toBeFalsy();
    expect(editor.getHTML()).not.toContain('—');
  });

  it('only replaces the trailing "--", leaving preceding text untouched', () => {
    editor = createEditor('<p>hello</p>');
    editor.commands.setTextSelection(6); // end of "hello"

    typeText(editor, '--');

    expect(editor.getHTML()).toBe('<p>hello—</p>');
  });
});
