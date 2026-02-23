import { useState, useEffect } from 'react';
import api from '../api/client';
import type { GroupSummary, GroupDetail } from '../types';
import GroupList from '../components/groups/GroupList';
import GroupChat from '../components/groups/GroupChat';
import CreateGroupModal from '../components/groups/CreateGroupModal';

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupDetail | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);

  useEffect(() => {
    api.get('/groups/').then((res) => {
      setGroups(res.data);
      if (res.data.length > 0 && !activeGroupId) {
        selectGroup(res.data[0].id);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectGroup = (id: number) => {
    setActiveGroupId(id);
    setActiveGroup(null);
    setLoadingGroup(true);
    api.get(`/groups/${id}/`).then((res) => {
      setActiveGroup(res.data);
    }).finally(() => setLoadingGroup(false));
  };

  const handleGroupCreated = (group: GroupDetail) => {
    setShowCreateModal(false);
    setGroups((prev) => [
      { id: group.id, name: group.name, description: group.description, created_by: group.created_by, members_count: group.members.length, created_at: group.created_at },
      ...prev,
    ]);
    selectGroup(group.id);
  };

  const handleGroupUpdated = (updated: GroupDetail) => {
    setActiveGroup(updated);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === updated.id
          ? { ...g, members_count: updated.members.length }
          : g
      )
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Список групп — сайдбар */}
      <div className="w-64 flex-shrink-0">
        <GroupList
          groups={groups}
          activeId={activeGroupId}
          onSelect={selectGroup}
          onCreateClick={() => setShowCreateModal(true)}
        />
      </div>

      {/* Чат */}
      <div className="flex-1 min-w-0">
        {loadingGroup && (
          <div className="flex items-center justify-center h-full text-gray-400">
            Загрузка...
          </div>
        )}
        {!loadingGroup && activeGroup && (
          <GroupChat group={activeGroup} onGroupUpdated={handleGroupUpdated} />
        )}
        {!loadingGroup && !activeGroup && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50">
            <svg className="w-16 h-16 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m0 0H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v5" />
            </svg>
            <p className="text-lg font-medium">Выберите группу</p>
            <p className="text-sm mt-1">или создайте новую</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
