import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { User, GradeLevel, SchoolClass, Parent, ParentChild } from '../types';
import ContextMenu from './ContextMenu';
import type { MenuItem } from './ContextMenu';

interface StudentUser extends User {
  school_class_id: number | null;
  school_class_name: string;
}

interface StudentRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  school_class: number | string;
}

const emptyRow = (classId?: number): StudentRow => ({
  first_name: '', last_name: '', email: '', phone: '', school_class: classId || '',
});

export default function StudentsTab() {
  const [view, setView] = useState<'folders' | 'list'>('list');
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ last_name: '', first_name: '', email: '', phone: '', school_class: '' });
  const [sort, setSort] = useState({ field: 'last_name', direction: 'asc' as 'asc' | 'desc' });
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [rows, setRows] = useState<StudentRow[]>([emptyRow()]);
  const [message, setMessage] = useState('');
  const [editUser, setEditUser] = useState<StudentUser | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', birth_date: '', school_class: '' as string | number });
  const [studentParents, setStudentParents] = useState<Parent[]>([]);
  const [showAddParent, setShowAddParent] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<Parent[]>([]);
  const [newParentForm, setNewParentForm] = useState({ last_name: '', first_name: '', phone: '', telegram: '' });
  const [addParentMode, setAddParentMode] = useState<'search' | 'create'>('search');
  const [studentProfileId, setStudentProfileId] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ user: StudentUser; x: number; y: number } | null>(null);

  // Folder navigation
  const [folderLevel, setFolderLevel] = useState<'root' | 'grade' | 'class'>('root');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [folderStudents, setFolderStudents] = useState<StudentUser[]>([]);

  useEffect(() => {
    api.get('/school/grade-levels/').then(r => setGrades(r.data));
    api.get('/school/classes/').then(r => setClasses(r.data));
  }, []);

  const loadList = useCallback(async (page = pagination.page) => {
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(pagination.per_page),
      sort: sort.field,
      direction: sort.direction,
    };
    if (filters.last_name) params.last_name = filters.last_name;
    if (filters.first_name) params.first_name = filters.first_name;
    if (filters.email) params.email = filters.email;
    if (filters.phone) params.phone = filters.phone;
    if (filters.school_class) params.school_class = filters.school_class;

    const res = await api.get('/admin/students/', { params });
    setStudents(res.data.results);
    setPagination(res.data.pagination);
  }, [filters, sort, pagination.per_page, pagination.page]);

  useEffect(() => {
    if (view === 'list') loadList(1);
  }, [filters, sort, pagination.per_page, view]);

  const loadFolderStudents = async (classId: number) => {
    const res = await api.get('/admin/students/', { params: { school_class: classId, per_page: '200' } });
    setFolderStudents(res.data.results);
  };

  const reloadData = () => {
    if (view === 'list') loadList();
    else if (selectedClass) loadFolderStudents(selectedClass.id);
  };

  const openGrade = (grade: GradeLevel) => {
    setSelectedGrade(grade);
    setFolderLevel('grade');
  };

  const openClass = (cls: SchoolClass) => {
    setSelectedClass(cls);
    setFolderLevel('class');
    loadFolderStudents(cls.id);
  };

  const goBack = () => {
    if (folderLevel === 'class') {
      setFolderLevel('grade');
      setSelectedClass(null);
    } else if (folderLevel === 'grade') {
      setFolderLevel('root');
      setSelectedGrade(null);
    }
  };

  const toggleSort = (field: string) => {
    setSort(s => s.field === field ? { field, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' });
  };

  const sortIcon = (field: string) => {
    if (sort.field !== field) return ' \u2195';
    return sort.direction === 'asc' ? ' \u2191' : ' \u2193';
  };

  const openCreateModal = () => {
    const classId = view === 'folders' && selectedClass ? selectedClass.id : undefined;
    setRows([emptyRow(classId)]);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const valid = rows.filter(r => r.first_name.trim() && r.last_name.trim());
    if (valid.length === 0) return;
    const payload = valid.map(r => ({
      ...r,
      school_class: r.school_class || undefined,
    }));
    try {
      const res = await api.post('/admin/students/', payload);
      const parts: string[] = [`Создано: ${res.data.created.length} ученик(ов)`];
      if (res.data.warnings?.length) parts.push(`Тёзки: ${res.data.warnings.join('; ')}`);
      if (res.data.errors?.length) parts.push(`Ошибки: ${res.data.errors.join('; ')}`);
      setMessage(parts.join('. '));
      setShowCreate(false);
      if (view === 'list') loadList(1);
      else if (selectedClass) loadFolderStudents(selectedClass.id);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка создания');
    }
  };

  const handleResetPassword = async (user: StudentUser) => {
    if (!confirm(`Сбросить пароль для ${user.last_name} ${user.first_name}?`)) return;
    await api.post(`/admin/users/${user.id}/reset-password/`);
    reloadData();
  };

  const handleDelete = async (user: StudentUser) => {
    if (!confirm(`Удалить ученика ${user.last_name} ${user.first_name}?`)) return;
    await api.delete(`/admin/users/${user.id}/`);
    reloadData();
  };

  const openEdit = async (user: StudentUser) => {
    setEditUser(user);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || '',
      phone: user.phone || '',
      birth_date: user.birth_date || '',
      school_class: user.school_class_id || '',
    });
    setShowAddParent(false);
    setParentSearch('');
    setParentSearchResults([]);
    setNewParentForm({ last_name: '', first_name: '', phone: '', telegram: '' });
    // Find StudentProfile id and load parents
    try {
      const res = await api.get('/admin/students/', { params: { search: user.last_name, per_page: '100' } });
      const found = res.data.results.find((s: any) => s.id === user.id);
      if (found?.school_class_id) {
        // Find student profile id from class students
        const spRes = await api.get(`/school/classes/${found.school_class_id}/students/`);
        const sp = spRes.data.find((s: any) => s.user.id === user.id);
        if (sp) {
          setStudentProfileId(sp.id);
          const parentsRes = await api.get(`/school/students/${sp.id}/parents/`);
          setStudentParents(parentsRes.data);
        }
      }
    } catch { /* no parents loaded */ }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      await api.put(`/admin/users/${editUser.id}/`, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        phone: editForm.phone,
        birth_date: editForm.birth_date || null,
        school_class: editForm.school_class || null,
      });
      setEditUser(null);
      setMessage('Данные обновлены');
      reloadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleSearchParents = async (q: string) => {
    setParentSearch(q);
    if (!q.trim()) { setParentSearchResults([]); return; }
    try {
      const res = await api.get('/admin/parents/', { params: { search: q, per_page: '10' } });
      setParentSearchResults(res.data.results);
    } catch { setParentSearchResults([]); }
  };

  const handleLinkParent = async (parentId: number) => {
    if (!studentProfileId) return;
    try {
      const res = await api.post(`/school/students/${studentProfileId}/parents/`, { action: 'add', parent_id: parentId });
      setStudentParents(res.data);
      setShowAddParent(false);
      setParentSearch('');
      setParentSearchResults([]);
    } catch { /* ignore */ }
  };

  const handleUnlinkParent = async (parentId: number) => {
    if (!studentProfileId) return;
    try {
      const res = await api.post(`/school/students/${studentProfileId}/parents/`, { action: 'remove', parent_id: parentId });
      setStudentParents(res.data);
    } catch { /* ignore */ }
  };

  const handleCreateAndLinkParent = async () => {
    if (!newParentForm.first_name.trim() || !newParentForm.last_name.trim()) return;
    if (!studentProfileId) return;
    try {
      const created = await api.post('/admin/parents/', {
        ...newParentForm,
        children: [studentProfileId],
      });
      setStudentParents(p => [...p, created.data]);
      setShowAddParent(false);
      setNewParentForm({ last_name: '', first_name: '', phone: '', telegram: '' });
    } catch { /* ignore */ }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, rowIdx: number, fieldIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (fieldIdx < 3) {
      document.getElementById(`student-${rowIdx}-${fieldIdx + 1}`)?.focus();
    } else {
      const classId = view === 'folders' && selectedClass ? selectedClass.id : undefined;
      setRows(r => [...r, emptyRow(classId)]);
      setTimeout(() => document.getElementById(`student-${rowIdx + 1}-0`)?.focus(), 0);
    }
  };

  const updateRow = (idx: number, field: keyof StudentRow, value: any) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const openContextMenu = (user: StudentUser, x: number, y: number) => {
    setCtxMenu({ user, x, y });
  };

  const getMenuItems = (user: StudentUser): MenuItem[] => [
    { label: 'Изменить', onClick: () => openEdit(user) },
    { label: 'Сбросить пароль', onClick: () => handleResetPassword(user) },
    { label: 'Удалить', onClick: () => handleDelete(user), danger: true },
  ];

  const showClassColumn = view === 'list' || !(selectedClass);

  const renderStudentTable = (data: StudentUser[], showClass: boolean) => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">
              <button onClick={() => toggleSort('last_name')} className="font-medium text-gray-600 hover:text-gray-900">
                Фамилия{sortIcon('last_name')}
              </button>
              {view === 'list' && (
                <input placeholder="Фильтр..." value={filters.last_name} onChange={e => setFilters(f => ({ ...f, last_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              )}
            </th>
            <th className="px-4 py-2 text-left">
              <button onClick={() => toggleSort('first_name')} className="font-medium text-gray-600 hover:text-gray-900">
                Имя{sortIcon('first_name')}
              </button>
              {view === 'list' && (
                <input placeholder="Фильтр..." value={filters.first_name} onChange={e => setFilters(f => ({ ...f, first_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              )}
            </th>
            <th className="px-4 py-2 text-left">
              <span className="font-medium text-gray-600">Email</span>
              {view === 'list' && (
                <input placeholder="Фильтр..." value={filters.email} onChange={e => setFilters(f => ({ ...f, email: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              )}
            </th>
            <th className="px-4 py-2 text-left">
              <span className="font-medium text-gray-600">Телефон</span>
              {view === 'list' && (
                <input placeholder="Фильтр..." value={filters.phone} onChange={e => setFilters(f => ({ ...f, phone: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              )}
            </th>
            {showClass && (
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('school_class')} className="font-medium text-gray-600 hover:text-gray-900">
                  Класс{sortIcon('school_class')}
                </button>
                <select value={filters.school_class} onChange={e => setFilters(f => ({ ...f, school_class: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal">
                  <option value="">Все</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </th>
            )}
            <th className="px-4 py-2 text-left font-medium text-gray-600">Врем. пароль</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map(u => (
            <tr
              key={u.id}
              className="hover:bg-gray-50"
              onContextMenu={e => { e.preventDefault(); openContextMenu(u, e.clientX, e.clientY); }}
            >
              <td className="px-4 py-2">{u.last_name}</td>
              <td className="px-4 py-2">{u.first_name}</td>
              <td className="px-4 py-2 text-gray-500">{u.email || '—'}</td>
              <td className="px-4 py-2 text-gray-500">{u.phone || '—'}</td>
              {showClass && <td className="px-4 py-2 text-gray-500">{u.school_class_name || '—'}</td>}
              <td className="px-4 py-2">
                {u.must_change_password && u.temp_password ? (
                  <code className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs">{u.temp_password}</code>
                ) : '—'}
              </td>
              <td className="px-2 py-2 text-center">
                <button
                  onClick={e => { e.stopPropagation(); openContextMenu(u, e.clientX, e.clientY); }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                >
                  &#8942;
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p className="text-center text-gray-400 py-8">Ученики не найдены</p>}
    </div>
  );

  return (
    <div>
      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-blue-400 hover:text-blue-600 ml-4">x</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('list')} className={`px-3 py-1 rounded text-sm ${view === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}>
              Список
            </button>
            <button onClick={() => setView('folders')} className={`px-3 py-1 rounded text-sm ${view === 'folders' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}>
              Папки
            </button>
          </div>
          {view === 'list' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              По:
              {[10, 25, 50].map(n => (
                <button key={n} onClick={() => setPagination(p => ({ ...p, per_page: n }))}
                  className={`px-2 py-1 rounded ${pagination.per_page === n ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Добавить
        </button>
      </div>

      {view === 'list' ? (
        <>
          {renderStudentTable(students, true)}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => loadList(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&lt;</button>
              <span className="px-3 py-1 text-sm text-gray-600">{pagination.page} / {pagination.pages} (всего: {pagination.total})</span>
              <button onClick={() => loadList(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&gt;</button>
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm">
            <button onClick={() => { setFolderLevel('root'); setSelectedGrade(null); setSelectedClass(null); }} className={`hover:text-blue-600 ${folderLevel === 'root' ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
              Все параллели
            </button>
            {selectedGrade && (
              <>
                <span className="text-gray-300">/</span>
                <button onClick={() => { setFolderLevel('grade'); setSelectedClass(null); }} className={`hover:text-blue-600 ${folderLevel === 'grade' ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
                  {selectedGrade.number} класс
                </button>
              </>
            )}
            {selectedClass && (
              <>
                <span className="text-gray-300">/</span>
                <span className="font-semibold text-blue-600">{selectedClass.display_name}</span>
              </>
            )}
          </div>

          {folderLevel === 'root' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {grades.map(g => (
                <button key={g.id} onClick={() => openGrade(g)} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition text-center">
                  <div className="text-3xl mb-2 text-yellow-500">&#128193;</div>
                  <div className="font-medium text-sm">{g.number} класс</div>
                  <div className="text-xs text-gray-400">{classes.filter(c => c.grade_level === g.id).length} классов</div>
                </button>
              ))}
              {grades.length === 0 && <p className="col-span-full text-gray-400 text-center py-8">Параллели не созданы</p>}
            </div>
          )}

          {folderLevel === 'grade' && selectedGrade && (
            <div>
              <button onClick={goBack} className="text-blue-600 hover:text-blue-800 text-sm mb-4">&larr; Назад</button>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {classes.filter(c => c.grade_level === selectedGrade.id).map(cls => (
                  <button key={cls.id} onClick={() => openClass(cls)} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition text-center">
                    <div className="text-3xl mb-2 text-blue-500">&#128193;</div>
                    <div className="font-medium text-sm">{cls.display_name}</div>
                    <div className="text-xs text-gray-400">{cls.students_count} уч.</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {folderLevel === 'class' && selectedClass && (
            <div>
              <button onClick={goBack} className="text-blue-600 hover:text-blue-800 text-sm mb-4">&larr; Назад</button>
              {renderStudentTable(folderStudents, false)}
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.user)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Добавление учеников</h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 font-medium">Фамилия *</th>
                    <th className="pb-2 font-medium pl-2">Имя *</th>
                    <th className="pb-2 font-medium pl-2">Email</th>
                    <th className="pb-2 font-medium pl-2">Телефон</th>
                    <th className="pb-2 font-medium pl-2">Класс</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-1 pr-1">
                        <input id={`student-${idx}-0`} value={row.last_name} onChange={e => updateRow(idx, 'last_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 0)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`student-${idx}-1`} value={row.first_name} onChange={e => updateRow(idx, 'first_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 1)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`student-${idx}-2`} value={row.email} onChange={e => updateRow(idx, 'email', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 2)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`student-${idx}-3`} value={row.phone} onChange={e => updateRow(idx, 'phone', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 3)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        {view === 'folders' && selectedClass ? (
                          <span className="text-sm text-gray-500 px-2">{selectedClass.display_name}</span>
                        ) : (
                          <select value={row.school_class} onChange={e => updateRow(idx, 'school_class', e.target.value ? parseInt(e.target.value) : '')} className="w-full border rounded px-2 py-1.5 text-sm">
                            <option value="">—</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="py-1 pl-1">
                        {rows.length > 1 && (
                          <button onClick={() => setRows(r => r.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <button onClick={() => { const classId = view === 'folders' && selectedClass ? selectedClass.id : undefined; setRows(r => [...r, emptyRow(classId)]); }} className="text-blue-600 hover:text-blue-800 text-sm">+ Ещё строка</button>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
                <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Создать</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактирование ученика</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Фамилия *</label>
                <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Имя *</label>
                <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Дата рождения</label>
                <input type="date" value={editForm.birth_date} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Класс</label>
                <select value={editForm.school_class} onChange={e => setEditForm(f => ({ ...f, school_class: e.target.value ? parseInt(e.target.value) : '' }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Без класса</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </div>

              {/* Родители */}
              {studentProfileId !== null && (
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Родители</label>
                    <button onClick={() => { setShowAddParent(v => !v); setAddParentMode('search'); }} className="text-xs text-blue-600 hover:text-blue-800">+ Добавить</button>
                  </div>
                  {studentParents.length > 0 ? (
                    <div className="space-y-1.5 mb-2">
                      {studentParents.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5 text-sm">
                          <span>{p.last_name} {p.first_name}{p.phone ? ` · ${p.phone}` : ''}</span>
                          <button onClick={() => handleUnlinkParent(p.id)} className="text-red-400 hover:text-red-600 text-xs ml-2">Отвязать</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-2">Родители не привязаны</p>
                  )}
                  {showAddParent && (
                    <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="flex gap-2 mb-1">
                        <button onClick={() => setAddParentMode('search')} className={`text-xs px-2 py-1 rounded ${addParentMode === 'search' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>Найти существующего</button>
                        <button onClick={() => setAddParentMode('create')} className={`text-xs px-2 py-1 rounded ${addParentMode === 'create' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>Создать нового</button>
                      </div>
                      {addParentMode === 'search' ? (
                        <>
                          <input placeholder="Поиск по фамилии..." value={parentSearch} onChange={e => handleSearchParents(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" />
                          {parentSearchResults.map(p => (
                            <div key={p.id} className="flex justify-between items-center text-xs bg-white rounded px-2 py-1.5 border">
                              <span>{p.last_name} {p.first_name}</span>
                              <button onClick={() => handleLinkParent(p.id)} className="text-blue-600 hover:text-blue-800 ml-2">Привязать</button>
                            </div>
                          ))}
                          {parentSearch && parentSearchResults.length === 0 && <p className="text-xs text-gray-400">Не найдено</p>}
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1">
                            <input placeholder="Фамилия *" value={newParentForm.last_name} onChange={e => setNewParentForm(f => ({ ...f, last_name: e.target.value }))} className="flex-1 border rounded px-2 py-1.5 text-xs" />
                            <input placeholder="Имя *" value={newParentForm.first_name} onChange={e => setNewParentForm(f => ({ ...f, first_name: e.target.value }))} className="flex-1 border rounded px-2 py-1.5 text-xs" />
                          </div>
                          <input placeholder="Телефон" value={newParentForm.phone} onChange={e => setNewParentForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-xs" />
                          <input placeholder="Telegram" value={newParentForm.telegram} onChange={e => setNewParentForm(f => ({ ...f, telegram: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-xs" />
                          <button onClick={handleCreateAndLinkParent} disabled={!newParentForm.first_name.trim() || !newParentForm.last_name.trim()} className="w-full bg-blue-600 text-white text-xs py-1.5 rounded disabled:opacity-50 hover:bg-blue-700">
                            Создать и привязать
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
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
