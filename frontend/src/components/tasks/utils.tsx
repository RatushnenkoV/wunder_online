import type { Task, TaskStatus } from '../../types';

/** Парсит текст и делает URL-ссылки кликабельными */
export function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-blue-600 hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

/** Доступные переходы статуса для текущего пользователя */
export function getTransitions(task: Task) {
  const result: { to: TaskStatus; label: string }[] = [];
  // new→in_progress: только исполнитель
  if (task.status === 'new' && task.is_assignee) {
    result.push({ to: 'in_progress', label: 'Взять в работу' });
  }
  // in_progress→review: только исполнитель
  if (task.status === 'in_progress' && task.is_assignee) {
    result.push({ to: 'review', label: 'На проверку' });
  }
  // review→done/in_progress: только постановщик (can_reassign включает его)
  if (task.status === 'review' && task.can_reassign) {
    result.push({ to: 'done', label: 'Принять' });
    result.push({ to: 'in_progress', label: 'Вернуть на доработку' });
  }
  return result;
}

export function canDropTo(task: Task, toStatus: TaskStatus): boolean {
  if (toStatus === 'done') return false;
  if (task.status === toStatus) return false;
  return getTransitions(task).some(t => t.to === toStatus);
}
