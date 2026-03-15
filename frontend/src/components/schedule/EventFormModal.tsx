import { useState, useEffect } from 'react';
import type { SchoolEvent } from '../../types';

export const EVENT_TYPES = [
  { value: 'holiday',        label: 'Праздник',                color: 'bg-purple-100 text-purple-700 border-purple-300',  dot: 'bg-purple-400' },
  { value: 'teambuilding',   label: 'Тимбилдинг',              color: 'bg-green-100 text-green-700 border-green-300',    dot: 'bg-green-400' },
  { value: 'meta_subject',   label: 'Метапредметный проект',   color: 'bg-amber-100 text-amber-700 border-amber-300',    dot: 'bg-amber-400' },
  { value: 'cross_subject',  label: 'Межпредметный проект',    color: 'bg-blue-100 text-blue-700 border-blue-300',       dot: 'bg-blue-400' },
  { value: 'subject',        label: 'Предметный проект',       color: 'bg-indigo-100 text-indigo-700 border-indigo-300', dot: 'bg-indigo-400' },
  { value: 'training',       label: 'Обучение',                color: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-400' },
  { value: 'career_guidance',label: 'Профориентация',          color: 'bg-pink-100 text-pink-700 border-pink-300',       dot: 'bg-pink-400' },
  { value: 'other',          label: 'Другое',                  color: 'bg-gray-100 text-gray-700 border-gray-300',       dot: 'bg-gray-400' },
];

export const APPROVED_OPTIONS = [
  { value: 'yes',        label: 'Согласовано' },
  { value: 'no',         label: 'Не согласовано' },
  { value: 'rescheduled', label: 'Перенесено' },
  { value: 'pending',    label: 'Ожидает' },
];

export const STATUS_OPTIONS = [
  { value: '',            label: '— Не указано —' },
  { value: 'Планируется', label: 'Планируется' },
  { value: 'Проведено',   label: 'Проведено' },
  { value: 'Отменено',    label: 'Отменено' },
  { value: 'Перенесено',  label: 'Перенесено' },
];

type FormData = Omit<SchoolEvent, 'id' | 'created_by'>;

const EMPTY: FormData = {
  date_start: '',
  date_end: null,
  time_note: '',
  target_classes: '',
  organizers: '',
  description: '',
  responsible: '',
  helper: '',
  event_type: '',
  approved: 'pending',
  cost: '',
  status: '',
};

interface Props {
  event?: SchoolEvent | null;
  defaultDate?: string;
  canEdit: boolean;
  onSave: (data: FormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export default function EventFormModal({ event, defaultDate, canEdit, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<FormData>(() => {
    if (event) {
      const { id, created_by, ...rest } = event;
      return { ...rest };
    }
    return { ...EMPTY, date_start: defaultDate ?? '' };
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(field: keyof FormData, value: string | null) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.description.trim()) { setError('Введите название мероприятия'); return; }
    if (!form.date_start) { setError('Укажите дату начала'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch {
      setError('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError('Ошибка при удалении');
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500';
  const labelCls = 'block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {event ? (canEdit ? 'Редактировать мероприятие' : 'Мероприятие') : 'Новое мероприятие'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Description */}
          <div>
            <label className={labelCls}>Название / описание мероприятия <span className="text-red-500">*</span></label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              disabled={!canEdit}
              placeholder="Например: День знаний"
            />
          </div>

          {/* Dates + time row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Дата начала <span className="text-red-500">*</span></label>
              <input type="date" className={inputCls} value={form.date_start} onChange={e => set('date_start', e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <label className={labelCls}>Дата окончания</label>
              <input
                type="date"
                className={inputCls}
                value={form.date_end ?? ''}
                onChange={e => set('date_end', e.target.value || null)}
                disabled={!canEdit}
                min={form.date_start}
              />
            </div>
            <div>
              <label className={labelCls}>Время</label>
              <input type="text" className={inputCls} value={form.time_note} onChange={e => set('time_note', e.target.value)} disabled={!canEdit} placeholder="09:00 / Весь день" />
            </div>
          </div>

          {/* Classes + organizers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Классы</label>
              <input type="text" className={inputCls} value={form.target_classes} onChange={e => set('target_classes', e.target.value)} disabled={!canEdit} placeholder="Вся школа / 3А, 5Б" />
            </div>
            <div>
              <label className={labelCls}>Организаторы</label>
              <input type="text" className={inputCls} value={form.organizers} onChange={e => set('organizers', e.target.value)} disabled={!canEdit} placeholder="МО математики" />
            </div>
          </div>

          {/* Responsible + helper */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ответственный</label>
              <input type="text" className={inputCls} value={form.responsible} onChange={e => set('responsible', e.target.value)} disabled={!canEdit} placeholder="Иванова М.В." />
            </div>
            <div>
              <label className={labelCls}>Помощники</label>
              <input type="text" className={inputCls} value={form.helper} onChange={e => set('helper', e.target.value)} disabled={!canEdit} placeholder="Петров А." />
            </div>
          </div>

          {/* Type + approved */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Тип мероприятия</label>
              <select className={inputCls} value={form.event_type} onChange={e => set('event_type', e.target.value)} disabled={!canEdit}>
                <option value="">— Не выбрано —</option>
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Согласовано</label>
              <select className={inputCls} value={form.approved} onChange={e => set('approved', e.target.value)} disabled={!canEdit}>
                {APPROVED_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost + status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Стоимость</label>
              <input type="text" className={inputCls} value={form.cost} onChange={e => set('cost', e.target.value)} disabled={!canEdit} placeholder="30 000 тг / бесплатно" />
            </div>
            <div>
              <label className={labelCls}>Статус</label>
              <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)} disabled={!canEdit}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                {form.status && !STATUS_OPTIONS.some(o => o.value === form.status) && (
                  <option value={form.status}>{form.status}</option>
                )}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div>
            {canEdit && event && onDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Удалить
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Удалить мероприятие?</span>
                <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {deleting ? '...' : 'Да, удалить'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Отмена</button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200">
              {canEdit ? 'Отмена' : 'Закрыть'}
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Сохранение...' : event ? 'Сохранить' : 'Создать'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
