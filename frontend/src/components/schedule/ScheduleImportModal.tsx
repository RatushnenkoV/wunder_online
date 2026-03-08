import { useState, useRef } from 'react';
import api from '../../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedLesson {
  class_name: string; weekday: number; period: number;
  subject_name: string; subject2_name: string | null;
  room_name: string | null; teacher_name: string | null;
}
interface MissingTeacher { name: string; similar: { id: number; name: string }[] }
interface DbEntity { id: number; name: string }
interface PreviewData {
  parsed_lessons: ParsedLesson[];
  missing_classes: string[]; missing_teachers: MissingTeacher[]; missing_rooms: string[];
  db_classes: DbEntity[]; db_teachers: DbEntity[]; db_rooms: DbEntity[];
  stats: { total_lessons: number; with_teacher: number };
}

// Class mappings: null = create, number = link to existing id
type ClassMappings = Record<string, number | null>;

// Teacher mappings
interface TeacherCreate { action: 'create'; first_name: string; last_name: string }
interface TeacherLink  { action: 'link';   id: number }
interface TeacherSkip  { action: 'skip' }
type TeacherMappingEntry = TeacherCreate | TeacherLink | TeacherSkip;
type TeacherMappings = Record<string, TeacherMappingEntry>;

// Room mappings
interface RoomCreate { action: 'create'; name: string }
interface RoomLink   { action: 'link';   id: number }
type RoomMappingEntry = RoomCreate | RoomLink;
type RoomMappings = Record<string, RoomMappingEntry>;

type Step = 'upload' | 'classes' | 'teachers' | 'rooms' | 'confirm' | 'done';
const ALL_STEPS: Step[] = ['upload', 'classes', 'teachers', 'rooms', 'confirm', 'done'];
const STEP_LABELS: Record<Step, string> = {
  upload: 'Файлы', classes: 'Классы', teachers: 'Учителя',
  rooms: 'Кабинеты', confirm: 'Подтверждение', done: 'Результат',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTeacherName(raw: string): { first_name: string; last_name: string } {
  const parts = raw.trim().split(/\s+/);
  // Default: Фамилия Имя (last_first)
  return { last_name: parts[0] ?? '', first_name: parts.slice(1).join(' ') };
}

// ─── FileDropZone ─────────────────────────────────────────────────────────────

function FileDropZone({ label, file, onChange }: {
  label: string; file: File | null; onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChange(f); }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <div className="text-3xl mb-2">{file ? '✅' : '📄'}</div>
      <div className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</div>
      {file
        ? <div className="text-xs text-green-600 mt-1">{file.name}</div>
        : <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">Перетащите или кликните для выбора .xlsx</div>}
    </div>
  );
}

// ─── StepsBar ─────────────────────────────────────────────────────────────────

function StepsBar({ current, activeSteps }: { current: Step; activeSteps: Step[] }) {
  const currentIdx = activeSteps.indexOf(current);
  return (
    <div className="flex items-center px-6 pt-4 pb-3 overflow-x-auto gap-1">
      {activeSteps.map((s, i) => {
        const done = i < currentIdx;
        const active = s === current;
        return (
          <div key={s} className="flex items-center shrink-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              done ? 'bg-green-500 text-white' : active ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
            }`}>{done ? '✓' : i + 1}</div>
            <span className={`text-xs mx-2 whitespace-nowrap ${active ? 'text-purple-600 font-medium' : done ? 'text-green-600' : 'text-gray-400 dark:text-slate-500'}`}>
              {STEP_LABELS[s]}
            </span>
            {i < activeSteps.length - 1 && (
              <div className={`w-6 h-px mr-1 ${i < currentIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ClassRow ─────────────────────────────────────────────────────────────────

function ClassRow({ name, mapping, options, onChange }: {
  name: string; mapping: number | null; options: DbEntity[];
  onChange: (v: number | null) => void;
}) {
  const isCreate = mapping === null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <span className="w-20 font-mono font-semibold text-gray-800 dark:text-slate-200 shrink-0">{name}</span>
      <div className="flex items-center gap-4 flex-1 flex-wrap text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" name={`cls_${name}`} checked={isCreate}
            onChange={() => onChange(null)} className="accent-purple-600" />
          <span className={isCreate ? 'text-purple-700 font-medium' : 'text-gray-500 dark:text-slate-400'}>Создать</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" name={`cls_${name}`} checked={!isCreate}
            onChange={() => onChange(options[0]?.id ?? null)} className="accent-purple-600" />
          <span className={!isCreate ? 'text-purple-700 font-medium' : 'text-gray-500 dark:text-slate-400'}>Связать с</span>
        </label>
        {!isCreate && (
          <select className="border rounded px-2 py-1 text-xs flex-1 min-w-32"
            value={mapping!}
            onChange={(e) => onChange(Number(e.target.value))}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

// ─── RoomRow ──────────────────────────────────────────────────────────────────

function RoomRow({ excelName, mapping, options, onChange }: {
  excelName: string; mapping: RoomMappingEntry; options: DbEntity[];
  onChange: (v: RoomMappingEntry) => void;
}) {
  const isCreate = mapping.action === 'create';
  return (
    <div className="py-2.5 border-b last:border-0 space-y-2">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="w-40 text-gray-500 dark:text-slate-400 text-xs shrink-0 truncate" title={excelName}>
          из файла: «{excelName}»
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" name={`room_${excelName}`} checked={isCreate}
            onChange={() => onChange({ action: 'create', name: excelName })}
            className="accent-purple-600" />
          <span className={isCreate ? 'text-purple-700 font-medium' : 'text-gray-500 dark:text-slate-400'}>Создать</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" name={`room_${excelName}`} checked={!isCreate}
            onChange={() => onChange({ action: 'link', id: options[0]?.id ?? 0 })}
            className="accent-purple-600" />
          <span className={!isCreate ? 'text-purple-700 font-medium' : 'text-gray-500 dark:text-slate-400'}>Связать с</span>
        </label>
        {!isCreate && (
          <select className="border rounded px-2 py-1 text-xs flex-1 min-w-32"
            value={(mapping as RoomLink).id}
            onChange={(e) => onChange({ action: 'link', id: Number(e.target.value) })}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
      {isCreate && (
        <div className="flex items-center gap-2 ml-44">
          <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Название:</span>
          <input
            type="text"
            className="border rounded px-2 py-1 text-sm flex-1"
            value={(mapping as RoomCreate).name}
            onChange={(e) => onChange({ action: 'create', name: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

// ─── TeacherRow ───────────────────────────────────────────────────────────────

function TeacherRow({ teacher, mapping, dbTeachers, onChange }: {
  teacher: MissingTeacher; mapping: TeacherMappingEntry; dbTeachers: DbEntity[];
  onChange: (v: TeacherMappingEntry) => void;
}) {
  const isCreate = mapping.action === 'create';
  const isLink   = mapping.action === 'link';

  function setAction(action: 'create' | 'link' | 'skip') {
    if (action === 'create') {
      const { first_name, last_name } = parseTeacherName(teacher.name);
      onChange({ action: 'create', first_name, last_name });
    } else if (action === 'link') {
      onChange({ action: 'link', id: teacher.similar[0]?.id ?? dbTeachers[0]?.id ?? 0 });
    } else {
      onChange({ action: 'skip' });
    }
  }

  // Toggle order: swap first_name ↔ last_name
  function toggleOrder() {
    if (!isCreate) return;
    const c = mapping as TeacherCreate;
    onChange({ action: 'create', first_name: c.last_name, last_name: c.first_name });
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      {/* Header: excel name + action radios */}
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 shrink-0 pt-0.5">
          «{teacher.name}»
        </span>
        <div className="flex gap-4 text-sm flex-wrap">
          {(['create', 'link', 'skip'] as const).map((action) => (
            <label key={action} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={`teacher_${teacher.name}`}
                checked={mapping.action === action}
                onChange={() => setAction(action)}
                className="accent-purple-600" />
              <span className={mapping.action === action ? 'text-purple-700 font-medium' : 'text-gray-500 dark:text-slate-400'}>
                {action === 'create' ? 'Создать' : action === 'link' ? 'Связать с' : 'Пропустить'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Create: editable name fields */}
      {isCreate && (
        <div className="space-y-2 pl-2">
          {/* Order toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-slate-400">Порядок:</span>
            <div className="flex rounded overflow-hidden border text-xs">
              {(['last_first', 'first_last'] as const).map((order) => {
                const c = mapping as TeacherCreate;
                // Detect current order: last_first means parts[0]=last, parts[1]=first
                // We track by comparing with parsed defaults
                const { last_name: parsedLast, first_name: parsedFirst } = parseTeacherName(teacher.name);
                const currentIsLastFirst = c.last_name === parsedLast && c.first_name === parsedFirst;
                const isActive = order === 'last_first' ? currentIsLastFirst : !currentIsLastFirst;
                return (
                  <button key={order} type="button"
                    className={`px-2.5 py-1 transition-colors ${isActive ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                    onClick={() => {
                      if (!isActive) toggleOrder();
                    }}>
                    {order === 'last_first' ? 'Фамилия Имя' : 'Имя Фамилия'}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Name inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-0.5">Фамилия</label>
              <input type="text" className="border rounded px-2 py-1.5 text-sm w-full"
                value={(mapping as TeacherCreate).last_name}
                onChange={(e) => onChange({ ...(mapping as TeacherCreate), last_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-0.5">Имя</label>
              <input type="text" className="border rounded px-2 py-1.5 text-sm w-full"
                value={(mapping as TeacherCreate).first_name}
                onChange={(e) => onChange({ ...(mapping as TeacherCreate), first_name: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* Link: teacher selector */}
      {isLink && (
        <div className="pl-2">
          <select className="border rounded px-2 py-1.5 text-sm w-full"
            value={(mapping as TeacherLink).id}
            onChange={(e) => onChange({ action: 'link', id: Number(e.target.value) })}>
            <option value="">— выбрать учителя —</option>
            {teacher.similar.length > 0 && (
              <optgroup label="★ Похожие по фамилии">
                {teacher.similar.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            )}
            <optgroup label="Все учителя">
              {dbTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ScheduleImportModal({ onClose, onImported }: {
  onClose: () => void; onImported: () => void;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [classesFile, setClassesFile] = useState<File | null>(null);
  const [teachersFile, setTeachersFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const [classMappings, setClassMappings] = useState<ClassMappings>({});
  const [teacherMappings, setTeacherMappings] = useState<TeacherMappings>({});
  const [roomMappings, setRoomMappings] = useState<RoomMappings>({});
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  function getActiveSteps(p: PreviewData | null): Step[] {
    return ALL_STEPS.filter((s) => {
      if (!p) return s === 'upload';
      if (s === 'classes') return p.missing_classes.length > 0;
      if (s === 'teachers') return p.missing_teachers.length > 0;
      if (s === 'rooms') return p.missing_rooms.length > 0;
      return true;
    });
  }

  const activeSteps = getActiveSteps(preview);

  function nextStep() {
    const idx = activeSteps.indexOf(step);
    if (idx < activeSteps.length - 1) setStep(activeSteps[idx + 1]);
  }
  function prevStep() {
    const idx = activeSteps.indexOf(step);
    if (idx > 0) setStep(activeSteps[idx - 1]);
  }

  async function handleAnalyse() {
    if (!classesFile) return;
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append('classes_file', classesFile);
      if (teachersFile) form.append('teachers_file', teachersFile);
      const res = await api.post('/school/schedule/import/preview/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data: PreviewData = res.data;
      setPreview(data);

      // Init class mappings
      const cm: ClassMappings = {};
      data.missing_classes.forEach((n) => { cm[n] = null; });
      setClassMappings(cm);

      // Init teacher mappings (auto-suggest link if exactly 1 similar)
      const tm: TeacherMappings = {};
      data.missing_teachers.forEach((t) => {
        if (t.similar.length === 1) {
          tm[t.name] = { action: 'link', id: t.similar[0].id };
        } else {
          const { first_name, last_name } = parseTeacherName(t.name);
          tm[t.name] = { action: 'create', first_name, last_name };
        }
      });
      setTeacherMappings(tm);

      // Init room mappings
      const rm: RoomMappings = {};
      data.missing_rooms.forEach((n) => { rm[n] = { action: 'create', name: n }; });
      setRoomMappings(rm);

      const steps = getActiveSteps(data);
      setStep(steps[1] ?? 'confirm');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Ошибка анализа');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setLoading(true); setError(null);
    try {
      const res = await api.post('/school/schedule/import/confirm/', {
        parsed_lessons: preview.parsed_lessons,
        class_mappings: classMappings,
        teacher_mappings: teacherMappings,
        room_mappings: roomMappings,
        replace_existing: replaceExisting,
      });
      setResult(res.data);
      setStep('done');
      onImported();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Импорт расписания из Excel</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Steps */}
        <div className="shrink-0 border-b">
          <StepsBar current={step} activeSteps={activeSteps} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Файл по классам обязателен. Файл по учителям нужен для привязки учителей к урокам.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FileDropZone label="Расписание по классам *" file={classesFile} onChange={setClassesFile} />
                <FileDropZone label="Расписание по учителям" file={teachersFile} onChange={setTeachersFile} />
              </div>
            </div>
          )}

          {/* ── CLASSES ── */}
          {step === 'classes' && preview && (
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                Эти классы найдены в файле, но отсутствуют в системе. <strong>Создать</strong> — добавить в систему, <strong>Связать с</strong> — использовать существующий (если в файле опечатка).
              </p>
              {preview.missing_classes.map((name) => (
                <ClassRow key={name} name={name}
                  mapping={classMappings[name] ?? null}
                  options={preview.db_classes}
                  onChange={(v) => setClassMappings((m) => ({ ...m, [name]: v }))} />
              ))}
            </div>
          )}

          {/* ── TEACHERS ── */}
          {step === 'teachers' && preview && (
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                Эти учителя найдены в файле, но отсутствуют в системе. При создании отредактируйте имя и фамилию.
                Учителя со звёздочкой ★ — похожи по фамилии.
              </p>
              <div className="space-y-2">
                {preview.missing_teachers.map((t) => (
                  <TeacherRow key={t.name} teacher={t}
                    mapping={teacherMappings[t.name] ?? { action: 'create', ...parseTeacherName(t.name) }}
                    dbTeachers={preview.db_teachers}
                    onChange={(v) => setTeacherMappings((m) => ({ ...m, [t.name]: v }))} />
                ))}
              </div>
            </div>
          )}

          {/* ── ROOMS ── */}
          {step === 'rooms' && preview && (
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                Эти кабинеты найдены в файле, но отсутствуют в системе. При создании можно отредактировать название.
              </p>
              {preview.missing_rooms.map((name) => (
                <RoomRow key={name} excelName={name}
                  mapping={roomMappings[name] ?? { action: 'create', name }}
                  options={preview.db_rooms}
                  onChange={(v) => setRoomMappings((m) => ({ ...m, [name]: v }))} />
              ))}
            </div>
          )}

          {/* ── CONFIRM ── */}
          {step === 'confirm' && preview && (
            <div className="space-y-5">
              <div className="bg-purple-50 rounded-lg p-4 text-sm text-purple-900 space-y-1.5">
                <div className="font-semibold text-base mb-2">Итог анализа</div>
                <div className="flex justify-between"><span>Уроков в файле:</span><strong>{preview.stats.total_lessons}</strong></div>
                <div className="flex justify-between"><span>С учителем:</span><strong>{preview.stats.with_teacher}</strong></div>
                {preview.missing_classes.length > 0 && <div className="flex justify-between"><span>Классов к обработке:</span><strong>{preview.missing_classes.length}</strong></div>}
                {preview.missing_teachers.length > 0 && <div className="flex justify-between"><span>Учителей к обработке:</span><strong>{preview.missing_teachers.length}</strong></div>}
                {preview.missing_rooms.length > 0 && <div className="flex justify-between"><span>Кабинетов к обработке:</span><strong>{preview.missing_rooms.length}</strong></div>}
              </div>

              <div className="border rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-red-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-slate-200">Удалить существующее расписание и заменить импортированным</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Если не отмечено — новые уроки добавятся к текущим</div>
                    {replaceExisting && <div className="text-xs text-red-600 mt-1 font-medium">⚠️ Все текущие уроки будут безвозвратно удалены</div>}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && result && (
            <div className="space-y-4 py-4 text-center">
              <div className="text-5xl">🎉</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Импорт завершён!</h3>
              <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 space-y-2 text-sm text-left max-w-xs mx-auto">
                <div className="flex justify-between py-1 border-b"><span className="text-gray-600 dark:text-slate-400">Создано уроков:</span><span className="font-semibold text-green-700">{result.created}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-gray-600 dark:text-slate-400">Пропущено:</span><span className="font-semibold text-gray-700 dark:text-slate-300">{result.skipped}</span></div>
                {result.errors.length > 0 && (
                  <div className="py-1">
                    <div className="flex justify-between"><span className="text-gray-600 dark:text-slate-400">Ошибок:</span><span className="font-semibold text-red-600">{result.errors.length}</span></div>
                    <details className="mt-2"><summary className="text-xs text-red-500 cursor-pointer">Показать</summary>
                      <ul className="mt-1 text-xs text-red-700 space-y-0.5 bg-red-50 rounded p-2 max-h-28 overflow-y-auto">
                        {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 px-6 py-4 border-t bg-gray-50 dark:bg-slate-900 rounded-b-xl shrink-0">
          {step === 'done' ? (
            <button onClick={onClose} className="ml-auto px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
              Закрыть
            </button>
          ) : (
            <>
              <div className="flex gap-2">
                <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 disabled:opacity-50">Отмена</button>
                {step !== 'upload' && (
                  <button onClick={prevStep} disabled={loading} className="px-4 py-2 text-sm border rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50">← Назад</button>
                )}
              </div>
              <div>
                {step === 'upload' && (
                  <button onClick={handleAnalyse} disabled={!classesFile || loading}
                    className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                    {loading ? 'Анализирую...' : 'Проверить →'}
                  </button>
                )}
                {step !== 'upload' && step !== 'confirm' && (
                  <button onClick={nextStep} disabled={loading}
                    className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                    Далее →
                  </button>
                )}
                {step === 'confirm' && (
                  <button onClick={handleImport} disabled={loading}
                    className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {loading ? 'Импортирую...' : 'Импортировать'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
