'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, forwardRef, useImperativeHandle } from 'react';
import { FigureImage, Caption } from './tiptapFigureImage';

// ─── Toolbar Button ────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-2 py-1 text-sm transition ${
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-700 hover:bg-gray-200'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({ editor, onImagePick }: { editor: Editor; onImagePick?: () => void }) {
  const addLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    if (onImagePick) {
      onImagePick();
    } else {
      const url = prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setFigureImage({ src: url }).run();
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline code"
      >
        {'</>'}
      </ToolbarButton>

      <div className="mx-1 w-px bg-gray-300" />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>

      <div className="mx-1 w-px bg-gray-300" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered list"
      >
        1. List
      </ToolbarButton>

      <div className="mx-1 w-px bg-gray-300" />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        &ldquo; Quote
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code block"
      >
        Code
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        ─
      </ToolbarButton>

      <div className="mx-1 w-px bg-gray-300" />

      {/* Links & Images */}
      <ToolbarButton
        onClick={addLink}
        active={editor.isActive('link')}
        title="Add link"
      >
        🔗 Link
      </ToolbarButton>
      <ToolbarButton
        onClick={addImage}
        title="Add image"
      >
        🖼 Image
      </ToolbarButton>

      <div className="mx-1 w-px bg-gray-300" />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        ↩
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        ↪
      </ToolbarButton>
    </div>
  );
}

// ─── Editor Component ──────────────────────────────────────────────────────────

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImagePick?: () => void;
}

export interface RichTextEditorHandle {
  /** Inserts an image at the current cursor/selection position. */
  insertImage: (url: string) => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { content, onChange, placeholder, onImagePick },
  ref
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-600 underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg my-4 max-w-full' },
      }),
      FigureImage,
      Caption,
      Placeholder.configure({
        // Captions live nested inside a figureImage node (doc > figureImage >
        // caption); includeChildren is required for the placeholder plugin to
        // find and decorate a textblock that isn't a direct child of doc.
        includeChildren: true,
        placeholder: ({ node }) =>
          node.type.name === 'caption'
            ? 'Add a caption... (optional)'
            : placeholder ?? 'Start writing your post...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose min-h-[300px] max-w-none px-4 py-3 focus:outline-none',
      },
    },
  });

  // Sync external content changes (e.g., loading a post for editing)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useImperativeHandle(ref, () => ({
    insertImage: (url: string) => {
      editor?.chain().focus().setFigureImage({ src: url }).run();
    },
  }), [editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
      <Toolbar editor={editor} onImagePick={onImagePick} />
      <EditorContent editor={editor} />
    </div>
  );
});
