import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { CTP, SchoolClass, Subject } from '../types/index';
import ContextMenu from '../components/ContextMenu';

export default function KTPListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ctps, setCtps] = useState<CTP[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ school_class: 0, subject: 0, is_public: true });
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [cloneModal, setCloneModal] = useState<{ ctpId: number; ctpName: string } | null>(null);
  const [cloneClassId, setCloneClassId] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<{ ctp: CTP; x: number; y: number } | null>(null);
  const menuBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const load = async () => {
    const params: Record<string, string> = {};
    if (tab === 'mine') params.mine = '1';
    if (classFilter) params.school_class = classFilter;
    if (subjectFilter) params.subject = subjectFilter;
    const res = await api.get('/ktp/', { params });
    setCtps(res.data);
  };

  const loadMeta = async () => {
    if (user?.is_admin || user?.is_teacher) {
      try {
        const [c, s] = await Promise.all([
          api.get('/school/classes/'),
          api.get('/school/subjects/'),
        ]);
        setClasses(c.data);
        setSubjects(s.data);
      } catch {}
    }
  };

  // Subjects shown in create form: from schedule if available, all subjects as fallback
  const filteredFormSubjects = form.school_class
    ? (classSubjects.length > 0 ? classSubjects : subjects)
    : [];

  const handleFormClassChange = async (classId: number) => {
    setForm(f => ({ ...f, school_class: classId, subject: 0 }));
    setClassSubjects([]);
    if (!classId) return;
    try {
      const res = await api.get(`/school/classes/${classId}/schedule-subjects/`);
      setClassSubjects(res.data);
    } catch {
      setClassSubjects([]);
    }
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { load(); }, [tab, classFilter, subjectFilter]);

  const handleCreate = async () => {
    if (!form.school_class || !form.subject) return;
    const res = await api.post('/ktp/', form);
    setShowCreate(false);
    navigate(`/ktp/${res.data.id}`);
  };

  const handleClone = async () => {
    if (!cloneModal || !cloneClassId) return;
    const res = await api.post(`/ktp/${cloneModal.ctpId}/copy/`, { school_class: cloneClassId });
    setCloneModal(null);
    setCloneClassId(0);
    navigate(`/ktp/${res.data.id}`);
  };

  const openCloneModal = (ctp: CTP) => {
    setCloneModal({ ctpId: ctp.id, ctpName: `${ctp.subject_name} — ${ctp.class_name}` });
    setCloneClassId(0);
    setCtxMenu(null);
  };

  const canCreate = user?.is_teacher || user?.is_admin;

  return (
    <div onClick={() => setCtxMenu(null)}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Календарно-тематические планы</h1>
        {canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            + Создать КТП
          </button>
        )}
      </div>

      {/* Tabs */}
      {canCreate && (
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'mine' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Мои
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Все
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Класс</label>
            <select
              value={form.school_class}
              onChange={e => handleFormClassChange(parseInt(e.target.value))}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value={0}>Выберите класс</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Предмет</label>
            <select
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: parseInt(e.target.value) }))}
              className="border rounded px-3 py-2 text-sm"
              disabled={!form.school_class}
            >
              <option value={0}>
                {!form.school_class ? 'Сначала выберите класс' : 'Выберите предмет'}
              </option>
              {filteredFormSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} />
            Публичный
          </label>
          <button onClick={handleCreate} disabled={!form.school_class || !form.subject} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">Создать</button>
          <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-sm">Отмена</button>
        </div>
      )}

      {/* Filters */}
      {canCreate && (
        <div className="flex gap-4 mb-4 flex-wrap">
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

      {/* KTP list */}
      <div className="grid gap-4">
        {ctps.map(ctp => (
          <div
            key={ctp.id}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition relative group"
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ ctp, x: e.clientX, y: e.clientY }); }}
          >
            <Link to={`/ktp/${ctp.id}`} className="block pr-8">
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
            {canCreate && (
              <button
                ref={el => { if (el) menuBtnRefs.current.set(ctp.id, el); }}
                onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setCtxMenu({ ctp, x: rect.left, y: rect.bottom }); }}
                className="absolute top-3 right-3 text-gray-300 hover:text-gray-600 p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
              >&#8942;</button>
            )}
          </div>
        ))}
        {ctps.length === 0 && (
          <p className="text-center text-gray-400 py-8">КТП не найдены</p>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={[
            { label: 'Открыть', onClick: () => { navigate(`/ktp/${ctxMenu.ctp.id}`); setCtxMenu(null); } },
            { label: 'Клонировать', onClick: () => openCloneModal(ctxMenu.ctp) },
          ]}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Clone modal */}
      {cloneModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setCloneModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Клонировать КТП</h3>
            <p className="text-sm text-gray-500 mb-4">{cloneModal.ctpName}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Целевой класс</label>
              <select
                value={cloneClassId}
                onChange={e => setCloneClassId(parseInt(e.target.value))}
                className="border rounded px-3 py-2 text-sm w-full"
              >
                <option value={0}>Выберите класс</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCloneModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Отмена</button>
              <button
                onClick={handleClone}
                disabled={!cloneClassId}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Клонировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
