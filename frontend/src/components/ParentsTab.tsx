import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Parent, ParentChild, StudentProfile } from '../types';
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
  const [childSearchResults, setChildSearchResults] = useState<StudentProfile[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<StudentProfile[]>([]);

  // Edit modal
  const [editParent, setEditParent] = useState<Parent | null>(null);
  const [editForm, setEditForm] = useState<ParentForm>(emptyForm());
  const [editChildSearch, setEditChildSearch] = useState('');
  const [editChildResults, setEditChildResults] = useState<StudentProfile[]>([]);
  const [editChildren, setEditChildren] = useState<ParentChild[]>([]);

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

  const searchChildren = async (q: string, setter: (r: StudentProfile[]) => void) => {
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

  const handleCreate = async () => {
    if (!createForm.first_name.trim() || !createForm.last_name.trim()) return;
    try {
      // Need student profile ids
      const spIds = await resolveStudentProfileIds(selectedChildren.map(s => s.id));
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

  const addChildToEdit = async (studentUser: StudentProfile) => {
    // Find StudentProfile for this user
    const classId = (studentUser as any).school_class_id;
    if (!classId) return;
    try {
      const res = await api.get(`/school/classes/${classId}/students/`);
      const sp = res.data.find((s: any) => s.user.id === studentUser.id);
      if (sp && !editChildren.find(c => c.student_profile_id === sp.id)) {
        setEditChildren(prev => [...prev, {
          id: studentUser.id,
          student_profile_id: sp.id,
          first_name: studentUser.first_name || (studentUser as any).user?.first_name || '',
          last_name: studentUser.last_name || (studentUser as any).user?.last_name || '',
          school_class_name: (studentUser as any).school_class_name || '',
        }]);
      }
    } catch { /* ignore */ }
    setEditChildSearch('');
    setEditChildResults([]);
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
              <tr key={p.id} className="hover:bg-gray-50" onContextMenu={e => { e.preventDefault(); setCtxMenu({ parent: p, x: e.clientX, y: e.clientY }); }}>
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

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&lt;</button>
          <span className="px-3 py-1 text-sm text-gray-600">{pagination.page} / {pagination.pages} (всего: {pagination.total})</span>
          <button onClick={() => load(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&gt;</button>
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.parent)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Новый родитель</h3>
            <ParentFormFields form={createForm} onChange={setCreateForm} />
            {/* Children picker */}
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-1">Дети</label>
              {selectedChildren.map(s => (
                <div key={s.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5 text-sm mb-1">
                  <span>{(s as any).last_name} {(s as any).first_name} · {(s as any).school_class_name}</span>
                  <button onClick={() => setSelectedChildren(p => p.filter(c => c.id !== s.id))} className="text-red-400 text-xs ml-2">×</button>
                </div>
              ))}
              <input
                placeholder="Поиск ученика..."
                value={childSearch}
                onChange={e => { setChildSearch(e.target.value); searchChildren(e.target.value, setChildSearchResults); }}
                className="w-full border rounded px-2 py-1.5 text-sm mt-1"
              />
              {childSearchResults.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm bg-white rounded px-2 py-1.5 border mt-1">
                  <span>{(s as any).last_name} {(s as any).first_name} · {(s as any).school_class_name}</span>
                  <button onClick={() => { if (!selectedChildren.find(c => c.id === s.id)) setSelectedChildren(p => [...p, s]); setChildSearch(''); setChildSearchResults([]); }} className="text-blue-600 text-xs ml-2">Добавить</button>
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
            {/* Children management */}
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-1">Дети</label>
              {editChildren.map(c => (
                <div key={c.student_profile_id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5 text-sm mb-1">
                  <span>{c.last_name} {c.first_name} · {c.school_class_name}</span>
                  <button onClick={() => setEditChildren(p => p.filter(x => x.student_profile_id !== c.student_profile_id))} className="text-red-400 text-xs ml-2">×</button>
                </div>
              ))}
              <input
                placeholder="Добавить ученика..."
                value={editChildSearch}
                onChange={e => { setEditChildSearch(e.target.value); searchChildren(e.target.value, setEditChildResults); }}
                className="w-full border rounded px-2 py-1.5 text-sm mt-1"
              />
              {editChildResults.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm bg-white rounded px-2 py-1.5 border mt-1">
                  <span>{(s as any).last_name} {(s as any).first_name} · {(s as any).school_class_name}</span>
                  <button onClick={() => addChildToEdit(s)} className="text-blue-600 text-xs ml-2">Добавить</button>
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
    </div>
  );
}

// Helper to resolve student profile IDs from user IDs
async function resolveStudentProfileIds(userIds: number[]): Promise<number[]> {
  const ids: number[] = [];
  for (const uid of userIds) {
    try {
      const res = await api.get('/admin/students/', { params: { per_page: '200' } });
      const found = res.data.results.find((s: any) => s.id === uid);
      if (found?.school_class_id) {
        const spRes = await api.get(`/school/classes/${found.school_class_id}/students/`);
        const sp = spRes.data.find((s: any) => s.user.id === uid);
        if (sp) ids.push(sp.id);
      }
    } catch { /* ignore */ }
  }
  return ids;
}

// Shared form fields component
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
