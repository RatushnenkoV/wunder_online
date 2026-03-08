import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import api from '../../api/client';
import type { Task, TaskStatus } from '../../types';
import FileIcon from './FileIcon';
import { getTransitions, linkify } from './utils';

interface TaskCardProps {
  task: Task;
  onStatusChange: (task: Task, to: TaskStatus, comment?: string) => void;
  onDelete: (task: Task) => void;
  onReassign: (task: Task) => void;
  onTaskUpdate: (task: Task) => void;
  onDragStart: (taskId: number) => void;
  onHide?: () => void;
}

export default function TaskCard({ task, onStatusChange, onDelete, onReassign, onTaskUpdate, onDragStart, onHide }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sendBackMode, setSendBackMode] = useState(false);
  const [sendBackComment, setSendBackComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transitions = getTransitions(task);

  const dueDateLabel = task.due_date
    ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })
    : null;
  const isPast = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/tasks/tasks/${task.id}/files/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onTaskUpdate({ ...task, files: [...task.files, res.data] });
    } catch {
      alert('Ошибка при загрузке файла');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    await api.delete(`/tasks/tasks/${task.id}/files/${fileId}/`);
    onTaskUpdate({ ...task, files: task.files.filter(f => f.id !== fileId) });
  };

  return (
    <div
      draggable={task.status !== 'done'}
      onDragStart={e => {
        e.dataTransfer.setData('taskId', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm transition-shadow select-none ${
        task.status !== 'done' ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''
      }`}
    >
      {/* Заголовок карточки */}
      <button className="w-full text-left px-4 py-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 leading-snug">{task.title}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {dueDateLabel && (
              <span className={`text-xs whitespace-nowrap px-1.5 py-0.5 rounded-full ${
                isPast ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>{dueDateLabel}</span>
            )}
            {onHide && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); onHide(); }}
                className="text-gray-300 hover:text-gray-500 transition-colors text-base leading-none px-1 -mr-1"
                title="Скрыть задачу">
                ×
              </span>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {task.assigned_to_name && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{task.assigned_to_name}</span>
          )}
          {task.assigned_group_name && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{task.assigned_group_name}</span>
          )}
          {task.taken_by_name && (
            <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
              взял: {task.taken_by_name}
            </span>
          )}
          {task.status === 'in_progress' && task.review_comment && (
            <span className="text-xs text-orange-700 bg-orange-50 rounded-full px-2 py-0.5">на доработке</span>
          )}
          {task.files.length > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <FileIcon /> {task.files.length}
            </span>
          )}
        </div>
      </button>

      {/* Раскрытая часть */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {/* Комментарий к доработке */}
          {task.status === 'in_progress' && task.review_comment && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800">
              <span className="font-medium">Комментарий к доработке: </span>
              {task.review_comment}
            </div>
          )}

          {/* Описание с активными ссылками */}
          {task.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {linkify(task.description)}
            </p>
          )}

          {/* Мета-информация */}
          <div className="text-xs text-gray-400 space-y-0.5">
            <div>Постановщик: {task.created_by_name}</div>
            {task.taken_by_name && <div>Взял в работу: {task.taken_by_name}</div>}
          </div>

          {/* Файлы */}
          {task.files.length > 0 && (
            <div className="space-y-1.5">
              {task.files.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-sm">
                  <FileIcon />
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-600 hover:underline truncate flex-1">
                    {f.original_name}
                  </a>
                  <button onClick={() => handleDeleteFile(f.id)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors" title="Удалить файл">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Сдача ученика (из проектного задания) */}
          {task.submission && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Работа ученика</p>
              {task.submission.text && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.submission.text}</p>
              )}
              {task.submission.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {task.submission.files.map(f => (
                    <a
                      key={f.id}
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <FileIcon />
                      <span className="max-w-[160px] truncate">{f.original_name}</span>
                    </a>
                  ))}
                </div>
              )}
              {!task.submission.text && task.submission.files.length === 0 && (
                <p className="text-xs text-gray-400">Работа сдана без текста и файлов</p>
              )}
            </div>
          )}

          {/* Прикрепить файл — недоступно для выполненных */}
          {task.status !== 'done' && (
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50">
                <FileIcon />
                {uploadingFile ? 'Загрузка...' : 'Прикрепить файл'}
              </button>
            </div>
          )}

          {/* Кнопки переходов */}
          {transitions.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {transitions
                  .filter(t => !(t.to === 'in_progress' && task.status === 'review'))
                  .map(t => (
                    <button key={t.to} onClick={() => onStatusChange(task, t.to)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        t.to === 'done' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                {transitions.some(t => t.to === 'in_progress' && task.status === 'review') && !sendBackMode && (
                  <button onClick={() => setSendBackMode(true)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                    Вернуть на доработку
                  </button>
                )}
              </div>
              {sendBackMode && (
                <div className="space-y-2">
                  <textarea
                    value={sendBackComment}
                    onChange={e => setSendBackComment(e.target.value)}
                    placeholder="Комментарий к доработке..."
                    rows={2}
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onStatusChange(task, 'in_progress', sendBackComment); setSendBackMode(false); setSendBackComment(''); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                      Отправить
                    </button>
                    <button
                      onClick={() => { setSendBackMode(false); setSendBackComment(''); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Переназначить и удалить — переназначение недоступно для выполненных */}
          <div className="flex items-center justify-between pt-1">
            {task.can_reassign && task.status !== 'done' && (
              <button onClick={() => onReassign(task)}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                Переназначить
              </button>
            )}
            {task.created_by === task.created_by /* всегда true, просто выравнивание */ && (
              <button onClick={() => onDelete(task)}
                className={`text-xs text-red-400 hover:text-red-600 transition-colors ${!task.can_reassign ? 'ml-auto' : ''}`}>
                Удалить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
