import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type { YellowListEntry, YellowListStudentOption } from '../types';

// ── helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

// ── Student search combobox ──────────────────────────────────────────────────

function StudentSearch({
  value,
  onChange,
}: {
  value: YellowListStudentOption | null;
  onChange: (v: YellowListStudentOption | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<YellowListStudentOption[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setOptions([]); setOpen(false); return; }
    api.get(`/yellow-list/students/?q=${encodeURIComponent(q)}`)
      .then(r => { setOptions(r.data); setOpen(true); })
      .catch(() => {});
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onChange(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 250);
  };

  const select = (opt: YellowListStudentOption) => {
    onChange(opt);
    setQuery(`${opt.last_name} ${opt.first_name} (${opt.school_class_name})`);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value ? `${value.last_name} ${value.first_name} (${value.school_class_name})` : query}
        onChange={handleInput}
        onFocus={() => { if (options.length) setOpen(true); }}
        placeholder="Фамилия, имя или класс..."
        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
      />
      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map(opt => (
            <li
              key={opt.student_profile_id}
              onMouseDown={() => select(opt)}
              className="px-3 py-2 text-sm hover:bg-yellow-50 cursor-pointer flex justify-between"
            >
              <span>{opt.last_name} {opt.first_name}</span>
              <span className="text-gray-400 dark:text-slate-500 text-xs">{opt.school_class_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Submit form tab ──────────────────────────────────────────────────────────

function SubmitForm() {
  const [date, setDate] = useState(today());
  const [student, setStudent] = useState<YellowListStudentOption | null>(null);
  const [fact, setFact] = useState('');
  const [lesson, setLesson] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) { setError('Выберите ученика из списка.'); return; }
    if (!fact.trim()) { setError('Укажите факт.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/yellow-list/', {
        date,
        student_profile_id: student.student_profile_id,
        fact: fact.trim(),
        lesson: lesson.trim(),
      });
      setSuccess(true);
      setDate(today());
      setStudent(null);
      setFact('');
      setLesson('');
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Ошибка при отправке. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          Заявка успешно подана.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Дата</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Ребёнок</label>
        <StudentSearch value={student} onChange={setStudent} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">На каком уроке</label>
        <input
          type="text"
          value={lesson}
          onChange={e => setLesson(e.target.value)}
          placeholder="Математика, 3-й урок..."
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Факт</label>
        <textarea
          value={fact}
          onChange={e => setFact(e.target.value)}
          rows={5}
          placeholder="Опишите ситуацию подробно..."
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors"
      >
        {loading ? 'Отправка...' : 'Подать заявку'}
      </button>
    </form>
  );
}

// ── Parents info ─────────────────────────────────────────────────────────────

function ParentsInfo({ studentUserId }: { studentUserId: number }) {
  const [parents, setParents] = useState<{ id: number; first_name: string; last_name: string; phone: string; telegram: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  // Reset when student changes
  useEffect(() => {
    setParents([]);
    setLoaded(false);
    setOpen(false);
  }, [studentUserId]);

  const load = async () => {
    if (loaded) { setOpen(v => !v); return; }
    try {
      const res = await api.get(`/school/students/${studentUserId}/parents/`);
      setParents(res.data);
      setLoaded(true);
      setOpen(true);
    } catch { setOpen(v => !v); }
  };

  return (
    <div className="mt-1">
      <button onClick={load} className="text-xs text-purple-600 hover:underline">
        {open ? 'Скрыть родителей' : 'Показать родителей'}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {parents.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500">Родители не указаны</p>
          ) : parents.map(p => (
            <div key={p.id} className="text-xs text-gray-700 dark:text-slate-300">
              <span className="font-medium">{p.last_name} {p.first_name}</span>
              {p.phone && <span className="ml-2 text-gray-500 dark:text-slate-400">{p.phone}</span>}
              {p.telegram && <span className="ml-2 text-purple-500">@{p.telegram}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create task modal ────────────────────────────────────────────────────────

function CreateTaskModal({
  entry,
  onClose,
  onCreated,
}: {
  entry: YellowListEntry;
  onClose: () => void;
  onCreated: () => void;
}) {
  const defaultTitle = `СППС: ${entry.student_name} (${entry.student_class}) — ${formatDate(entry.date)}`;
  const [title, setTitle] = useState(defaultTitle);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      await api.post(`/yellow-list/${entry.id}/create-task/`, {
        title,
        due_date: dueDate || null,
      });
      onCreated();
      onClose();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-800 dark:text-slate-200">Создать задачу</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название задачи</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Срок (необязательно)</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            Отмена
          </button>
          <button
            onClick={create}
            disabled={loading || !title.trim()}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Создаю...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single entry card ─────────────────────────────────────────────────────────

function EntryCard({ entry, onUpdate }: { entry: YellowListEntry; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<YellowListEntry | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [createTaskModal, setCreateTaskModal] = useState(false);

  const expand = async () => {
    if (!expanded) {
      try {
        const res = await api.get(`/yellow-list/${entry.id}/`);
        setDetail(res.data);
        if (!entry.is_read_by_spps) onUpdate();
      } catch { /* ignore */ }
    }
    setExpanded(v => !v);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await api.post(`/yellow-list/${entry.id}/comments/`, { text: commentText });
      setDetail(prev => prev ? { ...prev, comments: [...prev.comments, res.data] } : prev);
      setCommentText('');
    } catch { /* ignore */ }
    finally { setSubmittingComment(false); }
  };

  const current = detail ?? entry;

  return (
    <div className={`border rounded-lg overflow-hidden ${!entry.is_read_by_spps ? 'border-yellow-400 bg-yellow-50/40' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={expand}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-slate-400">{formatDate(entry.date)}</span>
            {entry.lesson && (
              <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">{entry.lesson}</span>
            )}
            {!entry.is_read_by_spps && (
              <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" title="Не прочитано" />
            )}
          </div>
          <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 line-clamp-2">{entry.fact}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Подал(а): {entry.submitted_by_name}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Факт</p>
            <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{current.fact}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Комментарии СППС</p>
            {current.comments.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500">Нет комментариев</p>
            ) : (
              <div className="space-y-2">
                {current.comments.map(c => (
                  <div key={c.id} className="bg-gray-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-slate-400">{c.created_by_name}</p>
                    <p className="text-sm text-gray-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">{c.text}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{formatDate(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                rows={2}
                placeholder="Добавить комментарий..."
                className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
              <button
                onClick={addComment}
                disabled={submittingComment || !commentText.trim()}
                className="px-3 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 disabled:opacity-50 transition-colors self-end"
              >
                ОК
              </button>
            </div>
          </div>

          <button
            onClick={() => setCreateTaskModal(true)}
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Создать задачу
          </button>
        </div>
      )}

      {createTaskModal && (
        <CreateTaskModal
          entry={current}
          onClose={() => setCreateTaskModal(false)}
          onCreated={onUpdate}
        />
      )}
    </div>
  );
}

// ── Two-panel list tab ────────────────────────────────────────────────────────

type GroupedEntries = Record<string, YellowListEntry[]>;

function EntryList() {
  const [entries, setEntries] = useState<YellowListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/yellow-list/');
      setEntries(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by student
  const grouped: GroupedEntries = entries.reduce<GroupedEntries>((acc, e) => {
    const key = `${e.student_user_id}__${e.student_name}__${e.student_class}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const studentKeys = Object.keys(grouped);

  // Auto-select first student (or keep selection valid)
  useEffect(() => {
    if (studentKeys.length > 0 && (!selectedKey || !grouped[selectedKey])) {
      setSelectedKey(studentKeys[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  if (loading) return <div className="text-sm text-gray-400 dark:text-slate-500 py-8 text-center">Загрузка...</div>;
  if (studentKeys.length === 0) return <div className="text-sm text-gray-400 dark:text-slate-500 py-8 text-center">Заявок пока нет</div>;

  const selectedEntries = selectedKey ? (grouped[selectedKey] ?? []) : [];
  const [selUserIdStr, selStudentName, selStudentClass] = selectedKey?.split('__') ?? ['', '', ''];
  const selStudentUserId = Number(selUserIdStr);

  return (
    <div className="flex border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>

      {/* ── Left panel: student list ── */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 overflow-y-auto bg-white dark:bg-slate-800">
        {studentKeys.map(key => {
          const group = grouped[key];
          const [, name, cls] = key.split('__');
          const unread = group.filter(e => !e.is_read_by_spps).length;
          const isSelected = selectedKey === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={[
                'w-full text-left px-3 py-3 border-b border-gray-100 dark:border-slate-700 transition-colors',
                isSelected
                  ? 'bg-yellow-50 border-l-2 border-l-yellow-400'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800 border-l-2 border-l-transparent',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{name}</span>
                {unread > 0 && (
                  <span className="bg-yellow-400 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none flex-shrink-0">
                    {unread}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{cls}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500">{group.length} {group.length === 1 ? 'заявка' : group.length < 5 ? 'заявки' : 'заявок'}</div>
            </button>
          );
        })}
      </div>

      {/* ── Right panel: selected student's entries ── */}
      <div className="flex-1 overflow-y-auto">
        {selectedKey && selectedEntries.length > 0 ? (
          <div className="p-4 space-y-3">
            {/* Student header */}
            <div className="pb-3 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-gray-800 dark:text-slate-200">{selStudentName}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">{selStudentClass}</span>
              </div>
              <ParentsInfo studentUserId={selStudentUserId} />
            </div>

            {/* Entries */}
            <div className="space-y-3">
              {selectedEntries.map(e => (
                <EntryCard key={e.id} entry={e} onUpdate={load} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-slate-500">
            Выберите ученика
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function YellowListPage() {
  const { user } = useAuth();
  const canSeeList = user?.is_spps === true;  // only is_spps, not admin without spps
  const [tab, setTab] = useState<'submit' | 'list'>('submit');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Жёлтый список</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Фиксация инцидентов и наблюдений по ученикам</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setTab('submit')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'submit' ? 'border-yellow-500 text-yellow-700' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
          }`}
        >
          Подать заявку
        </button>
        {canSeeList && (
          <button
            onClick={() => setTab('list')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'list' ? 'border-yellow-500 text-yellow-700' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            Список
          </button>
        )}
      </div>

      {tab === 'submit' && <SubmitForm />}
      {tab === 'list' && canSeeList && <EntryList />}
    </div>
  );
}
