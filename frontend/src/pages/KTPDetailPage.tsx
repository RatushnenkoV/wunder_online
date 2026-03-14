import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { CTPDetail, Topic, SchoolClass, Lesson, Subject } from '../types';
import ContextMenu from '../components/ContextMenu';
import type { MenuItem } from '../components/ContextMenu';

interface ScheduleInfo {
  schedule: { weekday: number; weekday_name: string; lessons_count: number }[];
  total_per_week: number;
  required_count: number;
  has_schedule: boolean;
}

function getDefaultStartDate(): string {
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-09-01`;
}

export default function KTPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ctp, setCtp] = useState<CTPDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [copyClassId, setCopyClassId] = useState(0);
  const [message, setMessage] = useState('');

  // Add topics modal
  const [showAddTopics, setShowAddTopics] = useState(false);
  const [addTopicsText, setAddTopicsText] = useState('');
  const [importingFile, setImportingFile] = useState(false);
  const addTopicsFileRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ topic: Topic; x: number; y: number } | null>(null);

  const [pickerLessons, setPickerLessons] = useState<Lesson[]>([]);

  // CTP meta editing (subject / class / visibility)
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ school_class: 0, subject: 0, is_public: true });
  const [metaSubjects, setMetaSubjects] = useState<Subject[]>([]);

  // Schedule info
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null);

  // Autofill confirmation dialog
  const [showAutofillConfirm, setShowAutofillConfirm] = useState(false);
  const [autofillStartDate, setAutofillStartDate] = useState(getDefaultStartDate());
  const [autofillFromTopicId, setAutofillFromTopicId] = useState<number | null>(null);

  // Drag and drop
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const load = async () => {
    const res = await api.get(`/ktp/${id}/`);
    setCtp(res.data);
  };

  const loadScheduleInfo = async () => {
    try {
      const res = await api.get(`/ktp/${id}/schedule-info/`);
      setScheduleInfo(res.data);
    } catch {
      setScheduleInfo(null);
    }
  };

  useEffect(() => { load(); loadScheduleInfo(); }, [id]);

  // Load lessons for picker when the edit modal is opened (teachers only)
  useEffect(() => {
    if (editTopic && canEdit && pickerLessons.length === 0) {
      api.get('/lessons/lessons/?picker=true').then(r => setPickerLessons(r.data)).catch(() => {});
    }
  }, [editTopic]); // eslint-disable-line

  const isOwner = ctp && user && ctp.teacher === user.id;
  const canEdit = isOwner;
  const canClone = user?.is_teacher || user?.is_admin;

  const handleAddTopicsSubmit = async () => {
    const titles = addTopicsText.split('\n').map(t => t.trim()).filter(Boolean);
    if (!titles.length) return;
    await api.post(`/ktp/${id}/topics/bulk-create/`, { titles });
    setAddTopicsText('');
    setShowAddTopics(false);
    load();
  };

  const handleAddTopicsFile = async (file: File) => {
    setImportingFile(true);
    try {
      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        const titles = text.split('\n').map(t => t.trim()).filter(Boolean);
        await api.post(`/ktp/${id}/topics/bulk-create/`, { titles });
        setMessage(`Импортировано тем: ${titles.length}`);
      } else {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post(`/ktp/${id}/topics/import/`, fd);
        setMessage(`Импортировано тем: ${res.data.created_count}`);
      }
      setShowAddTopics(false);
      load();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка импорта');
    } finally {
      setImportingFile(false);
    }
  };

  const handleBulkDelete = async (topicIds?: number[]) => {
    const ids = topicIds || Array.from(selected);
    if (ids.length === 0) return;
    await api.post(`/ktp/${id}/topics/bulk-delete/`, { topic_ids: ids });
    setSelected(new Set());
    load();
  };

  const handleDuplicate = async (topicIds?: number[]) => {
    const ids = topicIds || Array.from(selected);
    if (ids.length === 0) return;
    await api.post(`/ktp/${id}/topics/duplicate/`, { topic_ids: ids });
    setSelected(new Set());
    load();
  };

  const handleDeleteTopic = async (topic: Topic) => {
    // If this topic is selected and there are multiple selections, delete all selected
    if (selected.has(topic.id) && selected.size > 1) {
      if (!confirm(`Удалить ${selected.size} тем?`)) return;
      await handleBulkDelete();
    } else {
      if (!confirm(`Удалить тему "${topic.title}"?`)) return;
      await api.post(`/ktp/${id}/topics/bulk-delete/`, { topic_ids: [topic.id] });
      load();
    }
  };

  const handleDuplicateTopic = async (topic: Topic) => {
    // If this topic is selected and there are multiple selections, duplicate all selected
    if (selected.has(topic.id) && selected.size > 1) {
      await handleDuplicate();
    } else {
      await handleDuplicate([topic.id]);
    }
  };

  const openEditMeta = () => {
    if (!ctp) return;
    setMetaForm({ school_class: ctp.school_class, subject: ctp.subject, is_public: ctp.is_public });
    // Load classes if not loaded yet
    if (classes.length === 0) {
      api.get('/school/classes/').then(r => setClasses(r.data)).catch(() => {});
    }
    // Load subjects for current class
    api.get(`/school/classes/${ctp.school_class}/schedule-subjects/`).then(r => {
      if (r.data.length > 0) {
        setMetaSubjects(r.data);
      } else {
        api.get('/school/subjects/').then(r2 => setMetaSubjects(r2.data)).catch(() => {});
      }
    }).catch(() => api.get('/school/subjects/').then(r => setMetaSubjects(r.data)).catch(() => {}));
    setShowEditMeta(true);
  };

  const handleUpdateMeta = async () => {
    await api.put(`/ktp/${id}/`, metaForm);
    setShowEditMeta(false);
    load();
    loadScheduleInfo();
  };

  const handleUpdateTopic = async () => {
    if (!editTopic) return;
    await api.put(`/ktp/topics/${editTopic.id}/`, {
      title: editTopic.title,
      date: editTopic.date,
      homework: editTopic.homework,
      resources: editTopic.resources,
      lesson: editTopic.lesson,
      comments: editTopic.comments,
      self_study_links: editTopic.self_study_links,
      additional_resources: editTopic.additional_resources,
      individual_folder: editTopic.individual_folder,
      ksp: editTopic.ksp,
      presentation_link: editTopic.presentation_link,
    });
    setEditTopic(null);
    load();
  };

  // Autofill with schedule data
  const openAutofill = (fromTopicId: number | null = null) => {
    if (!scheduleInfo?.has_schedule) {
      alert('В расписании нет уроков для этого предмета и класса. Добавьте уроки в расписание.');
      return;
    }

    setAutofillFromTopicId(fromTopicId);

    // Smart start date for "from topic"
    if (fromTopicId && ctp) {
      const topics = ctp.topics;
      const topicIdx = topics.findIndex(t => t.id === fromTopicId);
      if (topicIdx > 0) {
        // Find previous topic's date
        const prevTopic = topics[topicIdx - 1];
        if (prevTopic.date) {
          // Next day after previous topic's date
          const prevDate = new Date(prevTopic.date);
          prevDate.setDate(prevDate.getDate() + 1);
          setAutofillStartDate(prevDate.toISOString().slice(0, 10));
        } else {
          setAutofillStartDate(getDefaultStartDate());
        }
      } else {
        setAutofillStartDate(getDefaultStartDate());
      }
    } else {
      setAutofillStartDate(getDefaultStartDate());
    }

    setShowAutofillConfirm(true);
  };

  const handleAutofill = async () => {
    await api.post(`/ktp/${id}/topics/autofill-dates/`, {
      start_date: autofillStartDate,
      start_from_topic_id: autofillFromTopicId,
    });
    setShowAutofillConfirm(false);
    load();
  };

  // Check if "distribute from here" should be disabled (previous topic has no date)
  const canDistributeFromTopic = (topic: Topic): boolean => {
    if (!ctp) return false;
    const topicIdx = ctp.topics.findIndex(t => t.id === topic.id);
    if (topicIdx === 0) return true; // First topic, always allowed
    const prevTopic = ctp.topics[topicIdx - 1];
    return prevTopic.date !== null;
  };

  const handleCopy = async () => {
    if (!copyClassId) return;
    const res = await api.post(`/ktp/${id}/copy/`, { school_class: copyClassId });
    navigate(`/ktp/${res.data.id}`);
  };

  const handleDeleteCtp = async () => {
    if (!confirm('Удалить КТП?')) return;
    await api.delete(`/ktp/${id}/`);
    navigate('/ktp');
  };

  const toggleSelect = (topicId: number) => {
    const next = new Set(selected);
    if (next.has(topicId)) next.delete(topicId);
    else next.add(topicId);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (!ctp) return;
    if (selected.size === ctp.topics.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ctp.topics.map(t => t.id)));
    }
  };

  type LinkField = 'self_study_links' | 'additional_resources' | 'individual_folder';

  const addLink = (field: LinkField) => {
    if (!editTopic) return;
    setEditTopic({ ...editTopic, [field]: [...editTopic[field], { title: '', url: '' }] });
  };

  const updateLink = (field: LinkField, idx: number, key: 'title' | 'url', value: string) => {
    if (!editTopic) return;
    const arr = [...editTopic[field]];
    arr[idx] = { ...arr[idx], [key]: value };
    setEditTopic({ ...editTopic, [field]: arr });
  };

  const removeLink = (field: LinkField, idx: number) => {
    if (!editTopic) return;
    setEditTopic({ ...editTopic, [field]: editTopic[field].filter((_, i) => i !== idx) });
  };

  type LinkField = 'self_study_links' | 'additional_resources' | 'individual_folder';

  const addLink = (field: LinkField) => {
    if (!editTopic) return;
    setEditTopic({ ...editTopic, [field]: [...editTopic[field], { title: '', url: '' }] });
  };

  const updateLink = (field: LinkField, idx: number, key: 'title' | 'url', value: string) => {
    if (!editTopic) return;
    const arr = [...editTopic[field]];
    arr[idx] = { ...arr[idx], [key]: value };
    setEditTopic({ ...editTopic, [field]: arr });
  };

  const removeLink = (field: LinkField, idx: number) => {
    if (!editTopic) return;
    setEditTopic({ ...editTopic, [field]: editTopic[field].filter((_, i) => i !== idx) });
  };

  // --- Drag and drop reorder ---
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleRowDragEnter = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOverIdx(idx);
  };

  const handleRowDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragOverIdx(null);
      dragCounter.current = 0;
    }
  };

  const handleRowDrop = async (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIdx(null);
    if (dragIdx === null || dragIdx === toIdx || !ctp) {
      setDragIdx(null);
      return;
    }
    const topics = [...ctp.topics];
    const [moved] = topics.splice(dragIdx, 1);
    topics.splice(toIdx, 0, moved);
    // Optimistic UI update
    setCtp({ ...ctp, topics });
    setDragIdx(null);
    await api.post(`/ktp/${id}/topics/reorder/`, { topic_ids: topics.map(t => t.id) });
    load();
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
    dragCounter.current = 0;
  };

  // --- Context menu ---
  const openContextMenu = (topic: Topic, x: number, y: number) => {
    setCtxMenu({ topic, x, y });
  };

  const getMenuItems = (topic: Topic): MenuItem[] => {
    const items: MenuItem[] = [];
    if (canEdit) {
      items.push({ label: 'Редактировать', onClick: () => setEditTopic({ ...topic }) });
      items.push({ label: 'Дублировать' + (selected.has(topic.id) && selected.size > 1 ? ` (${selected.size})` : ''), onClick: () => handleDuplicateTopic(topic) });

      const canDistribute = canDistributeFromTopic(topic);
      if (canDistribute) {
        items.push({ label: 'Распределить даты отсюда', onClick: () => openAutofill(topic.id) });
      }

      items.push({
        label: 'Удалить' + (selected.has(topic.id) && selected.size > 1 ? ` (${selected.size})` : ''),
        onClick: () => handleDeleteTopic(topic),
        danger: true,
      });
    } else {
      items.push({ label: 'Просмотр', onClick: () => setEditTopic({ ...topic }) });
    }
    return items;
  };

  if (!ctp) return <p className="text-center text-gray-400 dark:text-slate-500 py-8">Загрузка...</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{ctp.subject_name}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-gray-500 dark:text-slate-400 text-sm flex-1 min-w-0">
            {ctp.class_name} | Учитель: {ctp.teacher_name}
            {!ctp.is_public && <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded">Скрытый</span>}
          </p>
          <div className="flex gap-1.5 items-center shrink-0">
            {canEdit && (
              <button onClick={openEditMeta} className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-1.5 rounded text-sm hover:bg-gray-200 dark:hover:bg-slate-600" title="Редактировать">
                <span>✏️</span><span className="hidden sm:inline">Редактировать</span>
              </button>
            )}
            {canClone && (
              <button onClick={() => { setShowCopy(true); api.get('/school/classes/').then(r => setClasses(r.data)); }} className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-1.5 rounded text-sm hover:bg-gray-200 dark:hover:bg-slate-600">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor"><rect x="5" y="5" width="8" height="9" rx="1" opacity="0.5"/><rect x="3" y="2" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                <span className="hidden sm:inline">Клонировать</span>
              </button>
            )}
            {canEdit && (
              <button onClick={() => setShowAddTopics(true)} className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-1.5 rounded text-sm hover:bg-purple-700">
                <span>+</span><span className="hidden sm:inline">Добавить тему</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-purple-50 text-purple-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-purple-400">x</button>
        </div>
      )}

      {/* Copy modal */}
      {showCopy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCopy(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Клонировать КТП</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{ctp.subject_name} — {ctp.class_name}</p>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Целевой класс</label>
            <select value={copyClassId} onChange={e => setCopyClassId(parseInt(e.target.value))} className="border rounded px-3 py-2 text-sm w-full mb-4">
              <option value={0}>Выберите класс</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCopy(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">Отмена</button>
              <button onClick={handleCopy} disabled={!copyClassId} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">Клонировать</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk actions (shown when topics are selected) */}
      {canEdit && selected.size > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => handleDuplicate()} className="bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-3 py-2 rounded text-sm hover:bg-gray-300">Дублировать ({selected.size})</button>
          <button onClick={() => handleBulkDelete()} className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-200">Удалить ({selected.size})</button>
        </div>
      )}

      {/* Topic count vs required */}
      {scheduleInfo && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-slate-400">Тем создано:</span>
            <span className={`font-semibold ${
              scheduleInfo.required_count > 0 && ctp.topics.length >= scheduleInfo.required_count
                ? 'text-green-600'
                : scheduleInfo.required_count > 0
                  ? 'text-amber-600'
                  : ''
            }`}>
              {ctp.topics.length}
              {scheduleInfo.required_count > 0 && (
                <span className="text-gray-400 dark:text-slate-500 font-normal"> / {scheduleInfo.required_count}</span>
              )}
            </span>
          </div>
          {scheduleInfo.has_schedule && (
            <div className="text-gray-400 dark:text-slate-500">
              В неделю: {scheduleInfo.total_per_week} ур.
              ({scheduleInfo.schedule.map(s => `${s.weekday_name} ${s.lessons_count > 1 ? `×${s.lessons_count}` : ''}`).join(', ').replace(/ ,/g, ',')})
            </div>
          )}
          {!scheduleInfo.has_schedule && (
            <div className="text-amber-500">
              Расписание не найдено для этого предмета
            </div>
          )}
        </div>
      )}

      {/* Topics table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm md:min-w-[900px]">
          <thead className="bg-gray-50 dark:bg-slate-900">
            <tr>
              {canEdit && (
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={ctp.topics.length > 0 && selected.size === ctp.topics.length} onChange={toggleSelectAll} />
                </th>
              )}
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-slate-400 w-10">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400 min-w-[160px]">Тема</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400 w-28">
                <div className="flex items-center gap-1">
                  <span>Дата</span>
                  {canEdit && (
                    <button
                      onClick={() => openAutofill()}
                      className="text-purple-500 hover:text-purple-700 text-xs rounded px-1 py-0.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 leading-none"
                      title="Распределить даты"
                    >📅</button>
                  )}
                </div>
              </th>
              <th className="px-2 py-3 text-center font-medium text-gray-600 dark:text-slate-400 w-10 hidden md:table-cell" title="Домашнее задание">ДЗ</th>
              <th className="px-2 py-3 text-center font-medium text-gray-600 dark:text-slate-400 w-10 hidden md:table-cell" title="Комментарии">💬</th>
              <th className="px-2 py-3 text-center font-medium text-gray-600 dark:text-slate-400 w-10 hidden md:table-cell" title="Ссылки на самообучение">📚</th>
              <th className="px-2 py-3 text-center font-medium text-gray-600 dark:text-slate-400 w-10 hidden md:table-cell" title="Дополнительные ресурсы">🔗</th>
              <th className="px-2 py-3 text-center font-medium text-gray-600 dark:text-slate-400 w-10 hidden md:table-cell" title="Индивид. папка ученика">📁</th>
              <th className="px-2 py-3 text-center font-medium text-gray-600 dark:text-slate-400 w-10 hidden md:table-cell" title="КСП">📋</th>
              <th className="px-2 py-3 text-center font-medium text-gray-600 dark:text-slate-400 w-10 hidden md:table-cell" title="Ссылка на презентацию">🖥️</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ctp.topics.map((topic, idx) => (
              <tr
                key={topic.id}
                draggable={!!canEdit}
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleRowDragOver(e, idx)}
                onDragEnter={e => handleRowDragEnter(e, idx)}
                onDragLeave={handleRowDragLeave}
                onDrop={e => handleRowDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onContextMenu={e => { e.preventDefault(); openContextMenu(topic, e.clientX, e.clientY); }}
                className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition ${
                  selected.has(topic.id) ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                } ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-purple-400' : ''} ${
                  dragIdx === idx ? 'opacity-30' : ''
                } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {canEdit && (
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(topic.id)} onChange={() => toggleSelect(topic.id)} />
                  </td>
                )}
                <td className="px-3 py-2 text-gray-400 dark:text-slate-500">{idx + 1}</td>
                <td className="px-4 py-2">
                  <button onClick={() => setEditTopic({ ...topic })} className="text-left hover:text-purple-600 w-full">
                    {topic.title}
                  </button>
                  {topic.lesson_title && (
                    <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 dark:bg-purple-900/20 rounded px-1.5 py-0.5 mt-0.5">
                      📖 {topic.lesson_title}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500 dark:text-slate-400 whitespace-nowrap">{topic.date || '—'}</td>
                <td className="px-2 py-2 text-center hidden md:table-cell">
                  {topic.homework ? <span className="text-green-600">✓</span> : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-center hidden md:table-cell">
                  {topic.comments ? <span className="text-blue-500">✓</span> : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-center hidden md:table-cell">
                  {topic.self_study_links.length > 0 ? (
                    <span className="text-purple-500 text-xs font-medium">{topic.self_study_links.length}</span>
                  ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-center hidden md:table-cell">
                  {topic.additional_resources.length > 0 ? (
                    <span className="text-purple-500 text-xs font-medium">{topic.additional_resources.length}</span>
                  ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-center hidden md:table-cell">
                  {topic.individual_folder.length > 0 ? (
                    <span className="text-purple-500 text-xs font-medium">{topic.individual_folder.length}</span>
                  ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-center hidden md:table-cell">
                  {topic.ksp ? (
                    <a href={topic.ksp} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-700" onClick={e => e.stopPropagation()}>↗</a>
                  ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-center hidden md:table-cell">
                  {topic.presentation_link ? (
                    <a href={topic.presentation_link} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-700" onClick={e => e.stopPropagation()}>↗</a>
                  ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={e => { e.stopPropagation(); openContextMenu(topic, e.clientX, e.clientY); }}
                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                  >&#8942;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ctp.topics.length === 0 && (
          <p className="text-center text-gray-400 dark:text-slate-500 py-8">Темы не добавлены</p>
        )}
      </div>

      {/* Delete button at bottom */}
      {canEdit && (
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-slate-700">
          <button onClick={handleDeleteCtp} className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-sm hover:text-red-800 hover:underline">
            <span>🗑️</span><span>Удалить КТП</span>
          </button>
        </div>
      )}

      {/* Add topics modal */}
      {showAddTopics && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddTopics(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Добавить темы</h3>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Каждая строка — отдельная тема</label>
            <textarea
              value={addTopicsText}
              onChange={e => setAddTopicsText(e.target.value)}
              rows={7}
              className="w-full border rounded px-3 py-2 text-sm mb-4 resize-none dark:bg-slate-700 dark:border-slate-600"
              placeholder={"Тема 1\nТема 2\nТема 3"}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className={`bg-green-600 text-white px-3 py-2 rounded text-sm cursor-pointer hover:bg-green-700 flex items-center gap-1.5 ${importingFile ? 'opacity-60 pointer-events-none' : ''}`}>
                <span>📥</span>
                <span>{importingFile ? 'Импорт...' : 'Импорт из файла'}</span>
                <input
                  ref={addTopicsFileRef}
                  type="file"
                  accept=".txt,.csv,.xlsx"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAddTopicsFile(f); e.target.value = ''; }}
                />
              </label>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddTopics(false); setAddTopicsText(''); }} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">Отмена</button>
                <button
                  onClick={handleAddTopicsSubmit}
                  disabled={!addTopicsText.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit CTP meta modal */}
      {showEditMeta && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowEditMeta(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Настройки КТП</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Класс</label>
                <select
                  value={metaForm.school_class}
                  onChange={async e => {
                    const classId = parseInt(e.target.value);
                    setMetaForm(f => ({ ...f, school_class: classId, subject: 0 }));
                    try {
                      const r = await api.get(`/school/classes/${classId}/schedule-subjects/`);
                      setMetaSubjects(r.data.length > 0 ? r.data : (await api.get('/school/subjects/')).data);
                    } catch { setMetaSubjects([]); }
                  }}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  {classes.length === 0 && <option value={metaForm.school_class}>{ctp.class_name}</option>}
                  {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Предмет</label>
                <select
                  value={metaForm.subject}
                  onChange={e => setMetaForm(f => ({ ...f, subject: parseInt(e.target.value) }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  {metaSubjects.length === 0 && <option value={metaForm.subject}>{ctp.subject_name}</option>}
                  {metaSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={metaForm.is_public} onChange={e => setMetaForm(f => ({ ...f, is_public: e.target.checked }))} />
                Публичный
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowEditMeta(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">Отмена</button>
              <button onClick={handleUpdateMeta} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.topic)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Autofill confirmation dialog */}
      {showAutofillConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowAutofillConfirm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Распределить даты</h3>

            {scheduleInfo && (
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                По расписанию: {scheduleInfo.schedule.map(s =>
                  `${s.weekday_name}${s.lessons_count > 1 ? ` ×${s.lessons_count}` : ''}`
                ).join(', ')}
                {' '}({scheduleInfo.total_per_week} ур./нед.)
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Дата начала</label>
              <input
                type="date"
                value={autofillStartDate}
                onChange={e => setAutofillStartDate(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>

            {autofillFromTopicId && ctp && (
              <div className="bg-purple-50 text-purple-700 text-sm p-3 rounded mb-4">
                Начиная с темы: #{ctp.topics.findIndex(t => t.id === autofillFromTopicId) + 1} {ctp.topics.find(t => t.id === autofillFromTopicId)?.title}
              </div>
            )}

            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              Вы действительно хотите {autofillFromTopicId ? 'распределить' : 'изменить'} даты
              {autofillFromTopicId ? ' начиная с указанной темы' : ''} с <strong>{autofillStartDate}</strong> до конца учебного года?
              Выходные дни из настроек будут пропущены.
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAutofillConfirm(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                Отмена
              </button>
              <button
                onClick={handleAutofill}
                disabled={!autofillStartDate}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                Распределить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit topic modal */}
      {editTopic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditTopic(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            {canEdit ? (
              <>
                <h3 className="text-lg font-semibold mb-4">Редактирование темы</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Тема</label>
                    <input value={editTopic.title} onChange={e => setEditTopic({ ...editTopic, title: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Дата</label>
                    <input type="date" value={editTopic.date || ''} onChange={e => setEditTopic({ ...editTopic, date: e.target.value || null })} className="border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Комментарии</label>
                    <textarea value={editTopic.comments} onChange={e => setEditTopic({ ...editTopic, comments: e.target.value })} rows={3} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Домашнее задание</label>
                    <textarea value={editTopic.homework} onChange={e => setEditTopic({ ...editTopic, homework: e.target.value })} rows={3} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  {(['self_study_links', 'additional_resources', 'individual_folder'] as const).map(field => {
                    const labels: Record<string, string> = {
                      self_study_links: 'Ссылки на самообучение',
                      additional_resources: 'Дополнительные ресурсы',
                      individual_folder: 'Индивид. папка ученика',
                    };
                    return (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{labels[field]}</label>
                        {editTopic[field].map((r, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input placeholder="Название" value={r.title} onChange={e => updateLink(field, i, 'title', e.target.value)} className="border rounded px-3 py-2 text-sm flex-1" />
                            <input placeholder="URL" value={r.url} onChange={e => updateLink(field, i, 'url', e.target.value)} className="border rounded px-3 py-2 text-sm flex-1" />
                            <button onClick={() => removeLink(field, i)} className="text-red-400 hover:text-red-600">×</button>
                          </div>
                        ))}
                        <button onClick={() => addLink(field)} className="text-purple-600 hover:text-purple-800 text-sm">+ Добавить ссылку</button>
                      </div>
                    );
                  })}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">КСП</label>
                    <input value={editTopic.ksp} onChange={e => setEditTopic({ ...editTopic, ksp: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Ссылка на презентацию</label>
                    <input value={editTopic.presentation_link} onChange={e => setEditTopic({ ...editTopic, presentation_link: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Прикреплённый урок</label>
                    <select
                      value={editTopic.lesson ?? ''}
                      onChange={e => setEditTopic({ ...editTopic, lesson: e.target.value ? Number(e.target.value) : null, lesson_title: pickerLessons.find(l => l.id === Number(e.target.value))?.title ?? null })}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="">— не привязан —</option>
                      {pickerLessons.filter(l => l.is_owner).length > 0 && (
                        <optgroup label="Мои уроки">
                          {pickerLessons.filter(l => l.is_owner).map(l => (
                            <option key={l.id} value={l.id}>{l.folder_name ? `[${l.folder_name}] ` : ''}{l.title}</option>
                          ))}
                        </optgroup>
                      )}
                      {pickerLessons.filter(l => !l.is_owner).length > 0 && (
                        <optgroup label="Уроки школы">
                          {pickerLessons.filter(l => !l.is_owner).map(l => (
                            <option key={l.id} value={l.id}>{l.owner_name}: {l.title}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Файлы</label>
                    {editTopic.files.map(f => (
                      <div key={f.id} className="flex items-center gap-2 mb-1 text-sm">
                        <a href={f.file} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800 truncate">{f.original_name}</a>
                        <button onClick={async () => { await api.delete(`/ktp/topics/${editTopic.id}/files/${f.id}/`); const res = await api.get(`/ktp/${id}/`); setCtp(res.data); const updated = res.data.topics.find((t: Topic) => t.id === editTopic.id); if (updated) setEditTopic({ ...updated }); }} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                      </div>
                    ))}
                    <label className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 text-sm cursor-pointer mt-1">
                      + Прикрепить файл
                      <input type="file" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append('file', file); await api.post(`/ktp/topics/${editTopic.id}/files/`, fd); const res = await api.get(`/ktp/${id}/`); setCtp(res.data); const updated = res.data.topics.find((t: Topic) => t.id === editTopic.id); if (updated) setEditTopic({ ...updated }); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => setEditTopic(null)} className="px-4 py-2 rounded text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700">Отмена</button>
                  <button onClick={handleUpdateTopic} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">Сохранить</button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    {editTopic.date && <span className="text-sm text-gray-500 dark:text-slate-400 shrink-0">{editTopic.date}</span>}
                    {editTopic.date && <span className="text-gray-300 dark:text-slate-600">—</span>}
                    <h3 className="text-lg font-semibold">{editTopic.title}</h3>
                  </div>
                </div>
                <div className="space-y-4">
                  {editTopic.homework && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Домашнее задание</label>
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{editTopic.homework}</p>
                    </div>
                  )}
                  {editTopic.resources.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Материалы</label>
                      <ul className="space-y-1">
                        {editTopic.resources.map((r, i) => (
                          <li key={i}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:text-purple-800 hover:underline">
                              {r.title || r.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {editTopic.lesson_title && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Урок</label>
                      <a href={`/lessons/editor/${editTopic.lesson}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800">
                        📖 {editTopic.lesson_title}
                      </a>
                    </div>
                  )}
                  {(['self_study_links', 'additional_resources', 'individual_folder'] as const).map(field => {
                    const labels: Record<string, string> = {
                      self_study_links: 'Ссылки на самообучение',
                      additional_resources: 'Дополнительные ресурсы',
                      individual_folder: 'Индивид. папка ученика',
                    };
                    const links = editTopic[field];
                    if (links.length === 0) return null;
                    return (
                      <div key={field}>
                        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">{labels[field]}</label>
                        <ul className="space-y-1">
                          {links.map((r, i) => (
                            <li key={i}>
                              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:text-purple-800 hover:underline">
                                {r.title || r.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {editTopic.files.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Файлы</label>
                      <ul className="space-y-1">
                        {editTopic.files.map(f => (
                          <li key={f.id}>
                            <a href={f.file} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:text-purple-800 hover:underline">
                              {f.original_name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!editTopic.homework && editTopic.resources.length === 0 && editTopic.files.length === 0 &&
                   editTopic.self_study_links.length === 0 && editTopic.additional_resources.length === 0 && editTopic.individual_folder.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-slate-500">Нет дополнительной информации</p>
                  )}
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={() => setEditTopic(null)} className="px-4 py-2 rounded text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700">Закрыть</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
