import { useRef } from 'react';
import type { SlideBlock } from '../../types';

export default function ShapeToolbar({ block, onChange }: { block: SlideBlock; onChange: (p: Partial<SlideBlock>) => void }) {
  const fillRef   = useRef<HTMLInputElement>(null);
  const strokeRef = useRef<HTMLInputElement>(null);
  const transparentBg = 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0 / 8px 8px';
  const isFillTransp   = block.fillColor   === 'transparent';
  const isStrokeTransp = block.strokeColor === 'transparent';

  return (
    <div className="flex items-center gap-3 px-3 py-1 bg-white border-b border-gray-200 flex-wrap min-h-[40px] text-xs">

      {/* Заливка */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Заливка</span>
        <div
          className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0"
          style={{ background: isFillTransp ? transparentBg : (block.fillColor ?? '#6366f1') }}
          onClick={() => !isFillTransp && fillRef.current?.click()}
          title={isFillTransp ? 'Прозрачная заливка' : 'Изменить цвет заливки'}
        />
        <input ref={fillRef} type="color"
          value={isFillTransp ? '#6366f1' : (block.fillColor ?? '#6366f1')}
          onChange={e => onChange({ fillColor: e.target.value })}
          className="w-0 h-0 opacity-0 absolute pointer-events-none"
        />
        <button
          onClick={() => onChange({ fillColor: isFillTransp ? '#6366f1' : 'transparent' })}
          className={`w-6 h-6 rounded border flex items-center justify-center text-[11px] transition-colors ${isFillTransp ? 'bg-gray-100 border-gray-400 text-gray-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
          title={isFillTransp ? 'Убрать прозрачность' : 'Прозрачная заливка'}
        >∅</button>
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* Граница */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Граница</span>
        <div
          className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0"
          style={{ background: isStrokeTransp ? transparentBg : (block.strokeColor ?? '#374151') }}
          onClick={() => !isStrokeTransp && strokeRef.current?.click()}
          title={isStrokeTransp ? 'Без границы' : 'Изменить цвет границы'}
        />
        <input ref={strokeRef} type="color"
          value={isStrokeTransp ? '#374151' : (block.strokeColor ?? '#374151')}
          onChange={e => onChange({ strokeColor: e.target.value })}
          className="w-0 h-0 opacity-0 absolute pointer-events-none"
        />
        <button
          onClick={() => onChange({ strokeColor: isStrokeTransp ? '#374151' : 'transparent' })}
          className={`w-6 h-6 rounded border flex items-center justify-center text-[11px] transition-colors ${isStrokeTransp ? 'bg-gray-100 border-gray-400 text-gray-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
          title={isStrokeTransp ? 'Убрать прозрачность' : 'Без границы'}
        >∅</button>
      </div>

      {/* Слайдер толщины — только когда граница видима */}
      {!isStrokeTransp && (
        <>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Толщина</span>
            <input
              type="range"
              min={1}
              max={30}
              value={block.strokeWidth ?? 3}
              onChange={e => onChange({ strokeWidth: Number(e.target.value) })}
              className="w-24 h-1.5 accent-blue-500 cursor-pointer"
              title="Толщина границы"
            />
            <span className="w-6 text-center text-gray-600">{block.strokeWidth ?? 3}</span>
          </div>
        </>
      )}
    </div>
  );
}
