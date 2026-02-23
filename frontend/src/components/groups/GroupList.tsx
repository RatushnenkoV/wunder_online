import type { GroupSummary } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  groups: GroupSummary[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreateClick: () => void;
}

export default function GroupList({ groups, activeId, onSelect, onCreateClick }: Props) {
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full bg-white border-r">
      <div className="px-4 py-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Группы</h2>
        {user?.is_admin && (
          <button
            onClick={onCreateClick}
            className="text-blue-600 hover:text-blue-800"
            title="Создать группу"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            {user?.is_admin ? 'Нет групп. Создайте первую!' : 'Вы не добавлены ни в одну группу.'}
          </div>
        )}
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelect(group.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              activeId === group.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-blue-600">
                  {group.name[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${activeId === group.id ? 'text-blue-700' : 'text-gray-800'}`}>
                  {group.name}
                </p>
                <p className="text-xs text-gray-400">{group.members_count} участн.</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
