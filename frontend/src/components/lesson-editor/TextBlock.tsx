import { memo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontSize, FontFamily } from '@tiptap/extension-text-style';
import type { SlideBlock } from '../../types';

interface TextBlockProps {
  block: SlideBlock;
  isEditing: boolean;
  onActivate: () => void;
  onSave: (html: string) => void;
  setActiveEditor: (ed: ReturnType<typeof useEditor> | null) => void;
}

const TextBlock = memo(function TextBlock({ block, isEditing, onActivate, onSave, setActiveEditor }: TextBlockProps) {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, FontSize, FontFamily],
    content: block.html ?? '<p></p>',
    editable: false,
    onBlur: ({ editor }) => { onSave(editor.getHTML()); },
  }, [block.id]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing);
    if (isEditing) {
      setActiveEditor(editor);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (editor.isEditable) editor.commands.focus('end');
      }));
    } else {
      setActiveEditor(null);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (!editor || isEditing) return;
    if (editor.getHTML() !== block.html) {
      editor.commands.setContent(block.html ?? '<p></p>', { emitUpdate: false });
    }
  }, [block.html, isEditing]);

  return (
    <div
      className="w-full h-full overflow-hidden"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => { e.stopPropagation(); onActivate(); }}
      style={{ cursor: isEditing ? 'text' : 'default' }}
    >
      <EditorContent editor={editor} className="w-full h-full" style={{ pointerEvents: isEditing ? 'auto' : 'none' }} />
    </div>
  );
});

export default TextBlock;
