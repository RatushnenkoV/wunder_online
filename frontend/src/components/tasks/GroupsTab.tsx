import { useState } from 'react';
import type { FormEvent } from 'react';
import api from '../../api/client';
import type { TaskGroup, StaffUser } from '../../types';

interface GroupsTabProps {
  groups: TaskGroup[];
  staffList: StaffUser[];
  isAdmin: boolean;
  onGroupsChange: () => void;
}

export default function GroupsTab({ groups, staffList, isAdmin, onGroupsChange }: GroupsTabProps) {
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await api.post('/tasks/groups/', { name: newGroupName.trim() });
      setNewGroupName('');
      onGroupsChange();
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (id: number) => {
    if (!confirm('Удалить группу?')) return;
    await api.delete(`/tasks/groups/${id}/`);
    onGroupsChange();
  };

  const toggleMember = async (groupId: number, userId: number, isMember: boolean) => {
    await api.post(`/tasks/groups/${groupId}/members/`, { user_id: userId, action: isMember ? 'remove' : 'add' });
    onGroupsChange();
  };

  const joinLeave = async (groupId: number, isMember: boolean) => {
    await api.post(`/tasks/groups/${groupId}/members/`, { action: isMember ? 'remove' : 'add' });
    onGroupsChange();
  };

  return (
    <div className="max-w-2xl space-y-4">
      {isAdmin && (
        <form onSubmit={createGroup} className="flex gap-3">
          <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
            placeholder="Название новой группы"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={creating || !newGroupName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
            + Создать группу
          </button>
        </form>
      )}

      {groups.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Групп пока нет</p>
          {isAdmin && <p className="text-sm mt-1">Создайте первую группу выше</p>}
        </div>
      )}

      {groups.map(group => (
        <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <button onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
              className="flex items-center gap-2 text-left min-w-0">
              <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expandedId === group.id ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-semibold text-gray-900">{group.name}</span>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {group.members_detail.length} участн.
              </span>
              {group.is_member && (
                <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">вы участник</span>
              )}
            </button>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {!isAdmin && (
                <button onClick={() => joinLeave(group.id, group.is_member)}
                  className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    group.is_member ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                  {group.is_member ? 'Покинуть' : 'Вступить'}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => deleteGroup(group.id)}
                  className="text-sm px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                  Удалить
                </button>
              )}
            </div>
          </div>

          {expandedId === group.id && (
            <div className="border-t border-gray-100 px-5 py-4">
              {isAdmin ? (
                <div className="grid grid-cols-2 gap-2">
                  {staffList.map(user => {
                    const isMember = group.members.includes(user.id);
                    return (
                      <button key={user.id} onClick={() => toggleMember(group.id, user.id, isMember)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                          isMember ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}>
                        <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                          isMember ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}>
                          {isMember && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
                            </svg>
                          )}
                        </div>
                        <span className="truncate">{user.last_name} {user.first_name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {group.members_detail.length === 0
                    ? <p className="text-sm text-gray-400">Участников пока нет</p>
                    : group.members_detail.map(m => (
                        <div key={m.id} className="text-sm text-gray-700">{m.last_name} {m.first_name}</div>
                      ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
