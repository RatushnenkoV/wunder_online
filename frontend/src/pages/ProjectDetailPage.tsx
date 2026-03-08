import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectDetail, ProjectMember, ProjectUser, ChatRestriction } from '../types';
import ProjectFeed from '../components/projects/ProjectFeed';
import ProjectAssignments from '../components/projects/ProjectAssignments';

type Tab = 'feed' | 'assignments';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
];

// ─── Restriction Modal (копия из ChatMembersPanel) ─────────────────────────────

function RestrictionModal({ student, onClose }: { student: ProjectUser; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restriction, setRestriction] = useState<ChatRestriction>({
    student_id: student.id,
    message_cooldown: 0,
    muted_until: null,
    no_links: false,
    no_files: false,
    no_polls: false,
  });
  const [muteMinutes, setMuteMinutes] = useState('');

  useEffect(() => {
    api.get(`/chat/restrictions/${student.id}/`)
      .then(res => {
        setRestriction(res.data);
        if (res.data.muted_until) {
          const remaining = Math.max(0, Math.round(
            (new Date(res.data.muted_until).getTime() - Date.now()) / 60000
          ));
          setMuteMinutes(remaining > 0 ? String(remaining) : '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [student.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let muted_until: string | null = null;
      if (muteMinutes && parseInt(muteMinutes) > 0) {
        const until = new Date(Date.now() + parseInt(muteMinutes) * 60 * 1000);
        muted_until = until.toISOString();
      }
      await api.put(`/chat/restrictions/${student.id}/`, { ...restriction, muted_until });
      onClose();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const isMuted = restriction.muted_until && new Date(restriction.muted_until) > new Date();
  const displayName = `${student.last_name || ''} ${student.first_name || ''}`.trim();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">Ограничения в чате</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{displayName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {loading ? (
          <div className="text-center py-6 text-gray-400 dark:text-slate-500 text-sm">Загрузка...</div>
        ) : (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Пауза между сообщениями (сек)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0}
                  value={restriction.message_cooldown}
                  onChange={e => setRestriction(r => ({ ...r, message_cooldown: Math.max(0, +e.target.value) }))}
                  className="w-24 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <span className="text-xs text-gray-400 dark:text-slate-500">0 — без ограничений</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Мьют на (минут)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0}
                  value={muteMinutes}
                  onChange={e => setMuteMinutes(e.target.value)}
                  placeholder="0"
                  className="w-24 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <span className="text-xs text-gray-400 dark:text-slate-500">0 — снять мьют</span>
              </div>
              {isMuted && (
                <p className="text-xs text-orange-500 mt-1">
                  Мьют до {new Date(restriction.muted_until!).toLocaleString('ru-RU')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {([
                { key: 'no_links' as const, label: 'Запрет ссылок' },
                { key: 'no_files' as const, label: 'Запрет файлов' },
                { key: 'no_polls' as const, label: 'Запрет опросов' },
              ]).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                  <div
                    onClick={() => setRestriction(r => ({ ...r, [key]: !r[key] }))}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${restriction[key] ? 'bg-red-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white dark:bg-slate-800 rounded-full shadow transition-all ${restriction[key] ? 'left-[22px]' : 'left-0.5'}`} />
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">Отмена</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-40"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Edit Project Modal ────────────────────────────────────────────────────────

function EditProjectModal({
  project,
  onClose,
  onSave,
}: {
  project: ProjectDetail;
  onClose: () => void;
  onSave: (name: string, description: string, color: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.cover_color);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/projects/${project.id}/`, { name: name.trim(), description, cover_color: color });
      onSave(name.trim(), description, color);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Редактировать проект</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Цвет</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteMembersModal({
  projectId,
  existingMembers,
  onClose,
  onAdded,
}: {
  projectId: number;
  existingMembers: ProjectMember[];
  onClose: () => void;
  onAdded: (member: ProjectMember) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  // Отслеживаем добавленных в этой сессии модала
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set(existingMembers.map(m => m.user.id)));

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      api.get(`/projects/users/?q=${encodeURIComponent(query)}&project_id=${projectId}`)
        .then(res => setResults(res.data))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, projectId]);

  const handleAdd = async (user: ProjectUser) => {
    setAdding(user.id);
    try {
      const role = user.is_teacher || user.is_admin ? 'teacher' : 'student';
      const res = await api.post(`/projects/${projectId}/members/`, { user_id: user.id, role });
      onAdded(res.data);
      setAddedIds(prev => new Set(prev).add(user.id));
      // Убираем из результатов поиска
      setResults(prev => prev.filter(u => u.id !== user.id));
    } catch { /* ignore */ } finally { setAdding(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Пригласить участников</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Введите фамилию или имя..."
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {loading && <p className="text-xs text-gray-400 dark:text-slate-500 text-center">Поиск...</p>}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map(u => {
              const isAlready = addedIds.has(u.id);
              return (
                <div key={u.id} className="flex items-center justify-between gap-2 py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{u.display_name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {u.is_teacher ? 'Педагог' : u.is_student ? 'Ученик' : ''}
                    </p>
                  </div>
                  {isAlready ? (
                    <span className="text-xs text-green-600 font-medium">добавлен ✓</span>
                  ) : (
                    <button
                      onClick={() => handleAdd(u)}
                      disabled={adding === u.id}
                      className="text-sm text-purple-600 hover:bg-purple-50 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {adding === u.id ? '...' : 'Добавить'}
                    </button>
                  )}
                </div>
              );
            })}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-2">Не найдено</p>
            )}
          </div>
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Members Modal ────────────────────────────────────────────────────────────

function MembersModal({
  project,
  isTeacher,
  isAdult,
  onClose,
  onRemove,
  onInvite,
}: {
  project: ProjectDetail;
  isTeacher: boolean;
  isAdult: boolean;
  onClose: () => void;
  onRemove: (uid: number) => void;
  onInvite: () => void;
}) {
  const { user } = useAuth();
  const [removing, setRemoving] = useState<number | null>(null);
  const [restrictionTarget, setRestrictionTarget] = useState<ProjectUser | null>(null);

  const handleRemove = async (uid: number) => {
    setRemoving(uid);
    try {
      await api.delete(`/projects/${project.id}/members/${uid}/`);
      onRemove(uid);
    } catch { /* ignore */ } finally { setRemoving(null); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Участники ({project.members.length})
            </h2>
            <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {project.members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{m.user.display_name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {m.role === 'teacher' ? 'Педагог' : 'Ученик'}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Ограничения: для взрослых (admin/teacher/parent) если участник — ученик */}
                  {isAdult && m.role === 'student' && (
                    <button
                      onClick={() => setRestrictionTarget(m.user)}
                      className="text-xs text-orange-500 hover:bg-orange-50 px-2 py-1 rounded"
                      title="Ограничения"
                    >
                      🚫
                    </button>
                  )}
                  {isTeacher && m.user.id !== user?.id && (
                    <button
                      onClick={() => handleRemove(m.user.id)}
                      disabled={removing === m.user.id}
                      className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50"
                    >
                      {removing === m.user.id ? '...' : 'Удалить'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isTeacher && (
            <div className="px-4 pb-4">
              <button
                onClick={onInvite}
                className="w-full border border-purple-600 text-purple-600 rounded-lg py-2 text-sm font-medium hover:bg-purple-50 transition-colors"
              >
                + Пригласить участника
              </button>
            </div>
          )}
        </div>
      </div>

      {restrictionTarget && (
        <RestrictionModal
          student={restrictionTarget}
          onClose={() => setRestrictionTarget(null)}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectId = parseInt(id || '0', 10);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('feed');
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    api.get(`/projects/${projectId}/`)
      .then(res => setProject(res.data))
      .catch(() => navigate('/projects'))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center flex-1 text-gray-400 dark:text-slate-500">Загрузка...</div>;
  }
  if (!project) return null;

  const isTeacher = project.my_role === 'teacher' || !!user?.is_admin;
  const isAdult = !!(user?.is_admin || user?.is_teacher || user?.is_parent);

  const handleMemberRemoved = (uid: number) => {
    setProject(prev => prev ? {
      ...prev,
      members: prev.members.filter(m => m.user.id !== uid),
      members_count: prev.members_count - 1,
    } : prev);
  };

  const handleMemberAdded = (member: ProjectMember) => {
    setProject(prev => prev ? {
      ...prev,
      members: [...prev.members, member],
      members_count: prev.members_count + 1,
    } : prev);
  };

  const handleProjectSaved = (name: string, description: string, cover_color: string) => {
    setProject(prev => prev ? { ...prev, name, description, cover_color } : prev);
    setShowEdit(false);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: project.cover_color }}
      >
        <button
          onClick={() => navigate('/projects')}
          className="text-white/80 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-base leading-tight truncate">{project.name}</h1>
          {project.description && (
            <p className="text-white/70 text-xs truncate">{project.description}</p>
          )}
        </div>
        {/* Кнопка редактирования (только для педагогов) */}
        {isTeacher && (
          <button
            onClick={() => setShowEdit(true)}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
            title="Редактировать проект"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        <button
          onClick={() => setShowMembers(true)}
          className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {project.members_count}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
        <button
          onClick={() => setTab('feed')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === 'feed' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
          }`}
        >
          Лента
        </button>
        <button
          onClick={() => setTab('assignments')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === 'assignments' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
          }`}
        >
          Задания
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden bg-gray-50 dark:bg-slate-900">
        {tab === 'feed' ? (
          <ProjectFeed projectId={projectId} isTeacher={isTeacher} isAdult={isAdult} />
        ) : (
          <ProjectAssignments projectId={projectId} isTeacher={isTeacher} />
        )}
      </div>

      {/* Modals */}
      {showEdit && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSave={handleProjectSaved}
        />
      )}

      {showMembers && (
        <MembersModal
          project={project}
          isTeacher={isTeacher}
          isAdult={isAdult}
          onClose={() => setShowMembers(false)}
          onRemove={handleMemberRemoved}
          onInvite={() => { setShowMembers(false); setShowInvite(true); }}
        />
      )}

      {showInvite && (
        <InviteMembersModal
          projectId={projectId}
          existingMembers={project.members}
          onClose={() => setShowInvite(false)}
          onAdded={handleMemberAdded}
        />
      )}
    </div>
  );
}
