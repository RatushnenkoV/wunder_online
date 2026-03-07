import { useRef } from 'react';
import { useEditor } from '@tiptap/react';

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96];

const FONT_FAMILIES = [
  { family: 'Arial, Helvetica, sans-serif',    label: 'Arial'           },
  { family: 'Times New Roman, Times, serif',   label: 'Times New Roman' },
  { family: 'Courier New, Courier, monospace', label: 'Courier New'     },
  { family: 'Verdana, Geneva, sans-serif',     label: 'Verdana'         },
  { family: 'Georgia, serif',                  label: 'Georgia'         },
  { family: 'Tahoma, Geneva, sans-serif',      label: 'Tahoma'          },
  { family: 'Impact, Charcoal, sans-serif',    label: 'Impact'          },
];

export default function TiptapToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  const colorRef = useRef<HTMLInputElement>(null);

  if (!editor) return <div className="h-10 border-b border-gray-200 bg-white" />;

  const currentColor      = (editor.getAttributes('textStyle').color as string | undefined) ?? '#1f2937';
  const rawSize           = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '';
  const currentFontSize   = rawSize.replace('px', '') || '16';
  const currentFontFamily = (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? '';

  const btn = (active: boolean, onClick: () => void, label: string, title: string) => (
    <button
      key={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`px-2 py-1 text-sm rounded transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
    >{label}</button>
  );

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 bg-white border-b border-gray-200 flex-wrap min-h-[40px]">
      {/* Форматирование */}
      {btn(editor.isActive('bold'),        () => editor.chain().focus().toggleBold().run(),        'B',  'Жирный')}
      {btn(editor.isActive('italic'),      () => editor.chain().focus().toggleItalic().run(),      'I',  'Курсив')}
      {btn(editor.isActive('strike'),      () => editor.chain().focus().toggleStrike().run(),      'S̶', 'Зачёркнутый')}
      <div className="w-px h-5 bg-gray-200 mx-1" />
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  '•≡', 'Маркированный список')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '1≡', 'Нумерованный список')}
      <div className="w-px h-5 bg-gray-200 mx-1" />

      {/* Шрифт */}
      <select
        value={currentFontFamily}
        onMouseDown={e => e.stopPropagation()}
        onChange={e => {
          const ff = e.target.value;
          if (ff) {
            editor.chain().focus().setFontFamily(ff).run();
          } else {
            editor.chain().focus().unsetFontFamily().run();
          }
        }}
        className="text-xs border border-gray-200 rounded px-1 h-6 text-gray-600 bg-white cursor-pointer"
        style={{ maxWidth: 110, fontFamily: currentFontFamily || 'inherit' }}
        title="Шрифт"
      >
        <option value="">Шрифт</option>
        {FONT_FAMILIES.map(({ family, label }) => (
          <option key={family} value={family} style={{ fontFamily: family }}>{label}</option>
        ))}
      </select>

      {/* Размер шрифта */}
      <select
        value={currentFontSize}
        onMouseDown={e => e.stopPropagation()}
        onChange={e => {
          const sz = e.target.value;
          editor.chain().focus().setFontSize(`${sz}px`).run();
        }}
        className="text-xs border border-gray-200 rounded px-1 h-6 text-gray-600 bg-white cursor-pointer"
        title="Размер шрифта"
      >
        {FONT_SIZES.map(s => <option key={s} value={String(s)}>{s}</option>)}
      </select>

      {/* Цвет текста */}
      <div className="flex items-center gap-1 ml-1">
        <div
          className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0 overflow-hidden flex flex-col"
          onClick={() => colorRef.current?.click()}
          title="Цвет текста"
        >
          <div className="flex-1 flex items-center justify-center text-xs font-bold" style={{ color: currentColor }}>A</div>
          <div className="h-1.5" style={{ backgroundColor: currentColor }} />
        </div>
        <input
          ref={colorRef}
          type="color"
          value={currentColor}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          className="w-0 h-0 opacity-0 absolute pointer-events-none"
        />
        <button
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); }}
          className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-[11px] text-gray-400 hover:bg-gray-50"
          title="Сбросить цвет"
        >∅</button>
      </div>
    </div>
  );
}
