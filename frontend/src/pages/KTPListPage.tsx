import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { CTP, SchoolClass, Subject } from '../types/index';
import ContextMenu from '../components/ContextMenu';

interface SheetConfig {
  sheet_name: string;
  matched_subject_id: number | null;
  matched_subject_name: string | null;
  topics_count: number;
  selected_subject_id: number | null;
  teacher_id: number;
  skip: boolean;
}

interface ImportResult {
  sheet_name: string;
  ctp_id?: number;
  created_count?: number;
  error?: string;
}

type StaffUser = { id: number; first_name: string; last_name: string };
type ImportStep = 'idle' | 'analyzing' | 'configure' | 'importing' | 'done';

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

  // Bulk import state
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [detectedClassName, setDetectedClassName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(0);
  const [sheetConfigs, setSheetConfigs] = useState<SheetConfig[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

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

  // ── Bulk import ──────────────────────────────────────────────────────────────

  const openImportModal = async () => {
    setImportStep('idle');
    setImportFile(null);
    setDetectedClassName('');
    setSelectedClassId(0);
    setSheetConfigs([]);
    setImportResults([]);
    setImportProgress(0);
    setImportTotal(0);
    // Load staff list for teacher dropdowns (admin only)
    if (user?.is_admin && staffList.length === 0) {
      try {
        const r = await api.get('/admin/staff/', { params: { role: 'teacher', per_page: 100 } });
        setStaffList(r.data.results || []);
      } catch {}
    }
  };

  const handleImportFileSelect = async (file: File) => {
    setImportFile(file);
    setImportStep('analyzing');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/ktp/import-preview/', fd);
      setDetectedClassName(r.data.detected_class_name || '');
      // Try to match detected class name to class id
      const detectedClass = classes.find(c =>
        c.display_name === r.data.detected_class_name ||
        c.display_name?.toLowerCase().includes((r.data.detected_class_name || '').toLowerCase())
      );
      setSelectedClassId(detectedClass?.id || 0);
      setSheetConfigs((r.data.sheets as any[]).map(s => ({
        sheet_name: s.sheet_name,
        matched_subject_id: s.matched_subject_id,
        matched_subject_name: s.matched_subject_name,
        topics_count: s.topics_count,
        selected_subject_id: s.matched_subject_id,
        teacher_id: user?.id || 0,
        skip: false,
      })));
      setImportStep('configure');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Ошибка анализа файла');
      setImportStep('idle');
    }
  };

  const handleImportStart = async () => {
    if (!selectedClassId || !importFile) return;
    const toImport = sheetConfigs.filter(s => !s.skip && s.selected_subject_id);
    if (toImport.length === 0) return;

    setImportTotal(toImport.length);
    setImportProgress(0);
    setImportResults([]);
    setImportStep('importing');

    const results: ImportResult[] = [];
    for (let i = 0; i < toImport.length; i++) {
      const s = toImport[i];
      try {
        const fd = new FormData();
        fd.append('file', importFile);
        fd.append('sheet_name', s.sheet_name);
        fd.append('class_id', String(selectedClassId));
        fd.append('subject_id', String(s.selected_subject_id!));
        if (user?.is_admin && s.teacher_id) {
          fd.append('teacher_id', String(s.teacher_id));
        }
        const r = await api.post('/ktp/import-one-sheet/', fd);
        results.push({ sheet_name: s.sheet_name, ctp_id: r.data.ctp_id, created_count: r.data.created_count });
      } catch (err: any) {
        results.push({ sheet_name: s.sheet_name, error: err.response?.data?.detail || 'Ошибка' });
      }
      setImportProgress(i + 1);
    }
    setImportResults(results);
    setImportStep('done');
    load();
  };

  const closeImportModal = () => {
    setImportStep('idle');
  };

  const canCreate = user?.is_teacher || user?.is_admin;

  return (
    <div onClick={() => setCtxMenu(null)}>
      <h1 className="text-2xl font-bold mb-3">Календарно-тематические планы</h1>

      {/* Tabs + buttons row */}
      {canCreate && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 flex-1 w-fit max-w-fit">
            <button
              onClick={() => setTab('mine')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'mine' ? 'bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}
            >
              Мои
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'all' ? 'bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}
            >
              Все
            </button>
          </div>
          <div className="flex gap-2 ml-auto">
            <label
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm cursor-pointer flex items-center gap-1.5"
              onClick={e => { e.stopPropagation(); openImportModal(); setTimeout(() => importFileRef.current?.click(), 50); }}
            >
              <span>📥</span>
              <span className="hidden sm:inline">Импортировать</span>
            </label>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImportFileSelect(file);
                e.target.value = '';
              }}
            />
            <button onClick={() => setShowCreate(!showCreate)} className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm flex items-center gap-1.5">
              <span>+</span>
              <span className="hidden sm:inline">Создать КТП</span>
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Новый КТП</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Класс</label>
                <select
                  value={form.school_class}
                  onChange={e => handleFormClassChange(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value={0}>Выберите класс</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Предмет</label>
                <select
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: parseInt(e.target.value) }))}
                  className="w-full border rounded px-3 py-2 text-sm"
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
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">Отмена</button>
              <button
                onClick={handleCreate}
                disabled={!form.school_class || !form.subject}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk import modal */}
      {importStep !== 'idle' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={importStep === 'done' ? closeImportModal : undefined}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Analyzing */}
            {importStep === 'analyzing' && (
              <div className="p-8 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-2">Анализ файла...</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mb-6">{importFile?.name}</p>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-purple-500 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {/* Configure */}
            {importStep === 'configure' && (
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Настройка импорта</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{importFile?.name}</p>
                  </div>
                  <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                {/* Class selector */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Класс
                    {detectedClassName && <span className="ml-2 text-xs text-gray-400 dark:text-slate-500 font-normal">(распознан из названия файла: {detectedClassName})</span>}
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(parseInt(e.target.value))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value={0}>Выберите класс</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                  </select>
                </div>

                {/* Sheets table */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Листы в файле ({sheetConfigs.filter(s => !s.skip).length} из {sheetConfigs.length} будут импортированы)
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-700/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-400 w-8">
                            <input
                              type="checkbox"
                              checked={sheetConfigs.every(s => !s.skip)}
                              onChange={e => setSheetConfigs(cs => cs.map(s => ({ ...s, skip: !e.target.checked })))}
                              title="Выбрать все"
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-400">Лист</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-400">Предмет</th>
                          {user?.is_admin && <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-400">Учитель</th>}
                          <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-slate-400 w-16">Тем</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {sheetConfigs.map((s, i) => (
                          <tr key={s.sheet_name} className={s.skip ? 'opacity-40' : ''}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!s.skip}
                                onChange={e => setSheetConfigs(cs => cs.map((c, j) => j === i ? { ...c, skip: !e.target.checked } : c))}
                              />
                            </td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300 font-medium max-w-[160px] truncate" title={s.sheet_name}>
                              {s.sheet_name}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={s.selected_subject_id ?? ''}
                                onChange={e => setSheetConfigs(cs => cs.map((c, j) => j === i ? { ...c, selected_subject_id: e.target.value ? parseInt(e.target.value) : null } : c))}
                                className={`w-full border rounded px-2 py-1 text-xs ${!s.selected_subject_id ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}
                                disabled={s.skip}
                              >
                                <option value="">— не выбран —</option>
                                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                              </select>
                            </td>
                            {user?.is_admin && (
                              <td className="px-3 py-2">
                                <select
                                  value={s.teacher_id}
                                  onChange={e => setSheetConfigs(cs => cs.map((c, j) => j === i ? { ...c, teacher_id: parseInt(e.target.value) } : c))}
                                  className="w-full border rounded px-2 py-1 text-xs"
                                  disabled={s.skip}
                                >
                                  {user && <option value={user.id}>{user.first_name} {user.last_name} (я)</option>}
                                  {staffList.filter(st => st.id !== user?.id).map(st => (
                                    <option key={st.id} value={st.id}>{st.first_name} {st.last_name}</option>
                                  ))}
                                </select>
                              </td>
                            )}
                            <td className="px-3 py-2 text-center text-gray-500 dark:text-slate-400">{s.topics_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!selectedClassId && (
                  <p className="text-amber-600 text-sm mb-3">Выберите класс для импорта</p>
                )}
                {sheetConfigs.some(s => !s.skip && !s.selected_subject_id) && (
                  <p className="text-amber-600 text-sm mb-3">Для некоторых листов не выбран предмет — они будут пропущены</p>
                )}

                <div className="flex justify-end gap-2">
                  <button onClick={closeImportModal} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">Отмена</button>
                  <button
                    onClick={handleImportStart}
                    disabled={!selectedClassId || sheetConfigs.filter(s => !s.skip && s.selected_subject_id).length === 0}
                    className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                  >
                    Импортировать ({sheetConfigs.filter(s => !s.skip && s.selected_subject_id).length})
                  </button>
                </div>
              </div>
            )}

            {/* Importing */}
            {importStep === 'importing' && (
              <div className="p-8">
                <h3 className="text-lg font-semibold mb-2">Создание КТП...</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                  {importProgress} из {importTotal}
                </p>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-4">
                  <div
                    className="h-3 bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: importTotal ? `${(importProgress / importTotal) * 100}%` : '0%' }}
                  />
                </div>
                <div className="space-y-1">
                  {importResults.map(r => (
                    <div key={r.sheet_name} className="flex items-center gap-2 text-sm">
                      {r.error ? (
                        <span className="text-red-500">✗</span>
                      ) : (
                        <span className="text-green-500">✓</span>
                      )}
                      <span className="text-gray-700 dark:text-slate-300 truncate">{r.sheet_name}</span>
                      {r.created_count !== undefined && (
                        <span className="text-gray-400 dark:text-slate-500 text-xs shrink-0">{r.created_count} тем</span>
                      )}
                      {r.error && <span className="text-red-500 text-xs shrink-0">{r.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Done */}
            {importStep === 'done' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Импорт завершён</h3>
                <div className="space-y-2 mb-6">
                  {importResults.map(r => (
                    <div key={r.sheet_name} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${r.error ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                      <span className={r.error ? 'text-red-500' : 'text-green-600'}>
                        {r.error ? '✗' : '✓'}
                      </span>
                      <span className="flex-1 text-gray-700 dark:text-slate-300 truncate">{r.sheet_name}</span>
                      {r.created_count !== undefined && (
                        <span className="text-gray-500 dark:text-slate-400 shrink-0">{r.created_count} тем</span>
                      )}
                      {r.ctp_id && (
                        <button
                          onClick={() => { closeImportModal(); navigate(`/ktp/${r.ctp_id}`); }}
                          className="text-purple-600 hover:text-purple-800 text-xs shrink-0 underline"
                        >
                          Открыть
                        </button>
                      )}
                      {r.error && <span className="text-red-500 text-xs shrink-0">{r.error}</span>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={closeImportModal} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
                    Закрыть
                  </button>
                </div>
              </div>
            )}

          </div>
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
            className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow hover:shadow-md transition relative group"
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ ctp, x: e.clientX, y: e.clientY }); }}
          >
            <Link to={`/ktp/${ctp.id}`} className="block pr-8">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{ctp.subject_name}</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">
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
                className="absolute top-3 right-3 text-gray-300 dark:text-slate-600 hover:text-gray-600 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >&#8942;</button>
            )}
          </div>
        ))}
        {ctps.length === 0 && (
          <p className="text-center text-gray-400 dark:text-slate-500 py-8">КТП не найдены</p>
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
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Клонировать КТП</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{cloneModal.ctpName}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Целевой класс</label>
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
              <button onClick={() => setCloneModal(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">Отмена</button>
              <button
                onClick={handleClone}
                disabled={!cloneClassId}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
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
