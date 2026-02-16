import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { User } from '../types';
import ContextMenu from './ContextMenu';
import type { MenuItem } from './ContextMenu';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Администратор' },
  { value: 'teacher', label: 'Учитель' },
];

interface StaffRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  roles: string[];
}

const emptyRow = (): StaffRow => ({ first_name: '', last_name: '', email: '', phone: '', roles: ['teacher'] });

export default function StaffTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ last_name: '', first_name: '', email: '', phone: '', role: '' });
  const [sort, setSort] = useState({ field: 'last_name', direction: 'asc' as 'asc' | 'desc' });
  const [showCreate, setShowCreate] = useState(false);
  const [rows, setRows] = useState<StaffRow[]>([emptyRow()]);
  const [message, setMessage] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', roles: [] as string[] });
  const [ctxMenu, setCtxMenu] = useState<{ user: User; x: number; y: number } | null>(null);

  const load = useCallback(async (page = pagination.page) => {
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
    if (filters.role) params.role = filters.role;

    const res = await api.get('/admin/staff/', { params });
    setUsers(res.data.results);
    setPagination(res.data.pagination);
  }, [filters, sort, pagination.per_page, pagination.page]);

  useEffect(() => { load(1); }, [filters, sort, pagination.per_page]);

  const toggleSort = (field: string) => {
    setSort(s => s.field === field ? { field, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' });
  };

  const sortIcon = (field: string) => {
    if (sort.field !== field) return ' \u2195';
    return sort.direction === 'asc' ? ' \u2191' : ' \u2193';
  };

  const openCreateModal = () => {
    setRows([emptyRow()]);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const valid = rows.filter(r => r.first_name.trim() && r.last_name.trim());
    if (valid.length === 0) return;
    try {
      const res = await api.post('/admin/staff/', valid);
      const parts: string[] = [`Создано: ${res.data.created.length} сотрудник(ов)`];
      if (res.data.warnings?.length) parts.push(`Тёзки: ${res.data.warnings.join('; ')}`);
      if (res.data.errors?.length) parts.push(`Ошибки: ${res.data.errors.join('; ')}`);
      setMessage(parts.join('. '));
      setShowCreate(false);
      load(1);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка создания');
    }
  };

  const handleResetPassword = async (user: User) => {
    if (!confirm(`Сбросить пароль для ${user.last_name} ${user.first_name}?`)) return;
    await api.post(`/admin/users/${user.id}/reset-password/`);
    load();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Удалить сотрудника ${user.last_name} ${user.first_name}?`)) return;
    await api.delete(`/admin/users/${user.id}/`);
    load();
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || '',
      phone: user.phone || '',
      roles: user.roles.filter(r => r !== 'parent'),
    });
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      await api.put(`/admin/users/${editUser.id}/`, editForm);
      setEditUser(null);
      setMessage('Данные обновлены');
      load();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const toggleEditRole = (role: string) => {
    setEditForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  };

  const updateRow = (idx: number, field: keyof StaffRow, value: any) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, rowIdx: number, fieldIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (fieldIdx < 3) {
      document.getElementById(`staff-${rowIdx}-${fieldIdx + 1}`)?.focus();
    } else {
      setRows(r => [...r, emptyRow()]);
      setTimeout(() => document.getElementById(`staff-${rowIdx + 1}-0`)?.focus(), 0);
    }
  };

  const toggleRowRole = (idx: number, role: string) => {
    setRows(r => r.map((row, i) => {
      if (i !== idx) return row;
      const roles = row.roles.includes(role) ? row.roles.filter(r => r !== role) : [...row.roles, role];
      return { ...row, roles };
    }));
  };

  const openContextMenu = (user: User, x: number, y: number) => {
    setCtxMenu({ user, x, y });
  };

  const getMenuItems = (user: User): MenuItem[] => [
    { label: 'Изменить', onClick: () => openEdit(user) },
    { label: 'Сбросить пароль', onClick: () => handleResetPassword(user) },
    { label: 'Удалить', onClick: () => handleDelete(user), danger: true },
  ];

  return (
    <div>
      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-blue-400 hover:text-blue-600 ml-4">x</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          Показывать по:
          {[10, 25, 50].map(n => (
            <button key={n} onClick={() => setPagination(p => ({ ...p, per_page: n }))}
              className={`px-2 py-1 rounded ${pagination.per_page === n ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {n}
            </button>
          ))}
        </div>
        <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Добавить
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('last_name')} className="font-medium text-gray-600 hover:text-gray-900">
                  Фамилия{sortIcon('last_name')}
                </button>
                <input placeholder="Фильтр..." value={filters.last_name} onChange={e => setFilters(f => ({ ...f, last_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('first_name')} className="font-medium text-gray-600 hover:text-gray-900">
                  Имя{sortIcon('first_name')}
                </button>
                <input placeholder="Фильтр..." value={filters.first_name} onChange={e => setFilters(f => ({ ...f, first_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <span className="font-medium text-gray-600">Email</span>
                <input placeholder="Фильтр..." value={filters.email} onChange={e => setFilters(f => ({ ...f, email: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <span className="font-medium text-gray-600">Телефон</span>
                <input placeholder="Фильтр..." value={filters.phone} onChange={e => setFilters(f => ({ ...f, phone: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <span className="font-medium text-gray-600">Роли</span>
                <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal">
                  <option value="">Все</option>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Врем. пароль</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr
                key={u.id}
                className="hover:bg-gray-50"
                onContextMenu={e => { e.preventDefault(); openContextMenu(u, e.clientX, e.clientY); }}
              >
                <td className="px-4 py-2">{u.last_name}</td>
                <td className="px-4 py-2">{u.first_name}</td>
                <td className="px-4 py-2 text-gray-500">{u.email || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{u.phone || '—'}</td>
                <td className="px-4 py-2">
                  {u.roles.filter(r => r !== 'parent').map(r => (
                    <span key={r} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded mr-1">
                      {ROLE_OPTIONS.find(o => o.value === r)?.label || r}
                    </span>
                  ))}
                </td>
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
        {users.length === 0 && <p className="text-center text-gray-400 py-8">Сотрудники не найдены</p>}
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
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.user)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Добавление сотрудников</h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 font-medium">Фамилия *</th>
                    <th className="pb-2 font-medium pl-2">Имя *</th>
                    <th className="pb-2 font-medium pl-2">Email</th>
                    <th className="pb-2 font-medium pl-2">Телефон</th>
                    <th className="pb-2 font-medium pl-2 text-center">Админ</th>
                    <th className="pb-2 font-medium pl-2 text-center">Учитель</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-1 pr-1">
                        <input id={`staff-${idx}-0`} value={row.last_name} onChange={e => updateRow(idx, 'last_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 0)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`staff-${idx}-1`} value={row.first_name} onChange={e => updateRow(idx, 'first_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 1)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`staff-${idx}-2`} value={row.email} onChange={e => updateRow(idx, 'email', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 2)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`staff-${idx}-3`} value={row.phone} onChange={e => updateRow(idx, 'phone', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 3)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1 text-center">
                        <input type="checkbox" checked={row.roles.includes('admin')} onChange={() => toggleRowRole(idx, 'admin')} />
                      </td>
                      <td className="py-1 px-1 text-center">
                        <input type="checkbox" checked={row.roles.includes('teacher')} onChange={() => toggleRowRole(idx, 'teacher')} />
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
              <button onClick={() => setRows(r => [...r, emptyRow()])} className="text-blue-600 hover:text-blue-800 text-sm">+ Ещё строка</button>
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
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактирование сотрудника</h3>
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
                <label className="block text-sm text-gray-600 mb-1">Роли</label>
                <div className="flex gap-3">
                  {ROLE_OPTIONS.map(r => (
                    <label key={r.value} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={editForm.roles.includes(r.value)} onChange={() => toggleEditRole(r.value)} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
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
