import type { GroupMessage, GroupTask } from '../../types';
import TaskCard from './TaskCard';

interface Props {
  message: GroupMessage;
  currentUserId: number;
  groupId: number;
  onTaskUpdated: (messageId: number, task: GroupTask) => void;
}

export default function MessageBubble({ message, currentUserId, groupId, onTaskUpdated }: Props) {
  const isMine = message.sender === currentUserId;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (message.message_type === 'task' && message.task) {
    return (
      <div className="px-4 py-1">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-gray-400">{message.sender_name}</span>
            <span className="text-xs text-gray-300">•</span>
            <span className="text-xs text-gray-400">{formatDate(message.created_at)}, {formatTime(message.created_at)}</span>
          </div>
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-3 py-1.5 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-xs font-medium text-blue-700">Задача</span>
            </div>
            <div className="p-3">
              <TaskCard
                task={message.task}
                groupId={groupId}
                onUpdated={(updated) => onTaskUpdated(message.id, updated)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-4 py-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMine && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">{message.sender_name}</span>
        )}

        {message.message_type === 'file' && message.file ? (
          <a
            href={message.file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-colors ${
              isMine
                ? 'bg-blue-500 border-blue-400 text-white hover:bg-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate max-w-[180px] ${isMine ? 'text-white' : 'text-gray-800'}`}>
                {message.file.original_filename}
              </p>
              <p className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                {formatFileSize(message.file.file_size)}
              </p>
            </div>
          </a>
        ) : (
          <div className={`px-3 py-2 rounded-2xl ${
            isMine ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-800'
          }`}>
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        )}

        <span className="text-xs text-gray-400 mt-0.5 mx-1">{formatTime(message.created_at)}</span>
      </div>
    </div>
  );
}
