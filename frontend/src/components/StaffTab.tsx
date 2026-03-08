import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { User } from '../types';
import ContextMenu from './ContextMenu';
import type { MenuItem } from './ContextMenu';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Администратор' },
  { value: 'teacher', label: 'Учитель' },
  { value: 'spps', label: 'СППС' },
];

function roleBadgeClass(role: string) {
  if (role === 'spps') return 'bg-yellow-100 text-yellow-700';
  return 'bg-purple-100 text-purple-700';
}

interface StaffRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  roles: string[];
}

const emptyRow = (): StaffRow => ({ first_name: '', last_name: '', email: '', phone: '', roles: ['teacher'] });

export default function StaffTab({ readOnly = false }: { readOnly?: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ last_name: '', first_name: '', email: '', phone: '', role: '' });
  const [sort, setSort] = useState({ field: 'last_name', direction: 'asc' as 'asc' | 'desc' });
  const [showCreate, setShowCreate] = useState(false);
  const [rows, setRows] = useState<StaffRow[]>([emptyRow()]);
  const [message, setMessage] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', birth_date: '', roles: [] as string[] });
  const [ctxMenu, setCtxMenu] = useState<{ user: User; x: number; y: number } | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (value: string, field: string) => {
    const done = () => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
    } else {
      fallbackCopy(value, done);
    }
  };

  const fallbackCopy = (value: string, done: () => void) => {
    const el = document.createElement('textarea');
    el.value = value;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    try { document.execCommand('copy'); done(); } catch {}
    document.body.removeChild(el);
  };

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
      birth_date: user.birth_date || '',
      roles: user.roles.filter(r => r !== 'parent'),
    });
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      await api.put(`/admin/users/${editUser.id}/`, {
        ...editForm,
        birth_date: editForm.birth_date || null,
      });
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
        <div className="bg-purple-50 text-purple-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-purple-400 hover:text-purple-600 ml-4">x</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          Показывать по:
          {[10, 25, 50].map(n => (
            <button key={n} onClick={() => setPagination(p => ({ ...p, per_page: n }))}
              className={`px-2 py-1 rounded ${pagination.per_page === n ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>
              {n}
            </button>
          ))}
        </div>
        {!readOnly && (
          <button onClick={openCreateModal} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
            + Добавить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('last_name')} className="font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900">
                  Фамилия{sortIcon('last_name')}
                </button>
                <input placeholder="Фильтр..." value={filters.last_name} onChange={e => setFilters(f => ({ ...f, last_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('first_name')} className="font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900">
                  Имя{sortIcon('first_name')}
                </button>
                <input placeholder="Фильтр..." value={filters.first_name} onChange={e => setFilters(f => ({ ...f, first_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left hidden sm:table-cell">
                <span className="font-medium text-gray-600 dark:text-slate-400">Email</span>
                <input placeholder="Фильтр..." value={filters.email} onChange={e => setFilters(f => ({ ...f, email: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left hidden sm:table-cell">
                <span className="font-medium text-gray-600 dark:text-slate-400">Телефон</span>
                <input placeholder="Фильтр..." value={filters.phone} onChange={e => setFilters(f => ({ ...f, phone: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left hidden sm:table-cell">
                <span className="font-medium text-gray-600 dark:text-slate-400">Роли</span>
                <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal">
                  <option value="">Все</option>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-slate-400 hidden sm:table-cell">Врем. пароль</th>
              {!readOnly && <th className="w-10 hidden sm:table-cell"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr
                key={u.id}
                className="hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                onClick={() => setViewUser(u)}
                onContextMenu={e => { e.preventDefault(); if (!readOnly) openContextMenu(u, e.clientX, e.clientY); }}
              >
                <td className="px-4 py-2">{u.last_name}</td>
                <td className="px-4 py-2">{u.first_name}</td>
                <td className="px-4 py-2 text-gray-500 dark:text-slate-400 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                  {u.email ? (
                    <button onClick={() => copyToClipboard(u.email, `email_${u.id}`)} className="hover:underline cursor-copy text-left" title="Нажмите, чтобы скопировать">
                      {copiedField === `email_${u.id}` ? '✓ Скопировано' : u.email}
                    </button>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-gray-500 dark:text-slate-400 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                  {u.phone ? (
                    <button onClick={() => copyToClipboard(u.phone, `phone_${u.id}`)} className="hover:underline cursor-copy text-left" title="Нажмите, чтобы скопировать">
                      {copiedField === `phone_${u.id}` ? '✓ Скопировано' : u.phone}
                    </button>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.filter(r => r !== 'parent').map(r => (
                      <span key={r} className={`${roleBadgeClass(r)} text-xs px-2 py-0.5 rounded`}>
                        {ROLE_OPTIONS.find(o => o.value === r)?.label || r}
                      </span>
                    ))}
                    {(u.curated_classes ?? []).map(cls => (
                      <span key={cls} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">
                        Куратор {cls}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                  {u.must_change_password && u.temp_password ? (
                    <button
                      onClick={() => copyToClipboard(u.temp_password!, `temp_${u.id}`)}
                      className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-mono hover:bg-yellow-100 transition-colors cursor-copy"
                      title="Нажмите, чтобы скопировать"
                    >
                      {copiedField === `temp_${u.id}` ? '✓ Скопировано' : u.temp_password}
                    </button>
                  ) : '—'}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2 text-center hidden sm:table-cell">
                    <button
                      onClick={e => { e.stopPropagation(); openContextMenu(u, e.clientX, e.clientY); }}
                      className="text-gray-400 dark:text-slate-500 hover:text-gray-600 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      &#8942;
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-center text-gray-400 dark:text-slate-500 py-8">Сотрудники не найдены</p>}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&lt;</button>
          <span className="px-3 py-1 text-sm text-gray-600 dark:text-slate-400">{pagination.page} / {pagination.pages} (всего: {pagination.total})</span>
          <button onClick={() => load(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&gt;</button>
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.user)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Teacher View Card */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setViewUser(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-lg shadow-xl p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <h3 className="text-lg font-semibold">{viewUser.last_name} {viewUser.first_name}</h3>
              <button onClick={() => setViewUser(null)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500 dark:text-slate-400">Email</span>
                <div className="flex items-center gap-2">
                  <span>{viewUser.email || '—'}</span>
                  {viewUser.email && (
                    <button
                      onClick={() => copyToClipboard(viewUser.email, 'email')}
                      className="text-gray-400 dark:text-slate-500 hover:text-gray-600 transition-colors"
                      title="Копировать"
                    >
                      {copiedField === 'email' ? (
                        <svg className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a2 2 0 00-2 2v1H5a2 2 0 00-2 2v9a2 2 0 002 2h8a2 2 0 002-2v-1h1a2 2 0 002-2V7a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H8zm0 2h4v1H8V4zM5 7h10v9H5V7z"/></svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500 dark:text-slate-400">Телефон</span>
                <div className="flex items-center gap-2">
                  <span>{viewUser.phone || '—'}</span>
                  {viewUser.phone && (
                    <button
                      onClick={() => copyToClipboard(viewUser.phone, 'phone')}
                      className="text-gray-400 dark:text-slate-500 hover:text-gray-600 transition-colors"
                      title="Копировать"
                    >
                      {copiedField === 'phone' ? (
                        <svg className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a2 2 0 00-2 2v1H5a2 2 0 00-2 2v9a2 2 0 002 2h8a2 2 0 002-2v-1h1a2 2 0 002-2V7a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H8zm0 2h4v1H8V4zM5 7h10v9H5V7z"/></svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
              {viewUser.birth_date && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500 dark:text-slate-400">Дата рождения</span>
                  <span>{new Date(viewUser.birth_date).toLocaleDateString('ru-RU')}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500 dark:text-slate-400">Роли</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {viewUser.roles.filter(r => r !== 'parent').map(r => (
                    <span key={r} className={`${roleBadgeClass(r)} text-xs px-2 py-0.5 rounded`}>
                      {ROLE_OPTIONS.find(o => o.value === r)?.label || r}
                    </span>
                  ))}
                  {(viewUser.curated_classes ?? []).map(cls => (
                    <span key={cls} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">
                      Куратор {cls}
                    </span>
                  ))}
                </div>
              </div>
              {viewUser.must_change_password && viewUser.temp_password && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-500 dark:text-slate-400">Врем. пароль</span>
                  <button
                    onClick={() => copyToClipboard(viewUser.temp_password!, 'temp_card')}
                    className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-mono hover:bg-yellow-100 transition-colors cursor-copy"
                    title="Нажмите, чтобы скопировать"
                  >
                    {copiedField === 'temp_card' ? '✓ Скопировано' : viewUser.temp_password}
                  </button>
                </div>
              )}
            </div>
            {!readOnly && (
              <div className="flex gap-2 mt-6 pt-4 border-t">
                <button
                  onClick={() => { openEdit(viewUser); setViewUser(null); }}
                  className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Изменить
                </button>
                <button
                  onClick={() => { handleResetPassword(viewUser); setViewUser(null); }}
                  className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Сбросить пароль
                </button>
                <button
                  onClick={() => { handleDelete(viewUser); setViewUser(null); }}
                  className="flex-1 px-3 py-2 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Добавление сотрудников</h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b">
                    <th className="pb-2 font-medium">Фамилия *</th>
                    <th className="pb-2 font-medium pl-2">Имя *</th>
                    <th className="pb-2 font-medium pl-2">Email</th>
                    <th className="pb-2 font-medium pl-2">Телефон</th>
                    <th className="pb-2 font-medium pl-2 text-center">Админ</th>
                    <th className="pb-2 font-medium pl-2 text-center">Учитель</th>
                    <th className="pb-2 font-medium pl-2 text-center">СППС</th>
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
                      <td className="py-1 px-1 text-center">
                        <input type="checkbox" checked={row.roles.includes('spps')} onChange={() => toggleRowRole(idx, 'spps')} />
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
              <button onClick={() => setRows(r => [...r, emptyRow()])} className="text-purple-600 hover:text-purple-800 text-sm">+ Ещё строка</button>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800">Отмена</button>
                <button onClick={handleCreate} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">Создать</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditUser(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактирование сотрудника</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">Фамилия *</label>
                <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">Имя *</label>
                <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">Email</label>
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">Телефон</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">Дата рождения</label>
                <input type="date" value={editForm.birth_date} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">Роли</label>
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
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800">Отмена</button>
              <button onClick={handleEdit} disabled={!editForm.first_name.trim() || !editForm.last_name.trim()} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
