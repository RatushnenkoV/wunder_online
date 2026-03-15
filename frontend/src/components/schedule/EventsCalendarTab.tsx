import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolEvent } from '../../types';
import EventFormModal, { EVENT_TYPES } from './EventFormModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SCHOOL_MONTHS = [
  { month: 9, year: 2025, label: 'Сентябрь' },
  { month: 10, year: 2025, label: 'Октябрь' },
  { month: 11, year: 2025, label: 'Ноябрь' },
  { month: 12, year: 2025, label: 'Декабрь' },
  { month: 1, year: 2026, label: 'Январь' },
  { month: 2, year: 2026, label: 'Февраль' },
  { month: 3, year: 2026, label: 'Март' },
  { month: 4, year: 2026, label: 'Апрель' },
  { month: 5, year: 2026, label: 'Май' },
];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7;
}

function eventCoversDate(e: SchoolEvent, dateStr: string): boolean {
  if (!e.date_end) return e.date_start === dateStr;
  return e.date_start <= dateStr && e.date_end >= dateStr;
}

function getTypeInfo(type: string) {
  return EVENT_TYPES.find(t => t.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// ─── Year overview ───────────────────────────────────────────────────────────

function MiniMonth({
  year, month, label, events, typeFilter, onClick,
}: {
  year: number; month: number; label: string;
  events: SchoolEvent[]; typeFilter: string;
  onClick: () => void;
}) {
  const days = daysInMonth(year, month);
  const firstDay = firstWeekday(year, month);
  const filtered = events.filter(e => !typeFilter || e.event_type === typeFilter);
  const today = new Date().toISOString().slice(0, 10);

  const byDay: Record<number, SchoolEvent[]> = {};
  for (let d = 1; d <= days; d++) {
    const iso = toISO(year, month, d);
    const dayEvents = filtered.filter(e => eventCoversDate(e, iso));
    if (dayEvents.length) byDay[d] = dayEvents;
  }

  const hasAny = Object.keys(byDay).length > 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all text-left group"
    >
      <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
        {label}
      </span>

      <div className="grid grid-cols-7 gap-px w-full">
        {WEEKDAYS.map(wd => (
          <span key={wd} className="text-center text-[8px] text-gray-400 dark:text-slate-500 font-medium">
            {wd[0]}
          </span>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <span key={`e-${i}`} />)}
        {Array.from({ length: days }, (_, i) => i + 1).map(d => {
          const iso = toISO(year, month, d);
          const dayEvts = byDay[d] ?? [];
          const isToday = iso === today;
          const uniqueTypes = [...new Set(dayEvts.map(e => e.event_type))];

          return (
            <div
              key={d}
              className={`flex flex-col items-center min-h-9 py-1 ${isToday ? 'rounded-sm ring-1 ring-purple-400' : ''}`}
            >
              <span className={`text-[7px] leading-none ${dayEvts.length > 0 ? 'font-semibold text-gray-700 dark:text-slate-300' : 'text-gray-400 dark:text-slate-600'}`}>
                {d}
              </span>
              {uniqueTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center mt-1">
                  {uniqueTypes.map(type => (
                    <span key={type} className={`w-2 h-2 rounded-full ${getTypeInfo(type).dot}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasAny ? (
        <span className="mt-2 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
          {Object.values(byDay).reduce((s, a) => s + a.length, 0)} меропр.
        </span>
      ) : (
        <span className="mt-2 text-[10px] text-gray-300 dark:text-slate-600">нет мероприятий</span>
      )}
    </button>
  );
}

// ─── Month detail ────────────────────────────────────────────────────────────

function MonthDetail({
  year, month, label, events, typeFilter, canEdit,
  onBack, onPrev, onNext,
  onCreateWithDate, onEditEvent,
}: {
  year: number; month: number; label: string;
  events: SchoolEvent[]; typeFilter: string;
  canEdit: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCreateWithDate: (date: string) => void;
  onEditEvent: (event: SchoolEvent) => void;
}) {
  const days = daysInMonth(year, month);
  const firstDay = firstWeekday(year, month);
  const filtered = events.filter(e => !typeFilter || e.event_type === typeFilter);
  const today = new Date().toISOString().slice(0, 10);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  function toggleExpand(iso: string) {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  const byDay: Record<number, SchoolEvent[]> = {};
  for (let d = 1; d <= days; d++) {
    const iso = toISO(year, month, d);
    byDay[d] = filtered.filter(e => eventCoversDate(e, iso));
  }

  const totalCells = firstDay + days;
  const trailingCells = (7 - (totalCells % 7)) % 7;
  const MAX_SHOW = 3;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
          ← Год
        </button>
        <button onClick={onPrev} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">‹</button>
        <span className="text-base font-semibold text-gray-900 dark:text-slate-100 min-w-32 text-center">
          {label} {year}
        </span>
        <button onClick={onNext} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-xs font-medium text-gray-500 dark:text-slate-400 py-1">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`pre-${i}`} className="min-h-20 rounded-lg" />
        ))}

        {Array.from({ length: days }, (_, i) => i + 1).map(d => {
          const iso = toISO(year, month, d);
          const dayEvts = byDay[d] ?? [];
          const isToday = iso === today;
          const isWeekend = ((firstDay + d - 1) % 7) >= 5;
          const isExpanded = expandedDays.has(iso);
          const shownEvts = isExpanded ? dayEvts : dayEvts.slice(0, MAX_SHOW);

          return (
            <div
              key={d}
              className={`group min-h-20 p-1.5 rounded-lg border transition-colors ${
                isToday
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${
                  isToday
                    ? 'text-purple-600 dark:text-purple-400'
                    : isWeekend
                    ? 'text-gray-400 dark:text-slate-500'
                    : 'text-gray-700 dark:text-slate-300'
                }`}>
                  {d}
                </span>
                {canEdit && (
                  <button
                    onClick={e => { e.stopPropagation(); onCreateWithDate(iso); }}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-purple-500 text-xs leading-none transition-all"
                    title="Добавить мероприятие"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="space-y-0.5">
                {shownEvts.map(ev => {
                  const info = getTypeInfo(ev.event_type);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onEditEvent(ev)}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${info.color} hover:opacity-80 transition-opacity`}
                      title={ev.description}
                    >
                      {ev.time_note ? `${ev.time_note} ` : ''}{ev.description}
                    </button>
                  );
                })}
                {dayEvts.length > MAX_SHOW && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleExpand(iso); }}
                    className="text-[10px] text-purple-500 dark:text-purple-400 hover:text-purple-700 pl-1 transition-colors"
                  >
                    {isExpanded ? '▲ свернуть' : `+ещё ${dayEvts.length - MAX_SHOW}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {Array.from({ length: trailingCells }).map((_, i) => (
          <div key={`post-${i}`} className="min-h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── List view ───────────────────────────────────────────────────────────────

function ListView({
  events, typeFilter, canEdit, isAdmin, onEdit,
}: {
  events: SchoolEvent[]; typeFilter: string;
  canEdit: boolean; isAdmin: boolean;
  onEdit: (e: SchoolEvent) => void;
}) {
  const [sortField, setSortField] = useState('date_start');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState({
    date: '', time_note: '', target_classes: '', description: '',
    responsible: '', organizers: '', status: '',
  });

  function setFilter(k: keyof typeof filters, v: string) {
    setFilters(f => ({ ...f, [k]: v }));
  }

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function sortIcon(field: string) {
    if (sortField !== field) return <span className="text-gray-300 dark:text-slate-600 ml-0.5">↕</span>;
    return <span className="text-purple-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function fmt(s: string) {
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  }

  function formatDate(e: SchoolEvent) {
    if (e.date_end && e.date_end !== e.date_start) return `${fmt(e.date_start)} — ${fmt(e.date_end)}`;
    return fmt(e.date_start);
  }

  function match(val: string | null | undefined, filter: string) {
    return !filter || (val ?? '').toLowerCase().includes(filter.toLowerCase());
  }

  function getSortVal(e: SchoolEvent, field: string): string {
    if (field === 'date_start') return e.date_start;
    return String((e as unknown as Record<string, unknown>)[field] ?? '');
  }

  const rows = events
    .filter(e => !typeFilter || e.event_type === typeFilter)
    .filter(e =>
      match(formatDate(e), filters.date) &&
      match(e.time_note, filters.time_note) &&
      match(e.target_classes, filters.target_classes) &&
      match(e.description, filters.description) &&
      match(e.responsible, filters.responsible) &&
      match(e.organizers, filters.organizers) &&
      match(e.status, filters.status)
    )
    .sort((a, b) => {
      const cmp = getSortVal(a, sortField).localeCompare(getSortVal(b, sortField), 'ru');
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const inputCls = 'w-full px-1.5 py-0.5 text-[10px] border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-400';

  function fi(key: keyof typeof filters, placeholder = '...') {
    return <input type="text" value={filters[key]} onChange={e => setFilter(key, e.target.value)} placeholder={placeholder} className={inputCls} />;
  }

  const thCls = 'text-left py-2 px-3 font-medium cursor-pointer select-none hover:text-purple-600 dark:hover:text-purple-400 transition-colors whitespace-nowrap';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            <th className={thCls} onClick={() => toggleSort('date_start')}>Дата {sortIcon('date_start')}</th>
            <th className={thCls} onClick={() => toggleSort('time_note')}>Время {sortIcon('time_note')}</th>
            <th className={thCls}>Классы</th>
            <th className={thCls} onClick={() => toggleSort('description')}>Мероприятие {sortIcon('description')}</th>
            <th className={`${thCls} hidden md:table-cell`} onClick={() => toggleSort('responsible')}>Ответственный {sortIcon('responsible')}</th>
            <th className={`${thCls} hidden lg:table-cell`}>Организаторы</th>
            <th className={thCls} onClick={() => toggleSort('event_type')}>Тип {sortIcon('event_type')}</th>
            <th className={`${thCls} hidden md:table-cell`} onClick={() => toggleSort('status')}>Статус {sortIcon('status')}</th>
            {(canEdit || isAdmin) && <th className="py-2 px-3" />}
          </tr>
          <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
            <td className="py-1 px-2">{fi('date', 'дд.мм.гггг')}</td>
            <td className="py-1 px-2">{fi('time_note')}</td>
            <td className="py-1 px-2">{fi('target_classes')}</td>
            <td className="py-1 px-2">{fi('description')}</td>
            <td className="py-1 px-2 hidden md:table-cell">{fi('responsible')}</td>
            <td className="py-1 px-2 hidden lg:table-cell">{fi('organizers')}</td>
            <td className="py-1 px-2" />
            <td className="py-1 px-2 hidden md:table-cell">{fi('status')}</td>
            {(canEdit || isAdmin) && <td className="py-1 px-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center text-gray-400 dark:text-slate-500 py-12 text-sm">Мероприятий не найдено</td>
            </tr>
          ) : rows.map(e => {
            const info = getTypeInfo(e.event_type);
            return (
              <tr
                key={e.id}
                className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                onClick={() => onEdit(e)}
              >
                <td className="py-2 px-3 whitespace-nowrap text-gray-700 dark:text-slate-300 font-medium">{formatDate(e)}</td>
                <td className="py-2 px-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{e.time_note || '—'}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-slate-300 max-w-32 truncate">{e.target_classes || '—'}</td>
                <td className="py-2 px-3 text-gray-900 dark:text-slate-100 max-w-48">{e.description}</td>
                <td className="py-2 px-3 text-gray-500 dark:text-slate-400 hidden md:table-cell max-w-32 truncate">{e.responsible || '—'}</td>
                <td className="py-2 px-3 text-gray-500 dark:text-slate-400 hidden lg:table-cell max-w-32 truncate">{e.organizers || '—'}</td>
                <td className="py-2 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${info.color}`}>
                    {info.label}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500 dark:text-slate-400 hidden md:table-cell text-xs">{e.status || '—'}</td>
                {(canEdit || isAdmin) && (
                  <td className="py-2 px-3">
                    <button
                      onClick={ev => { ev.stopPropagation(); onEdit(e); }}
                      className="text-xs text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      ✎
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Import dialog ───────────────────────────────────────────────────────────

interface ImportResult {
  created: number;
  skipped: number;
  replaced: boolean;
  skipped_details?: string[];
}

function ImportDialog({
  existingCount, file, isLoading, importResult, importError,
  onConfirm, onClose,
}: {
  existingCount: number; file: File;
  isLoading: boolean;
  importResult: ImportResult | null;
  importError: string;
  onConfirm: (replace: boolean) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<'add' | 'replace' | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  function proceed() {
    if (existingCount === 0) { onConfirm(false); return; }
    if (!choice) return;
    if (choice === 'replace' && step === 1) { setStep(2); return; }
    onConfirm(choice === 'replace');
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg className="animate-spin h-10 w-10 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">Импортируется...</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">Читаем файл и сохраняем мероприятия. Пожалуйста, подождите.</p>
        </div>
      </div>
    );
  }

  if (importResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">✅</span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Импорт завершён</h3>
          </div>
          <div className="space-y-2 mb-4">
            <p className="text-sm text-gray-700 dark:text-slate-300">
              Создано мероприятий: <strong className="text-green-600">{importResult.created}</strong>
            </p>
            <p className="text-sm text-gray-700 dark:text-slate-300">
              Пропущено строк: <strong>{importResult.skipped}</strong>
              <span className="text-xs text-gray-400 ml-1">(без даты или описания)</span>
            </p>
            {importResult.replaced && (
              <p className="text-sm text-orange-600">Предыдущие мероприятия удалены.</p>
            )}
          </div>
          {importResult.skipped_details && importResult.skipped_details.length > 0 && (
            <details className="mb-4">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Показать пропущенные строки ({importResult.skipped_details.length})
              </summary>
              <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                {importResult.skipped_details.map((r, i) => (
                  <li key={i} className="text-xs text-gray-500 font-mono">{r}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex justify-end">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Готово
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (importError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">❌</span>
            <h3 className="text-lg font-semibold text-red-600">Ошибка импорта</h3>
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-300 mb-4 font-mono bg-red-50 dark:bg-red-900/20 rounded-lg p-3 break-words">
            {importError}
          </p>
          <p className="text-xs text-gray-400 mb-4">Подробности записаны в серверные логи.</p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Закрыть</button>
            <button onClick={() => { setStep(1); setChoice(null); }} className="px-5 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Импорт мероприятий</h3>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
              Файл: <strong>{file.name}</strong>.<br />
              {existingCount > 0
                ? <>В системе уже есть <strong>{existingCount}</strong> {declEvent(existingCount)}. Что сделать?</>
                : 'В системе пока нет мероприятий. Данные будут добавлены.'}
            </p>
            {existingCount > 0 && (
              <div className="space-y-2 mb-4">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${choice === 'add' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}>
                  <input type="radio" name="import" value="add" checked={choice === 'add'} onChange={() => setChoice('add')} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Добавить поверх существующих</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Существующие мероприятия сохранятся, новые добавятся</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${choice === 'replace' ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}>
                  <input type="radio" name="import" value="replace" checked={choice === 'replace'} onChange={() => setChoice('replace')} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Заменить все</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Все {existingCount} {declEvent(existingCount)} будут удалены</p>
                  </div>
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Отмена</button>
              <button
                onClick={proceed}
                disabled={existingCount > 0 && !choice}
                className="px-5 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                {existingCount === 0 ? 'Импортировать' : choice === 'replace' ? 'Далее →' : 'Импортировать'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-semibold text-red-600">Внимание!</h3>
            </div>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-5">
              Все <strong>{existingCount}</strong> {declEvent(existingCount)} в системе будут <strong>безвозвратно удалены</strong> и заменены данными из файла.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">← Назад</button>
              <button
                onClick={() => onConfirm(true)}
                className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Подтвердить удаление и импортировать
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function declEvent(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'мероприятие';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'мероприятия';
  return 'мероприятий';
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function EventsCalendarTab() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const canEdit = !!(user?.is_admin || user?.is_teacher);

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [view, setView] = useState<'year' | 'month' | 'list'>('year');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0);

  const [modalEvent, setModalEvent] = useState<SchoolEvent | null | undefined>(undefined);
  const [modalDate, setModalDate] = useState('');

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCount, setImportCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/events/?date_after=2025-09-01&date_before=2026-05-31');
      setEvents(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  async function handleSave(form: Omit<SchoolEvent, 'id' | 'created_by'>) {
    if (modalEvent && modalEvent.id) {
      await api.patch(`/events/${modalEvent.id}/`, form);
    } else {
      await api.post('/events/', form);
    }
    await loadEvents();
  }

  async function handleDelete() {
    if (!modalEvent?.id) return;
    await api.delete(`/events/${modalEvent.id}/`);
    await loadEvents();
  }

  function openCreate(date?: string) {
    setModalDate(date ?? '');
    setModalEvent(null);
  }

  function openEdit(ev: SchoolEvent) {
    setModalEvent(ev);
  }

  async function handleImportFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportResult(null);
    setImportError('');
    try {
      const { data } = await api.get('/events/import/');
      setImportCount(data.count);
    } catch {
      setImportCount(0);
    }
    setImportFile(f);
    e.target.value = '';
  }

  async function confirmImport(replace: boolean) {
    if (!importFile) return;
    setImporting(true);
    setImportError('');
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('replace', replace ? 'true' : 'false');
    try {
      const { data } = await api.post('/events/import/', fd);
      setImportResult(data as ImportResult);
      await loadEvents();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { detail?: string } } })?.response?.data;
      setImportError(errData?.detail ?? 'Неизвестная ошибка. Подробности в логах сервера.');
    } finally {
      setImporting(false);
    }
  }

  function closeImportDialog() {
    setImportFile(null);
    setImportResult(null);
    setImportError('');
  }

  const selectedMonth = SCHOOL_MONTHS[selectedMonthIdx];

  function prevMonth() {
    setSelectedMonthIdx(i => Math.max(0, i - 1));
  }

  function nextMonth() {
    setSelectedMonthIdx(i => Math.min(SCHOOL_MONTHS.length - 1, i + 1));
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
          Учебный год 2025–2026
        </span>

        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
          {([['year', '📅 Год'], ['month', '📆 Месяц'], ['list', '☰ Список']] as [typeof view, string][]).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                view === v
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 font-medium shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {canEdit && (
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            + Создать
          </button>
        )}
        {isAdmin && (
          <>
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              ⬆ {importing ? 'Импорт...' : 'Импорт Excel'}
            </button>
            <input ref={importInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFileSelect} className="hidden" />
          </>
        )}
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          onClick={() => setTypeFilter('')}
          className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
            !typeFilter
              ? 'bg-gray-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent'
              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-gray-400'
          }`}
        >
          Все
        </button>
        {EVENT_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(typeFilter === t.value ? '' : t.value)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
              typeFilter === t.value
                ? t.color
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-gray-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.dot}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Загрузка...</div>
      ) : view === 'year' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SCHOOL_MONTHS.map((m, idx) => (
            <MiniMonth
              key={idx}
              year={m.year}
              month={m.month}
              label={m.label}
              events={events}
              typeFilter={typeFilter}
              onClick={() => { setSelectedMonthIdx(idx); setView('month'); }}
            />
          ))}
        </div>
      ) : view === 'month' ? (
        <MonthDetail
          year={selectedMonth.year}
          month={selectedMonth.month}
          label={selectedMonth.label}
          events={events}
          typeFilter={typeFilter}
          canEdit={canEdit}
          onBack={() => setView('year')}
          onPrev={prevMonth}
          onNext={nextMonth}
          onCreateWithDate={date => openCreate(date)}
          onEditEvent={openEdit}
        />
      ) : (
        <ListView
          events={events}
          typeFilter={typeFilter}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onEdit={openEdit}
        />
      )}

      {modalEvent !== undefined && (
        <EventFormModal
          event={modalEvent ?? undefined}
          defaultDate={modalDate}
          canEdit={canEdit || (modalEvent !== null && modalEvent.created_by === user?.id)}
          onSave={handleSave}
          onDelete={isAdmin && modalEvent ? handleDelete : undefined}
          onClose={() => setModalEvent(undefined)}
        />
      )}

      {(importFile || importing) && importFile && (
        <ImportDialog
          existingCount={importCount}
          file={importFile}
          isLoading={importing}
          importResult={importResult}
          importError={importError}
          onConfirm={confirmImport}
          onClose={closeImportDialog}
        />
      )}
    </div>
  );
}
