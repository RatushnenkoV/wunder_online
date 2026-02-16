import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import api from '../api/client';
import type { User } from '../types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  teacher: 'Учитель',
  parent: 'Родитель',
  student: 'Ученик',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', roles: [] as string[] });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    const res = await api.get('/admin/users/', { params });
    setUsers(res.data);
  };

  useEffect(() => { load(); }, [search, roleFilter]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/admin/users/', form);
    setShowCreate(false);
    setForm({ first_name: '', last_name: '', email: '', phone: '', roles: [] });
    load();
  };

  const handleResetPassword = async (id: number) => {
    const res = await api.post(`/admin/users/${id}/reset-password/`);
    setMessage(`Новый пароль: ${res.data.temp_password}`);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить пользователя?')) return;
    await api.delete(`/admin/users/${id}/`);
    load();
  };

  const handleImport = async () => {
    if (!importFile) return;
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const res = await api.post('/admin/users/import/', fd);
      setMessage(`Создано: ${res.data.created_count}. Ошибки: ${res.data.errors.length}`);
      setImportFile(null);
      load();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка импорта');
    }
  };

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            + Создать
          </button>
          <label className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm cursor-pointer">
            Импорт
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} />
          </label>
          {importFile && (
            <button onClick={handleImport} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
              Загрузить {importFile.name}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-blue-400 hover:text-blue-600">x</button>
        </div>
      )}

      <div className="flex gap-4 mb-4">
        <input
          placeholder="Поиск по имени..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Все роли</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg shadow mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Имя" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="border rounded px-3 py-2 text-sm" required />
          <input placeholder="Фамилия" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="border rounded px-3 py-2 text-sm" required />
          <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Телефон" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
          <div className="flex gap-2 items-center col-span-full">
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={form.roles.includes(k)} onChange={() => toggleRole(k)} />
                {v}
              </label>
            ))}
            <button type="submit" className="ml-auto bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Создать
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">ФИО</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Роли</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Телефон</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Врем. пароль</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{u.last_name} {u.first_name}</td>
                <td className="px-4 py-3">
                  {u.roles.map(r => (
                    <span key={r} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded mr-1">
                      {ROLE_LABELS[r] || r}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3 text-gray-500">{u.email || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                <td className="px-4 py-3">
                  {u.must_change_password && u.temp_password ? (
                    <code className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs">{u.temp_password}</code>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button onClick={() => handleResetPassword(u.id)} className="text-blue-600 hover:text-blue-800 text-xs">
                    Сброс пароля
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800 text-xs">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center text-gray-400 py-8">Пользователи не найдены</p>
        )}
      </div>
    </div>
  );
}
