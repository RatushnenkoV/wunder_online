import { useRef } from 'react';

export default function BgColorButton({ bg, onChange }: { bg: string; onChange: (color: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDefault = bg === '#ffffff';
  return (
    <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200" title="Фон слайда">
      <span className="text-xs text-gray-400 select-none">Фон</span>
      <div
        className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0"
        style={{ backgroundColor: bg }}
        onClick={() => inputRef.current?.click()}
        title="Цвет фона слайда"
      />
      <input
        ref={inputRef}
        type="color"
        value={bg}
        onChange={e => onChange(e.target.value)}
        className="w-0 h-0 opacity-0 absolute pointer-events-none"
      />
      {!isDefault && (
        <button
          onClick={() => onChange('#ffffff')}
          className="w-5 h-5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 text-[11px] flex items-center justify-center"
          title="Сбросить фон"
        >∅</button>
      )}
    </div>
  );
}
