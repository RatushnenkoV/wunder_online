import type { GroupTask } from '../../types';
import api from '../../api/client';

interface Props {
  task: GroupTask;
  groupId: number;
  onUpdated: (updated: GroupTask) => void;
}

export default function TaskCard({ task, groupId, onUpdated }: Props) {
  const handleToggleComplete = async () => {
    try {
      const res = await api.patch(`/groups/${groupId}/tasks/${task.id}/`, {
        is_completed: !task.is_completed,
      });
      onUpdated(res.data.task);
    } catch {
      // ignore
    }
  };

  const formatDeadline = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isOverdue = task.deadline && !task.is_completed && new Date(task.deadline) < new Date();

  return (
    <div className={`border rounded-lg p-3 mt-1 ${task.is_completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start gap-2">
        <button
          onClick={handleToggleComplete}
          className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.is_completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-400 hover:border-blue-500'
          }`}
        >
          {task.is_completed && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-1.5">
            {task.assignees.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Исполнители:</span>
                <div className="flex gap-1 flex-wrap">
                  {task.assignees.map((a) => (
                    <span key={a.id} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                      {a.last_name} {a.first_name[0]}.
                    </span>
                  ))}
                </div>
              </div>
            )}
            {task.deadline && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                isOverdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {isOverdue ? '⚠ ' : ''}до {formatDeadline(task.deadline)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
