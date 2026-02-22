import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Parent, ParentChild, SchoolClass } from '../types';
import ContextMenu from './ContextMenu';
import type { MenuItem } from './ContextMenu';

interface ParentForm {
  last_name: string;
  first_name: string;
  email: string;
  phone: string;
  telegram: string;
  birth_date: string;
}

interface StudentResult {
  id: number;
  first_name: string;
  last_name: string;
  school_class_id: number | null;
  school_class_name: string;
  student_profile_id: number | null;
}

const emptyForm = (): ParentForm => ({
  last_name: '', first_name: '', email: '', phone: '', telegram: '', birth_date: '',
});

export default function ParentsTab() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ parent: Parent; x: number; y: number } | null>(null);
  const [message, setMessage] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ParentForm>(emptyForm());
  const [childSearch, setChildSearch] = useState('');
  const [childSearchResults, setChildSearchResults] = useState<StudentResult[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<ParentChild[]>([]);

  // Edit modal
  const [editParent, setEditParent] = useState<Parent | null>(null);
  const [editForm, setEditForm] = useState<ParentForm>(emptyForm());
  const [editChildSearch, setEditChildSearch] = useState('');
  const [editChildResults, setEditChildResults] = useState<StudentResult[]>([]);
  const [editChildren, setEditChildren] = useState<ParentChild[]>([]);

  // Cross-nav: student card from parent card
  const [crossNavStudent, setCrossNavStudent] = useState<ParentChild | null>(null);
  const [crossNavStudentParents, setCrossNavStudentParents] = useState<Parent[]>([]);
  const [crossNavStudentForm, setCrossNavStudentForm] = useState({ first_name: '', last_name: '', email: '', phone: '', birth_date: '', school_class: '' as string | number });
  const [crossNavClasses, setCrossNavClasses] = useState<SchoolClass[]>([]);

  const load = useCallback(async (page = pagination.page) => {
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(pagination.per_page),
    };
    if (search) params.search = search;
    const res = await api.get('/admin/parents/', { params });
    setParents(res.data.results);
    setPagination(res.data.pagination);
  }, [search, pagination.per_page, pagination.page]);

  useEffect(() => { load(1); }, [search, pagination.per_page]);

  useEffect(() => {
    api.get('/school/classes/').then(r => setCrossNavClasses(r.data));
  }, []);

  const searchStudents = async (q: string, setter: (r: StudentResult[]) => void) => {
    if (!q.trim()) { setter([]); return; }
    try {
      const res = await api.get('/admin/students/', { params: { search: q, per_page: '10' } });
      setter(res.data.results);
    } catch { setter([]); }
  };

  // --- Create ---
  const openCreate = () => {
    setCreateForm(emptyForm());
    setSelectedChildren([]);
    setChildSearch('');
    setChildSearchResults([]);
    setShowCreate(true);
  };

  const addSelectedChild = (s: StudentResult) => {
    if (!s.student_profile_id) return;
    if (selectedChildren.find(c => c.student_profile_id === s.student_profile_id)) return;
    setSelectedChildren(prev => [...prev, {
      id: s.id,
      student_profile_id: s.student_profile_id!,
      first_name: s.first_name,
      last_name: s.last_name,
      school_class_name: s.school_class_name || '',
    }]);
    setChildSearch('');
    setChildSearchResults([]);
  };

  const handleCreate = async () => {
    if (!createForm.first_name.trim() || !createForm.last_name.trim()) return;
    try {
      const spIds = selectedChildren.map(c => c.student_profile_id);
      await api.post('/admin/parents/', {
        ...createForm,
        birth_date: createForm.birth_date || null,
        children: spIds,
      });
      setShowCreate(false);
      setMessage('Родитель создан');
      load(1);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка создания');
    }
  };

  // --- Edit ---
  const openEdit = async (parent: Parent) => {
    setEditParent(parent);
    setEditForm({
      last_name: parent.last_name,
      first_name: parent.first_name,
      email: parent.email || '',
      phone: parent.phone || '',
      telegram: parent.telegram || '',
      birth_date: parent.birth_date || '',
    });
    setEditChildren(parent.children || []);
    setEditChildSearch('');
    setEditChildResults([]);
    setCrossNavStudent(null);
  };

  const addEditChild = (s: StudentResult) => {
    if (!s.student_profile_id) return;
    if (editChildren.find(c => c.student_profile_id === s.student_profile_id)) return;
    setEditChildren(prev => [...prev, {
      id: s.id,
      student_profile_id: s.student_profile_id!,
      first_name: s.first_name,
      last_name: s.last_name,
      school_class_name: s.school_class_name || '',
    }]);
    setEditChildSearch('');
    setEditChildResults([]);
  };

  const handleEdit = async () => {
    if (!editParent) return;
    try {
      const spIds = editChildren.map(c => c.student_profile_id);
      await api.put(`/admin/parents/${editParent.id}/`, {
        ...editForm,
        birth_date: editForm.birth_date || null,
        children: spIds,
      });
      setEditParent(null);
      setMessage('Данные обновлены');
      load();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  // --- Reset password ---
  const handleResetPassword = async (parent: Parent) => {
    if (!confirm(`Сбросить пароль для ${parent.last_name} ${parent.first_name}?`)) return;
    await api.post(`/admin/parents/${parent.id}/reset-password/`);
    load();
  };

  // --- Delete ---
  const handleDelete = async (parent: Parent) => {
    if (!confirm(`Удалить родителя ${parent.last_name} ${parent.first_name}?`)) return;
    await api.delete(`/admin/parents/${parent.id}/`);
    load();
  };

  // --- Cross-nav: student card ---
  const openCrossNavStudent = async (child: ParentChild) => {
    setCrossNavStudent(child);
    setCrossNavStudentParents([]);
    setCrossNavStudentForm({ first_name: child.first_name, last_name: child.last_name, email: '', phone: '', birth_date: '', school_class: '' });
    // Load full student data
    try {
      const res = await api.get('/admin/students/', { params: { search: child.last_name, per_page: '50' } });
      const found = res.data.results.find((s: any) => s.id === child.id);
      if (found) {
        setCrossNavStudentForm({
          first_name: found.first_name,
          last_name: found.last_name,
          email: found.email || '',
          phone: found.phone || '',
          birth_date: found.birth_date || '',
          school_class: found.school_class_id || '',
        });
      }
    } catch { /* ignore */ }
    // Load student's parents
    try {
      const parentsRes = await api.get(`/school/students/${child.student_profile_id}/parents/`);
      setCrossNavStudentParents(parentsRes.data);
    } catch { /* ignore */ }
  };

  const saveCrossNavStudent = async () => {
    if (!crossNavStudent) return;
    try {
      await api.put(`/admin/users/${crossNavStudent.id}/`, {
        first_name: crossNavStudentForm.first_name,
        last_name: crossNavStudentForm.last_name,
        email: crossNavStudentForm.email,
        phone: crossNavStudentForm.phone,
        birth_date: crossNavStudentForm.birth_date || null,
        school_class: crossNavStudentForm.school_class || null,
      });
      setCrossNavStudent(null);
      setMessage('Данные ученика обновлены');
      // Reload parent (children list may have changed names)
      if (editParent) {
        const res = await api.get(`/admin/parents/${editParent.id}/`);
        setEditParent(res.data);
        setEditChildren(res.data.children || []);
      }
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const getMenuItems = (parent: Parent): MenuItem[] => [
    { label: 'Изменить', onClick: () => openEdit(parent) },
    { label: 'Сбросить пароль', onClick: () => handleResetPassword(parent) },
    { label: 'Удалить', onClick: () => handleDelete(parent), danger: true },
  ];

  return (
    <div>
      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-blue-400 hover:text-blue-600 ml-4">×</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <input
            placeholder="Поиск по имени..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm w-56"
          />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            По:
            {[10, 25, 50].map(n => (
              <button key={n} onClick={() => setPagination(p => ({ ...p, per_page: n }))}
                className={`px-2 py-1 rounded ${pagination.per_page === n ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Добавить родителя
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Фамилия</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Имя</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Телефон</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Telegram</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Дети</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Врем. пароль</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {parents.map(p => (
              <tr
                key={p.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => openEdit(p)}
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ parent: p, x: e.clientX, y: e.clientY }); }}
              >
                <td className="px-4 py-2">{p.last_name}</td>
                <td className="px-4 py-2">{p.first_name}</td>
                <td className="px-4 py-2 text-gray-500">{p.phone || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{p.telegram || '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(p.children || []).map(c => (
                      <span key={c.student_profile_id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {c.last_name} {c.first_name} ({c.school_class_name})
                      </span>
                    ))}
                    {(!p.children || p.children.length === 0) && <span className="text-gray-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {p.must_change_password && p.temp_password ? (
                    <code className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs">{p.temp_password}</code>
                  ) : '—'}
                </td>
                <td className="px-2 py-2 text-center">
                  <button onClick={e => { e.stopPropagation(); setCtxMenu({ parent: p, x: e.clientX, y: e.clientY }); }} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                    &#8942;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {parents.length === 0 && <p className="text-center text-gray-400 py-8">Родители не найдены</p>}
      </div>

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&lt;</button>
          <span className="px-3 py-1 text-sm text-gray-600">{pagination.page} / {pagination.pages} (всего: {pagination.total})</span>
          <button onClick={() => load(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&gt;</button>
        </div>
      )}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.parent)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Новый родитель</h3>
            <ParentFormFields form={createForm} onChange={setCreateForm} />
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-1">Дети</label>
              {selectedChildren.map(c => (
                <div key={c.student_profile_id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5 text-sm mb-1">
                  <span>{c.last_name} {c.first_name}{c.school_class_name ? ` · ${c.school_class_name}` : ''}</span>
                  <button onClick={() => setSelectedChildren(p => p.filter(x => x.student_profile_id !== c.student_profile_id))} className="text-red-400 text-xs ml-2">×</button>
                </div>
              ))}
              <input
                placeholder="Поиск ученика..."
                value={childSearch}
                onChange={e => { setChildSearch(e.target.value); searchStudents(e.target.value, setChildSearchResults); }}
                className="w-full border rounded px-2 py-1.5 text-sm mt-1"
              />
              {childSearchResults.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm bg-white rounded px-2 py-1.5 border mt-1">
                  <span>{s.last_name} {s.first_name}{s.school_class_name ? ` · ${s.school_class_name}` : ''}</span>
                  <button onClick={() => addSelectedChild(s)} className="text-blue-600 text-xs ml-2">Добавить</button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600">Отмена</button>
              <button onClick={handleCreate} disabled={!createForm.first_name.trim() || !createForm.last_name.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editParent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditParent(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактирование родителя</h3>
            <ParentFormFields form={editForm} onChange={setEditForm} />
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-2">Дети</label>
              {editChildren.map(c => (
                <div key={c.student_profile_id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5 text-sm mb-1">
                  <button
                    onClick={() => openCrossNavStudent(c)}
                    className="text-blue-600 hover:underline text-left flex-1 text-sm"
                  >
                    {c.last_name} {c.first_name}{c.school_class_name ? ` · ${c.school_class_name}` : ''}
                  </button>
                  <button onClick={() => setEditChildren(p => p.filter(x => x.student_profile_id !== c.student_profile_id))} className="text-red-400 text-xs ml-2">×</button>
                </div>
              ))}
              <input
                placeholder="Добавить ученика..."
                value={editChildSearch}
                onChange={e => { setEditChildSearch(e.target.value); searchStudents(e.target.value, setEditChildResults); }}
                className="w-full border rounded px-2 py-1.5 text-sm mt-1"
              />
              {editChildResults.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm bg-white rounded px-2 py-1.5 border mt-1">
                  <span>{s.last_name} {s.first_name}{s.school_class_name ? ` · ${s.school_class_name}` : ''}</span>
                  <button onClick={() => addEditChild(s)} className="text-blue-600 text-xs ml-2">Добавить</button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditParent(null)} className="px-4 py-2 text-sm text-gray-600">Отмена</button>
              <button onClick={handleEdit} disabled={!editForm.first_name.trim() || !editForm.last_name.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student cross-nav modal (z-[60], поверх карточки родителя) */}
      {crossNavStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={() => setCrossNavStudent(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setCrossNavStudent(null)} className="text-gray-400 hover:text-gray-600 text-sm">← Назад</button>
              <h3 className="text-lg font-semibold">Карточка ученика</h3>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Фамилия *</label>
                  <input value={crossNavStudentForm.last_name} onChange={e => setCrossNavStudentForm(f => ({ ...f, last_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Имя *</label>
                  <input value={crossNavStudentForm.first_name} onChange={e => setCrossNavStudentForm(f => ({ ...f, first_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                <input value={crossNavStudentForm.phone} onChange={e => setCrossNavStudentForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input value={crossNavStudentForm.email} onChange={e => setCrossNavStudentForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Дата рождения</label>
                <input type="date" value={crossNavStudentForm.birth_date} onChange={e => setCrossNavStudentForm(f => ({ ...f, birth_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Класс</label>
                <select value={crossNavStudentForm.school_class} onChange={e => setCrossNavStudentForm(f => ({ ...f, school_class: e.target.value ? parseInt(e.target.value) : '' }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Без класса</option>
                  {crossNavClasses.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </div>
              {crossNavStudentParents.length > 0 && (
                <div className="border-t pt-3">
                  <label className="block text-sm text-gray-600 mb-2">Родители</label>
                  {crossNavStudentParents.map(p => (
                    <div key={p.id} className="bg-gray-50 rounded px-3 py-1.5 text-sm mb-1 text-gray-700">
                      {p.last_name} {p.first_name}{p.phone ? ` · ${p.phone}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setCrossNavStudent(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={saveCrossNavStudent} disabled={!crossNavStudentForm.first_name.trim() || !crossNavStudentForm.last_name.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ParentFormFields({ form, onChange }: { form: ParentForm; onChange: (f: ParentForm) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Фамилия *</label>
          <input value={form.last_name} onChange={e => onChange({ ...form, last_name: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Имя *</label>
          <input value={form.first_name} onChange={e => onChange({ ...form, first_name: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Телефон</label>
        <input type="tel" value={form.phone} onChange={e => onChange({ ...form, phone: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="+7 (___) ___-__-__" />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Email</label>
        <input type="email" value={form.email} onChange={e => onChange({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Telegram</label>
        <input value={form.telegram} onChange={e => onChange({ ...form, telegram: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="@username" />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Дата рождения</label>
        <input type="date" value={form.birth_date} onChange={e => onChange({ ...form, birth_date: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
      </div>
    </div>
  );
}
