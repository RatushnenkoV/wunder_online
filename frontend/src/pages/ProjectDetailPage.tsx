import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectDetail, ProjectMember, ProjectUser } from '../types';
import ProjectFeed from '../components/projects/ProjectFeed';
import ProjectAssignments from '../components/projects/ProjectAssignments';

type Tab = 'feed' | 'assignments';

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
  const existingIds = new Set(existingMembers.map(m => m.user.id));

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
      const res = await api.post(`/projects/${projectId}/members/`, {
        user_id: user.id,
        role,
      });
      onAdded(res.data);
    } catch { /* ignore */ } finally { setAdding(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Пригласить участников</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && <p className="text-xs text-gray-400 text-center">Поиск...</p>}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map(u => {
              const isAlready = existingIds.has(u.id);
              return (
                <div key={u.id} className="flex items-center justify-between gap-2 py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.display_name}</p>
                    <p className="text-xs text-gray-400">
                      {u.is_teacher ? 'Педагог' : u.is_student ? 'Ученик' : ''}
                    </p>
                  </div>
                  {isAlready ? (
                    <span className="text-xs text-gray-400">уже в проекте</span>
                  ) : (
                    <button
                      onClick={() => handleAdd(u)}
                      disabled={adding === u.id}
                      className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {adding === u.id ? '...' : 'Добавить'}
                    </button>
                  )}
                </div>
              );
            })}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">Не найдено</p>
            )}
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
  onClose,
  onRemove,
  onInvite,
}: {
  project: ProjectDetail;
  isTeacher: boolean;
  onClose: () => void;
  onRemove: (uid: number) => void;
  onInvite: () => void;
}) {
  const { user } = useAuth();
  const [removing, setRemoving] = useState<number | null>(null);

  const handleRemove = async (uid: number) => {
    setRemoving(uid);
    try {
      await api.delete(`/projects/${project.id}/members/${uid}/`);
      onRemove(uid);
    } catch { /* ignore */ } finally { setRemoving(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Участники ({project.members.length})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto">
          {project.members.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.user.display_name}</p>
                <p className="text-xs text-gray-400">
                  {m.role === 'teacher' ? 'Педагог' : 'Ученик'}
                </p>
              </div>
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
          ))}
        </div>
        {isTeacher && (
          <div className="px-4 pb-4">
            <button
              onClick={onInvite}
              className="w-full border border-blue-600 text-blue-600 rounded-lg py-2 text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              + Пригласить участника
            </button>
          </div>
        )}
      </div>
    </div>
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

  useEffect(() => {
    api.get(`/projects/${projectId}/`)
      .then(res => setProject(res.data))
      .catch(() => navigate('/projects'))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 text-gray-400">Загрузка...</div>
    );
  }

  if (!project) return null;

  const isTeacher = project.my_role === 'teacher' || !!user?.is_admin;

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
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => setTab('feed')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === 'feed'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Лента
        </button>
        <button
          onClick={() => setTab('assignments')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === 'assignments'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Задания
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden bg-gray-50">
        {tab === 'feed' ? (
          <ProjectFeed projectId={projectId} isTeacher={isTeacher} />
        ) : (
          <ProjectAssignments projectId={projectId} isTeacher={isTeacher} />
        )}
      </div>

      {/* Modals */}
      {showMembers && (
        <MembersModal
          project={project}
          isTeacher={isTeacher}
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
          onAdded={member => {
            handleMemberAdded(member);
            setShowInvite(false);
          }}
        />
      )}
    </div>
  );
}
