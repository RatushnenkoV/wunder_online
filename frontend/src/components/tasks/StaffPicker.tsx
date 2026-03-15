import { useState, useRef, useEffect } from 'react';
import type { StaffUser } from '../../types';

const DOT_CLS = { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' };
const LOAD_LABEL = { green: 'свободен', yellow: 'есть задачи', red: 'срочные задачи' };
const LOAD_TEXT_CLS = { green: 'text-green-600', yellow: 'text-yellow-600', red: 'text-red-500' };

interface StaffPickerProps {
  staffList: StaffUser[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

export default function StaffPicker({ staffList, value, onChange, required }: StaffPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = staffList.find(u => String(u.id) === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Hidden input for native form required validation */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors hover:border-gray-400 dark:hover:border-slate-500"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_CLS[selected.workload]}`} />
            <span className="truncate text-gray-900 dark:text-slate-100">{selected.last_name} {selected.first_name}</span>
          </span>
        ) : (
          <span className="text-gray-400 dark:text-slate-500">— выберите сотрудника —</span>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full px-3 py-2 text-sm text-left text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            — не выбран —
          </button>
          {staffList.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onChange(String(u.id)); setOpen(false); }}
              className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
                value === String(u.id)
                  ? 'bg-purple-50 dark:bg-purple-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_CLS[u.workload]}`} />
              <span className="flex-1 text-gray-900 dark:text-slate-100">{u.last_name} {u.first_name}</span>
              <span className={`text-xs flex-shrink-0 ${LOAD_TEXT_CLS[u.workload]}`}>
                {LOAD_LABEL[u.workload]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
