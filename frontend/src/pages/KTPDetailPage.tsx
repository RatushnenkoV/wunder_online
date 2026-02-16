import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { CTPDetail, Topic, TopicFile, SchoolClass } from '../types';
import ContextMenu from '../components/ContextMenu';
import type { MenuItem } from '../components/ContextMenu';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function KTPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ctp, setCtp] = useState<CTPDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [bulkTitles, setBulkTitles] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [showAutofill, setShowAutofill] = useState(false);
  const [autofill, setAutofill] = useState({ start_date: '', weekdays: [] as number[], lessons_per_day: 1, start_from_topic_id: null as number | null });
  const [showCopy, setShowCopy] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [copyClassId, setCopyClassId] = useState(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ topic: Topic; x: number; y: number } | null>(null);

  // Drag and drop
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const load = async () => {
    const res = await api.get(`/ktp/${id}/`);
    setCtp(res.data);
  };

  useEffect(() => { load(); }, [id]);

  const isOwner = ctp && user && ctp.teacher === user.id;
  const canEdit = isOwner;

  const handleAddTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await api.post(`/ktp/${id}/topics/`, { title: newTitle.trim() });
    setNewTitle('');
    load();
  };

  const handleBulkCreate = async () => {
    const titles = bulkTitles.split('\n').map(t => t.trim()).filter(Boolean);
    if (titles.length === 0) return;
    await api.post(`/ktp/${id}/topics/bulk-create/`, { titles });
    setBulkTitles('');
    setShowBulk(false);
    load();
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    await api.post(`/ktp/${id}/topics/bulk-delete/`, { topic_ids: Array.from(selected) });
    setSelected(new Set());
    load();
  };

  const handleDuplicate = async () => {
    if (selected.size === 0) return;
    await api.post(`/ktp/${id}/topics/duplicate/`, { topic_ids: Array.from(selected) });
    setSelected(new Set());
    load();
  };

  const handleDeleteTopic = async (topic: Topic) => {
    if (!confirm(`Удалить тему "${topic.title}"?`)) return;
    await api.post(`/ktp/${id}/topics/bulk-delete/`, { topic_ids: [topic.id] });
    load();
  };

  const handleUpdateTopic = async () => {
    if (!editTopic) return;
    await api.put(`/ktp/topics/${editTopic.id}/`, {
      title: editTopic.title,
      date: editTopic.date,
      homework: editTopic.homework,
      resources: editTopic.resources,
    });
    setEditTopic(null);
    load();
  };

  const handleAutofill = async () => {
    await api.post(`/ktp/${id}/topics/autofill-dates/`, autofill);
    setShowAutofill(false);
    load();
  };

  const openAutofillFrom = (topic: Topic) => {
    setAutofill(a => ({ ...a, start_from_topic_id: topic.id }));
    setShowAutofill(true);
  };

  const handleCopy = async () => {
    if (!copyClassId) return;
    const res = await api.post(`/ktp/${id}/copy/`, { school_class: copyClassId });
    navigate(`/ktp/${res.data.id}`);
  };

  const handleImportTopics = async () => {
    if (!importFile) return;
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const res = await api.post(`/ktp/${id}/topics/import/`, fd);
      setMessage(`Импортировано тем: ${res.data.created_count}`);
      setImportFile(null);
      load();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка импорта');
    }
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

  const toggleWeekday = (day: number) => {
    setAutofill(a => ({
      ...a,
      weekdays: a.weekdays.includes(day) ? a.weekdays.filter(d => d !== day) : [...a.weekdays, day],
    }));
  };

  const addResource = () => {
    if (!editTopic) return;
    setEditTopic({ ...editTopic, resources: [...editTopic.resources, { title: '', url: '' }] });
  };

  const updateResource = (idx: number, field: 'title' | 'url', value: string) => {
    if (!editTopic) return;
    const resources = [...editTopic.resources];
    resources[idx] = { ...resources[idx], [field]: value };
    setEditTopic({ ...editTopic, resources });
  };

  const removeResource = (idx: number) => {
    if (!editTopic) return;
    setEditTopic({ ...editTopic, resources: editTopic.resources.filter((_, i) => i !== idx) });
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
      items.push({ label: 'Заполнить даты отсюда', onClick: () => openAutofillFrom(topic) });
      items.push({ label: 'Редактировать', onClick: () => setEditTopic({ ...topic }) });
      items.push({ label: 'Удалить', onClick: () => handleDeleteTopic(topic), danger: true });
    } else {
      items.push({ label: 'Просмотр', onClick: () => setEditTopic({ ...topic }) });
    }
    return items;
  };

  if (!ctp) return <p className="text-center text-gray-400 py-8">Загрузка...</p>;

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{ctp.subject_name}</h1>
          <p className="text-gray-500">
            {ctp.class_name} | Учитель: {ctp.teacher_name}
            {!ctp.is_public && <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded">Скрытый</span>}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => { setShowCopy(true); api.get('/school/classes/').then(r => setClasses(r.data)); }} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">
              Копировать
            </button>
            <button onClick={handleDeleteCtp} className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-200">
              Удалить КТП
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-blue-400">x</button>
        </div>
      )}

      {/* Copy dialog */}
      {showCopy && (
        <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Копировать в класс</label>
            <select value={copyClassId} onChange={e => setCopyClassId(parseInt(e.target.value))} className="border rounded px-3 py-2 text-sm">
              <option value={0}>Выберите класс</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
          <button onClick={handleCopy} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Копировать</button>
          <button onClick={() => setShowCopy(false)} className="text-gray-400 hover:text-gray-600 text-sm">Отмена</button>
        </div>
      )}

      {/* Toolbar */}
      {canEdit && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <form onSubmit={handleAddTopic} className="flex gap-2 flex-1">
            <input placeholder="Новая тема..." value={newTitle} onChange={e => setNewTitle(e.target.value)} className="border rounded px-3 py-2 text-sm flex-1" />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+</button>
          </form>
          <button onClick={() => setShowBulk(!showBulk)} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">Пакетно</button>
          <label className="bg-green-600 text-white px-3 py-2 rounded text-sm cursor-pointer hover:bg-green-700">
            Импорт
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={e => { setImportFile(e.target.files?.[0] || null); }} />
          </label>
          {importFile && <button onClick={handleImportTopics} className="bg-green-700 text-white px-3 py-2 rounded text-sm">{importFile.name}</button>}
          <button onClick={() => setShowAutofill(!showAutofill)} className="bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700">Автозаполнение дат</button>
          {selected.size > 0 && (
            <>
              <button onClick={handleDuplicate} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm">Дублировать ({selected.size})</button>
              <button onClick={handleBulkDelete} className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm">Удалить ({selected.size})</button>
            </>
          )}
        </div>
      )}

      {/* Bulk create */}
      {showBulk && canEdit && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Каждая строка — отдельная тема</label>
          <textarea value={bulkTitles} onChange={e => setBulkTitles(e.target.value)} rows={6} className="w-full border rounded px-3 py-2 text-sm mb-2" placeholder={"Тема 1\nТема 2\nТема 3"} />
          <button onClick={handleBulkCreate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Добавить все</button>
        </div>
      )}

      {/* Autofill dates */}
      {showAutofill && canEdit && (
        <div className="bg-white p-4 rounded-lg shadow mb-4 space-y-3">
          <h3 className="font-semibold text-sm">Автозаполнение дат</h3>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Дата начала</label>
              <input type="date" value={autofill.start_date} onChange={e => setAutofill(a => ({ ...a, start_date: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Уроков в день</label>
              <input type="number" min={1} max={5} value={autofill.lessons_per_day} onChange={e => setAutofill(a => ({ ...a, lessons_per_day: parseInt(e.target.value) || 1 }))} className="border rounded px-3 py-2 text-sm w-20" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Начиная с темы</label>
              <select value={autofill.start_from_topic_id ?? ''} onChange={e => setAutofill(a => ({ ...a, start_from_topic_id: e.target.value ? parseInt(e.target.value) : null }))} className="border rounded px-3 py-2 text-sm">
                <option value="">С начала</option>
                {ctp.topics.map(t => <option key={t.id} value={t.id}>#{t.order + 1} {t.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Дни недели</label>
            <div className="flex gap-2">
              {WEEKDAYS.map((name, idx) => (
                <button key={idx} onClick={() => toggleWeekday(idx)} className={`px-3 py-1 rounded text-sm ${autofill.weekdays.includes(idx) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {name}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAutofill} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">Заполнить</button>
        </div>
      )}

      {/* Topics table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {canEdit && (
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={ctp.topics.length > 0 && selected.size === ctp.topics.length} onChange={toggleSelectAll} />
                </th>
              )}
              <th className="px-3 py-3 text-left font-medium text-gray-600 w-12">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Тема</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">Дата</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-10">ДЗ</th>
              <th className="w-10"></th>
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
                className={`hover:bg-gray-50 transition ${
                  selected.has(topic.id) ? 'bg-blue-50' : ''
                } ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-blue-400' : ''} ${
                  dragIdx === idx ? 'opacity-30' : ''
                } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {canEdit && (
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(topic.id)} onChange={() => toggleSelect(topic.id)} />
                  </td>
                )}
                <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-4 py-2">
                  <button onClick={() => setEditTopic({ ...topic })} className="text-left hover:text-blue-600 w-full">
                    {topic.title}
                  </button>
                </td>
                <td className="px-4 py-2 text-gray-500">{topic.date || '—'}</td>
                <td className="px-4 py-2">
                  {topic.homework ? <span className="text-green-600">+</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={e => { e.stopPropagation(); openContextMenu(topic, e.clientX, e.clientY); }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                  >&#8942;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ctp.topics.length === 0 && (
          <p className="text-center text-gray-400 py-8">Темы не добавлены</p>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.topic)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Edit topic modal */}
      {editTopic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditTopic(null)}>
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            {canEdit ? (
              <>
                <h3 className="text-lg font-semibold mb-4">Редактирование темы</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Тема</label>
                    <input value={editTopic.title} onChange={e => setEditTopic({ ...editTopic, title: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                    <input type="date" value={editTopic.date || ''} onChange={e => setEditTopic({ ...editTopic, date: e.target.value || null })} className="border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Домашнее задание</label>
                    <textarea value={editTopic.homework} onChange={e => setEditTopic({ ...editTopic, homework: e.target.value })} rows={3} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ссылки на материалы</label>
                    {editTopic.resources.map((r, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input placeholder="Название" value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} className="border rounded px-3 py-2 text-sm flex-1" />
                        <input placeholder="URL" value={r.url} onChange={e => updateResource(i, 'url', e.target.value)} className="border rounded px-3 py-2 text-sm flex-1" />
                        <button onClick={() => removeResource(i)} className="text-red-400 hover:text-red-600">x</button>
                      </div>
                    ))}
                    <button onClick={addResource} className="text-blue-600 hover:text-blue-800 text-sm">+ Добавить ссылку</button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Файлы</label>
                    {editTopic.files.map(f => (
                      <div key={f.id} className="flex items-center gap-2 mb-1 text-sm">
                        <a href={f.file} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 truncate">{f.original_name}</a>
                        <button onClick={async () => { await api.delete(`/ktp/topics/${editTopic.id}/files/${f.id}/`); const res = await api.get(`/ktp/${id}/`); setCtp(res.data); const updated = res.data.topics.find((t: Topic) => t.id === editTopic.id); if (updated) setEditTopic({ ...updated }); }} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                      </div>
                    ))}
                    <label className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm cursor-pointer mt-1">
                      + Прикрепить файл
                      <input type="file" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append('file', file); await api.post(`/ktp/topics/${editTopic.id}/files/`, fd); const res = await api.get(`/ktp/${id}/`); setCtp(res.data); const updated = res.data.topics.find((t: Topic) => t.id === editTopic.id); if (updated) setEditTopic({ ...updated }); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => setEditTopic(null)} className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100">Отмена</button>
                  <button onClick={handleUpdateTopic} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Сохранить</button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    {editTopic.date && <span className="text-sm text-gray-500 shrink-0">{editTopic.date}</span>}
                    {editTopic.date && <span className="text-gray-300">—</span>}
                    <h3 className="text-lg font-semibold">{editTopic.title}</h3>
                  </div>
                </div>
                <div className="space-y-4">
                  {editTopic.homework && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Домашнее задание</label>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{editTopic.homework}</p>
                    </div>
                  )}
                  {editTopic.resources.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Материалы</label>
                      <ul className="space-y-1">
                        {editTopic.resources.map((r, i) => (
                          <li key={i}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                              {r.title || r.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {editTopic.files.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Файлы</label>
                      <ul className="space-y-1">
                        {editTopic.files.map(f => (
                          <li key={f.id}>
                            <a href={f.file} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                              {f.original_name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!editTopic.homework && editTopic.resources.length === 0 && editTopic.files.length === 0 && (
                    <p className="text-sm text-gray-400">Нет дополнительной информации</p>
                  )}
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={() => setEditTopic(null)} className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100">Закрыть</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
