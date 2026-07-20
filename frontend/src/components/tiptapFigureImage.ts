import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figureImage: {
      /** Inserts an image wrapped in <figure><figcaption> at the current selection. */
      setFigureImage: (options: { src: string; alt?: string }) => ReturnType;
    };
  }
}

// Wraps the existing `image` node (registered separately via @tiptap/extension-image,
// unchanged) together with a `caption` text node inside a <figure>, so a caption is
// tied to that one specific occurrence of the image in the post's content — not a
// property of the image/media asset itself.
export const FigureImage = Node.create({
  name: 'figureImage',
  group: 'block',
  content: 'image caption',
  isolating: true,

  parseHTML() {
    return [{ tag: 'figure' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFigureImage:
        (options) =>
        ({ tr, dispatch, state }) => {
          const { image: imageType, caption: captionType, figureImage: figureType } = state.schema.nodes;
          if (!imageType || !captionType || !figureType) return false;

          if (dispatch) {
            const pos = state.selection.from;
            const imageNode = imageType.create({ src: options.src, alt: options.alt ?? '' });
            const captionNode = captionType.create();
            const figureNode = figureType.create(null, [imageNode, captionNode]);

            tr.replaceSelectionWith(figureNode);

            // replaceSelectionWith may split the surrounding block (a block
            // node can't sit inside a paragraph's inline content), which
            // shifts positions — map the original cursor position through
            // the transform's steps, biased backward (-1) so it resolves to
            // right before the newly inserted figure, not after it.
            const figureStart = tr.mapping.map(pos, -1);
            const captionStart = figureStart + 1 + imageNode.nodeSize + 1;
            const $caption = tr.doc.resolve(captionStart);

            if ($caption.parent.type.name === 'caption') {
              tr.setSelection(TextSelection.create(tr.doc, captionStart));
            }
          }

          return true;
        },
    };
  },
});

// The caption itself — plain editable text, rendered as <figcaption>.
export const Caption = Node.create({
  name: 'caption',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'figcaption' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figcaption', mergeAttributes(HTMLAttributes), 0];
  },
});
