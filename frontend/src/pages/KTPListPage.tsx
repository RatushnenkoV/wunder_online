import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { CTP, SchoolClass, Subject } from '../types';

export default function KTPListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ctps, setCtps] = useState<CTP[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ school_class: 0, subject: 0, is_public: true });
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  const load = async () => {
    const params: Record<string, string> = {};
    if (classFilter) params.school_class = classFilter;
    if (subjectFilter) params.subject = subjectFilter;
    const res = await api.get('/ktp/', { params });
    setCtps(res.data);
  };

  const loadMeta = async () => {
    if (user?.is_admin || user?.is_teacher) {
      const [c, s] = await Promise.all([
        api.get('/school/classes/'),
        api.get('/school/subjects/'),
      ]);
      setClasses(c.data);
      setSubjects(s.data);
    }
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { load(); }, [classFilter, subjectFilter]);

  const handleCreate = async () => {
    if (!form.school_class || !form.subject) return;
    const res = await api.post('/ktp/', form);
    setShowCreate(false);
    navigate(`/ktp/${res.data.id}`);
  };

  const canCreate = user?.is_teacher || user?.is_admin;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Календарно-тематические планы</h1>
        {canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            + Создать КТП
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Класс</label>
            <select value={form.school_class} onChange={e => setForm(f => ({ ...f, school_class: parseInt(e.target.value) }))} className="border rounded px-3 py-2 text-sm">
              <option value={0}>Выберите класс</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Предмет</label>
            <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: parseInt(e.target.value) }))} className="border rounded px-3 py-2 text-sm">
              <option value={0}>Выберите предмет</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} />
            Публичный
          </label>
          <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Создать</button>
        </div>
      )}

      {canCreate && (
        <div className="flex gap-4 mb-4">
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="">Все классы</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="">Все предметы</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-4">
        {ctps.map(ctp => (
          <Link key={ctp.id} to={`/ktp/${ctp.id}`} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition block">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{ctp.subject_name}</h3>
                <p className="text-gray-500 text-sm">
                  {ctp.class_name} | Учитель: {ctp.teacher_name} | Тем: {ctp.topics_count}
                </p>
              </div>
              <div className="flex gap-2">
                {!ctp.is_public && (
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded">Скрытый</span>
                )}
              </div>
            </div>
          </Link>
        ))}
        {ctps.length === 0 && (
          <p className="text-center text-gray-400 py-8">КТП не найдены</p>
        )}
      </div>
    </div>
  );
}
