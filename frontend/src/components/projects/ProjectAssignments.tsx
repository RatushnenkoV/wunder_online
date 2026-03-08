import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import type {
  ProjectAssignment, AssignmentSubmission, AssignmentAttachment, SubmissionFile, TaskStatus, Lesson, SubmissionEvent,
} from '../../types';

function formatDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

function FileChip({ attachment }: { attachment: AssignmentAttachment | SubmissionFile }) {
  return (
    <a
      href={attachment.file_url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 transition-colors"
    >
      <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <span className="max-w-[180px] truncate">{attachment.original_name}</span>
      <span className="text-gray-400">{formatFileSize(attachment.file_size)}</span>
    </a>
  );
}

// ─── Submission status badge ──────────────────────────────────────────────────

function SubmissionStatus({ taskStatus }: { taskStatus: TaskStatus | null | undefined }) {
  if (!taskStatus || taskStatus === 'new') {
    return <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Не сдано</span>;
  }
  if (taskStatus === 'review') {
    return <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">На проверке</span>;
  }
  if (taskStatus === 'in_progress') {
    return <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">На доработке</span>;
  }
  if (taskStatus === 'done') {
    return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Принято</span>;
  }
  return <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">Сдано</span>;
}

// ─── Event Timeline ───────────────────────────────────────────────────────────

const EVENT_CONFIG = {
  submitted: { label: 'Сдано', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
  sent_back: { label: 'На доработку', dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
  accepted:  { label: 'Принято',      dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-100'  },
} as const;

function EventTimeline({ events }: { events: SubmissionEvent[] }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">История</p>
      {events.map((ev, i) => {
        const c = EVENT_CONFIG[ev.type];
        return (
          <div key={i} className={`flex gap-2.5 border rounded-lg px-3 py-2 ${c.bg}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${c.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(ev.at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{ev.author}</p>
              {ev.comment && (
                <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{ev.comment}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Assignment Modal ─────────────────────────────────────────────────────────

function AssignmentModal({
  assignment,
  projectId,
  isTeacher,
  onClose,
  onUpdate,
  submissionsTrigger,
}: {
  assignment: ProjectAssignment;
  projectId: number;
  isTeacher: boolean;
  onClose: () => void;
  onUpdate: (a: ProjectAssignment) => void;
  submissionsTrigger?: number;
}) {
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submitText, setSubmitText] = useState(assignment.my_submission?.text || '');
  const [submitting, setSubmitting] = useState(false);
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionFile[]>(
    assignment.my_submission?.files || []
  );
  const [uploadingFile, setUploadingFile] = useState(false);
  // Teacher review actions
  const [sendBackMode, setSendBackMode] = useState<Record<number, boolean>>({});
  const [sendBackComments, setSendBackComments] = useState<Record<number, string>>({});
  const [actionSid, setActionSid] = useState<number | null>(null);
  // Edit mode (teacher only)
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(assignment.title);
  const [editDescription, setEditDescription] = useState(assignment.description);
  const [editDueDate, setEditDueDate] = useState(assignment.due_date || '');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isTeacher) {
      setLoadingSubmissions(true);
      api.get(`/projects/${projectId}/assignments/${assignment.id}/submissions/`)
        .then(res => setSubmissions(res.data))
        .finally(() => setLoadingSubmissions(false));
    }
  }, [projectId, assignment.id, isTeacher, submissionsTrigger]);

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await api.put(
        `/projects/${projectId}/assignments/${assignment.id}/`,
        { title: editTitle.trim(), description: editDescription, due_date: editDueDate || null }
      );
      onUpdate(res.data);
      setEditMode(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(
        `/projects/${projectId}/assignments/${assignment.id}/submissions/`,
        { text: submitText }
      );
      onUpdate({ ...assignment, my_submission: res.data });
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  const handleFileUpload = async (file: File) => {
    let sid = assignment.my_submission?.id;
    if (!sid) {
      // Create submission first
      const res = await api.post(
        `/projects/${projectId}/assignments/${assignment.id}/submissions/`,
        { text: submitText }
      );
      onUpdate({ ...assignment, my_submission: res.data });
      sid = res.data.id;
    }
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const fRes = await api.post(
        `/projects/${projectId}/assignments/${assignment.id}/submissions/${sid}/files/`,
        form
      );
      setSubmissionFiles(prev => [...prev, fRes.data]);
    } catch { /* ignore */ } finally { setUploadingFile(false); }
  };

  const handleAccept = async (sid: number) => {
    setActionSid(sid);
    try {
      const res = await api.post(
        `/projects/${projectId}/assignments/${assignment.id}/submissions/${sid}/accept/`
      );
      setSubmissions(prev => prev.map(s => s.id === sid ? res.data : s));
    } catch { /* ignore */ } finally { setActionSid(null); }
  };

  const handleSendBack = async (sid: number) => {
    const comment = sendBackComments[sid] || '';
    setActionSid(sid);
    try {
      const res = await api.post(
        `/projects/${projectId}/assignments/${assignment.id}/submissions/${sid}/send-back/`,
        { comment }
      );
      setSubmissions(prev => prev.map(s => s.id === sid ? res.data : s));
      setSendBackMode(prev => ({ ...prev, [sid]: false }));
      setSendBackComments(prev => ({ ...prev, [sid]: '' }));
    } catch { /* ignore */ } finally { setActionSid(null); }
  };

  const mySub = assignment.my_submission;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          {editMode ? (
            <div className="flex-1 min-w-0 pr-4 space-y-2">
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Название задания"
              />
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Описание..."
              />
              <input
                type="date"
                value={editDueDate}
                onChange={e => setEditDueDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editTitle.trim()}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{assignment.title}</h2>
                {isTeacher && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
                    title="Редактировать задание"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
              {assignment.due_date && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Срок сдачи: {formatDate(assignment.due_date)}
                </p>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          {!editMode && assignment.description && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.description}</p>
          )}

          {/* Attached lesson */}
          {assignment.lesson_title && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <span className="text-indigo-500">📖</span>
              <a href={`/lessons/editor/${assignment.lesson}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
                {assignment.lesson_title}
              </a>
            </div>
          )}

          {/* Assignment files */}
          {assignment.attachments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Материалы</p>
              <div className="flex flex-wrap gap-2">
                {assignment.attachments.map(a => <FileChip key={a.id} attachment={a} />)}
              </div>
            </div>
          )}

          {/* Student submission form */}
          {!isTeacher && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Моя работа</p>
                <SubmissionStatus taskStatus={mySub?.task_status} />
              </div>

              {/* Принято banner */}
              {mySub?.task_status === 'done' && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
                  Работа принята!
                </div>
              )}

              {/* Комментарий к доработке */}
              {mySub?.task_status === 'in_progress' && mySub.review_comment && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800">
                  <span className="font-medium">Комментарий к доработке: </span>
                  {mySub.review_comment}
                </div>
              )}

              {/* Submission history */}
              {mySub?.events && mySub.events.length > 0 && (
                <EventTimeline events={mySub.events} />
              )}

              <textarea
                value={submitText}
                onChange={e => setSubmitText(e.target.value)}
                placeholder="Ваш ответ или комментарий..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {submissionFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {submissionFiles.map(f => <FileChip key={f.id} attachment={f} />)}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {uploadingFile ? 'Загрузка...' : 'Прикрепить файл'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || mySub?.task_status === 'done'}
                  className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Отправка...' : mySub ? 'Обновить' : 'Сдать'}
                </button>
              </div>
            </div>
          )}

          {/* Teacher: submissions list */}
          {isTeacher && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Сдачи ({submissions.length})
              </p>
              {loadingSubmissions ? (
                <div className="text-sm text-gray-400">Загрузка...</div>
              ) : submissions.length === 0 ? (
                <div className="text-sm text-gray-400">Нет сдач</div>
              ) : (
                <div className="space-y-3">
                  {submissions.map(sub => (
                    <div key={sub.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      {/* Student info + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {sub.student.display_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            Сдано: {new Date(sub.submitted_at).toLocaleString('ru')}
                          </p>
                        </div>
                        <SubmissionStatus taskStatus={sub.task_status} />
                      </div>

                      {/* Submission history */}
                      {sub.events && sub.events.length > 0 && (
                        <EventTimeline events={sub.events} />
                      )}

                      {/* Submission text */}
                      {sub.text && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{sub.text}</p>
                      )}

                      {/* Submission files */}
                      {sub.files.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {sub.files.map(f => <FileChip key={f.id} attachment={f} />)}
                        </div>
                      )}

                      {/* Accept / SendBack actions (only when on review) */}
                      {sub.task_status === 'review' && (
                        <div>
                          {!sendBackMode[sub.id] ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAccept(sub.id)}
                                disabled={actionSid === sub.id}
                                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {actionSid === sub.id ? '...' : 'Принять'}
                              </button>
                              <button
                                onClick={() => setSendBackMode(prev => ({ ...prev, [sub.id]: true }))}
                                className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                              >
                                На доработку
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <textarea
                                value={sendBackComments[sub.id] || ''}
                                onChange={e => setSendBackComments(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                placeholder="Что нужно исправить?"
                                rows={2}
                                className="w-full rounded-lg border border-orange-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSendBack(sub.id)}
                                  disabled={actionSid === sub.id}
                                  className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                                >
                                  {actionSid === sub.id ? '...' : 'Отправить'}
                                </button>
                                <button
                                  onClick={() => setSendBackMode(prev => ({ ...prev, [sub.id]: false }))}
                                  className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Assignment Modal ──────────────────────────────────────────────────

function CreateAssignmentModal({
  projectId,
  onClose,
  onCreate,
}: {
  projectId: number;
  onClose: () => void;
  onCreate: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [pickerLessons, setPickerLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [createdAssignment, setCreatedAssignment] = useState<ProjectAssignment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/lessons/lessons/?picker=true').then(r => setPickerLessons(r.data)).catch(() => {});
  }, []);

  const ensureCreated = async (): Promise<ProjectAssignment | null> => {
    if (createdAssignment) return createdAssignment;
    if (!title.trim()) { setError('Введите название'); return null; }
    setLoading(true);
    try {
      const res = await api.post(`/projects/${projectId}/assignments/`, {
        title: title.trim(), description, due_date: dueDate || null, lesson: lessonId,
      });
      setCreatedAssignment(res.data);
      return res.data;
    } catch {
      setError('Ошибка при создании');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const assignment = await ensureCreated();
    if (!assignment) return;
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/projects/${projectId}/assignments/${assignment.id}/files/`, form);
      setAttachments(prev => [...prev, res.data]);
    } catch { /* ignore */ } finally { setUploadingFile(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignment = await ensureCreated();
    if (assignment) {
      onCreate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Новое задание</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Название задания"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Инструкции для учеников..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Срок сдачи (опционально)</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {pickerLessons.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Прикреплённый урок (опционально)</label>
              <select
                value={lessonId ?? ''}
                onChange={e => setLessonId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— не привязан —</option>
                {pickerLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-gray-700">Материалы</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {uploadingFile ? 'Загрузка...' : '+ Добавить файл'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = '';
                }}
              />
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map(a => <FileChip key={a.id} attachment={a} />)}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Assignment Card ──────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  isTeacher,
  onClick,
}: {
  assignment: ProjectAssignment;
  isTeacher: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl px-5 py-4 cursor-pointer hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{assignment.title}</h3>
          </div>
          {assignment.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{assignment.description}</p>
          )}
          {assignment.due_date && (
            <p className="text-xs text-gray-400">Срок: {formatDate(assignment.due_date)}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          {isTeacher ? (
            <div className="flex flex-col items-end gap-1">
              {assignment.review_count > 0 && (
                <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  {assignment.review_count} на проверке
                </span>
              )}
              <span className="text-xs text-gray-400">{assignment.submissions_count} сдач</span>
            </div>
          ) : (
            <SubmissionStatus taskStatus={assignment.my_submission?.task_status} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  isTeacher: boolean;
}

export default function ProjectAssignments({ projectId, isTeacher }: Props) {
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<ProjectAssignment | null>(null);
  const [submissionsRefreshTriggers, setSubmissionsRefreshTriggers] = useState<Record<number, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAssignments = useCallback(() => {
    api.get(`/projects/${projectId}/assignments/`)
      .then(res => {
        const list: ProjectAssignment[] = res.data;
        setAssignments(list);
        // Обновляем открытый модал, если задание там изменилось
        setSelected(prev => {
          if (!prev) return prev;
          return list.find(a => a.id === prev.id) ?? prev;
        });
      });
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/assignments/`)
      .then(res => setAssignments(res.data))
      .finally(() => setLoading(false));
  }, [projectId]);

  // WebSocket для real-time обновлений
  useEffect(() => {
    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/project/${projectId}/?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'assignment_updated') {
            fetchAssignments();
          } else if (data.type === 'submission_updated') {
            fetchAssignments();
            if (isTeacher && data.assignment_id) {
              setSubmissionsRefreshTriggers(prev => ({
                ...prev,
                [data.assignment_id]: (prev[data.assignment_id] ?? 0) + 1,
              }));
            }
          }
        } catch { /* ignore */ }
      };

      ws.onclose = (e) => {
        if (e.code !== 1000 && e.code !== 4001 && e.code !== 4003) {
          reconnectRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [projectId, isTeacher, fetchAssignments]);

  const handleUpdate = (updated: ProjectAssignment) => {
    setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a));
    if (selected?.id === updated.id) setSelected(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Задания</h3>
        {isTeacher && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать задание
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">Загрузка...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8">
          <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Нет заданий
          {isTeacher && (
            <button onClick={() => setShowCreate(true)} className="block mt-2 text-blue-600 text-sm hover:underline mx-auto">
              Создать первое задание
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              isTeacher={isTeacher}
              onClick={() => setSelected(a)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAssignmentModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreate={() => {
            fetchAssignments();
            setShowCreate(false);
          }}
        />
      )}

      {selected && (
        <AssignmentModal
          assignment={selected}
          projectId={projectId}
          isTeacher={isTeacher}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          submissionsTrigger={submissionsRefreshTriggers[selected.id] ?? 0}
        />
      )}
    </div>
  );
}
