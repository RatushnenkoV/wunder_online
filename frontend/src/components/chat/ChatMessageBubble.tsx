import { useState, useEffect, useRef } from 'react';
import type { ChatMessage, ChatUser } from '../../types';

interface Props {
  message: ChatMessage;
  currentUser: ChatUser | null;
  isGroup: boolean;
  onReply: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onVotePoll?: (pollId: number, optionId: number) => void;
  onTakeTask?: (taskId: number) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

const URL_REGEX = /https?:\/\/[^\s<>"]+[^\s<>".,;!?)/]/g;

function renderTextWithLinks(text: string, isMine: boolean) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline break-all ${isMine ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export default function ChatMessageBubble({ message, currentUser, isGroup, onReply, onDelete, onVotePoll, onTakeTask }: Props) {
  const isMine = currentUser && message.sender?.id === currentUser.id;
  const [revoting, setRevoting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showPollResults, setShowPollResults] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  if (message.is_deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-4 py-0.5`}>
        <span className="text-xs text-gray-400 italic">Сообщение удалено</span>
      </div>
    );
  }

  const initials = message.sender
    ? `${message.sender.last_name[0] || ''}${message.sender.first_name[0] || ''}`.toUpperCase()
    : '?';

  // Poll card (full width, not a bubble)
  if (message.poll) {
    const poll = message.poll;
    const hasVoted = !revoting && poll.options.some((o) => o.user_voted);

    const handlePollVote = (optId: number) => {
      if (hasVoted) return;
      setRevoting(false);
      onVotePoll?.(poll.id, optId);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    };

    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-4 py-1 group`}>
        {!isMine && isGroup && (
          <div className="w-7 h-7 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-700 text-xs font-bold mr-2 mt-auto mb-1">
            {initials}
          </div>
        )}
        <div className="max-w-[80%] w-full">
          {!isMine && isGroup && message.sender && (
            <p className="text-xs text-blue-600 font-medium mb-0.5 pl-1">{message.sender.display_name}</p>
          )}
          <div
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm select-none"
            onContextMenu={handleContextMenu}
          >
            <p className="text-sm font-semibold text-gray-800 mb-3">{poll.question}</p>
            <div className="flex flex-col gap-2">
              {poll.options.map((opt) => {
                const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handlePollVote(opt.id)}
                    disabled={hasVoted}
                    className={`relative w-full rounded-xl px-3 py-2 text-left text-sm transition-colors overflow-hidden bg-gray-100 ${
                      hasVoted ? 'cursor-default text-gray-700' : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {/* Прогресс-бар — единый стиль для всех вариантов */}
                    {hasVoted && (
                      <div
                        className="absolute inset-y-0 left-0 rounded-xl bg-blue-200 opacity-60"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      {/* Галочка у выбранного варианта */}
                      <span className="flex-shrink-0 w-4 flex items-center justify-center">
                        {opt.user_voted && !revoting ? (
                          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </span>
                      <span className={`flex-1 ${opt.user_voted && !revoting ? 'font-medium text-blue-700' : ''}`}>
                        {opt.text}
                      </span>
                      {hasVoted && (
                        <span className="text-xs text-gray-500 flex-shrink-0">{pct}%</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                {poll.total_votes} {poll.total_votes === 1 ? 'голос' : poll.total_votes < 5 ? 'голоса' : 'голосов'}
                {' · '}{formatTime(message.created_at)}
              </p>
              <button
                onClick={() => setShowPollResults(true)}
                className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
              >
                Результаты
              </button>
            </div>
          </div>

          {/* Модал результатов */}
          {showPollResults && (
            <PollResultsModal poll={poll} onClose={() => setShowPollResults(false)} />
          )}

          {/* Контекстное меню */}
          {contextMenu && (
            <div
              ref={contextMenuRef}
              className="fixed z-50 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[160px]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              {poll.options.some((o) => o.user_voted) && (
                <button
                  onClick={() => { setRevoting(true); setContextMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Переголосовать
                </button>
              )}
              {(isMine || currentUser?.is_admin) && (
                <button
                  onClick={() => { onDelete(message); setContextMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Удалить опрос
                </button>
              )}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'order-first mr-1' : 'ml-1'}`}>
          {(isMine || currentUser?.is_admin) && (
            <button onClick={() => onDelete(message)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Удалить">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Task card
  if (message.task_preview) {
    const task = message.task_preview;

    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-4 py-1 group`}>
        {!isMine && isGroup && (
          <div className="w-7 h-7 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-700 text-xs font-bold mr-2 mt-auto mb-1">
            {initials}
          </div>
        )}
        <div className="max-w-[80%] w-full">
          {!isMine && isGroup && message.sender && (
            <p className="text-xs text-blue-600 font-medium mb-0.5 pl-1">{message.sender.display_name}</p>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 shadow-sm">
            {/* Заголовок */}
            <div className="flex items-start gap-2 mb-1">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">{task.title}</p>
            </div>
            {task.description && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2 pl-6">{task.description}</p>
            )}
            {task.due_date && (
              <p className="text-xs text-gray-500 mb-2 pl-6">Срок: {formatDate(task.due_date)}</p>
            )}

            {/* Разделитель */}
            <div className="border-t border-blue-100 mt-2 mb-2" />

            {/* Кнопка + список взявших */}
            <div className="flex flex-col gap-2">
              {!task.user_took && (
                <button
                  onClick={() => onTakeTask?.(task.id)}
                  className="self-start text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Взять задачу
                </button>
              )}

              {/* Список взявших — всегда виден */}
              <div>
                <p className="text-xs text-gray-400 mb-1.5">
                  {(task.takers ?? []).length === 0
                    ? 'Ещё никто не взял'
                    : (task.takers.length === 1 ? 'Взял:' : `Взяли (${task.takers.length}):`)}
                </p>
                {(task.takers ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {task.takers.map((t) => (
                      <span
                        key={t.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          t.id === currentUser?.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-blue-200 text-blue-700'
                        }`}
                      >
                        {t.id === currentUser?.id && (
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-2">{formatTime(message.created_at)}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'order-first mr-1' : 'ml-1'}`}>
          {(isMine || currentUser?.is_admin) && (
            <button onClick={() => onDelete(message)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Удалить">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-4 py-0.5 group`}>
      {/* Аватар (только для чужих в групповом чате) */}
      {!isMine && isGroup && (
        <div className="w-7 h-7 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-700 text-xs font-bold mr-2 mt-auto mb-1">
          {initials}
        </div>
      )}

      <div className={`max-w-[70%] ${!isMine && !isGroup ? '' : ''}`}>
        {/* Имя отправителя в групповом чате */}
        {!isMine && isGroup && message.sender && (
          <p className="text-xs text-blue-600 font-medium mb-0.5 pl-1">
            {message.sender.display_name}
          </p>
        )}

        {/* Пузырь */}
        <div
          className={`relative rounded-2xl px-3 py-2 shadow-sm ${
            isMine
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-white text-gray-800 rounded-bl-sm'
          }`}
        >
          {/* Цитата (reply) */}
          {message.reply_to_preview && (
            <div className={`mb-1.5 pl-2 border-l-2 ${isMine ? 'border-blue-300' : 'border-blue-400'}`}>
              <p className={`text-xs font-medium truncate ${isMine ? 'text-blue-200' : 'text-blue-600'}`}>
                {message.reply_to_preview.sender_name}
              </p>
              <p className={`text-xs truncate ${isMine ? 'text-blue-200' : 'text-gray-500'}`}>
                {message.reply_to_preview.text}
              </p>
            </div>
          )}

          {/* Текст */}
          {message.text && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {renderTextWithLinks(message.text, !!isMine)}
            </p>
          )}

          {/* Вложения */}
          {message.attachments.map((att) => (
            <div key={att.id} className="mt-1">
              {isImage(att.mime_type) ? (
                <img
                  src={att.file_url}
                  alt={att.original_name}
                  className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
                  onClick={() => window.open(att.file_url, '_blank')}
                />
              ) : (
                <a
                  href={att.file_url}
                  download={att.original_name}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    isMine ? 'bg-blue-400 hover:bg-blue-300' : 'bg-gray-100 hover:bg-gray-200'
                  } transition-colors`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{att.original_name}</p>
                    <p className={`text-xs ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                      {formatFileSize(att.file_size)}
                    </p>
                  </div>
                </a>
              )}
            </div>
          ))}

          {/* Время */}
          <p className={`text-[10px] mt-0.5 text-right ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>

      {/* Кнопки действий (появляются при hover) */}
      <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'order-first mr-1' : 'ml-1'}`}>
        <button
          onClick={() => onReply(message)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          title="Ответить"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        {(isMine || currentUser?.is_admin) && (
          <button
            onClick={() => onDelete(message)}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
            title="Удалить"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PollResultsModal ──────────────────────────────────────────────────────────

function PollResultsModal({ poll, onClose }: { poll: import('../../types').ChatPoll; onClose: () => void }) {
  const totalVotes = poll.total_votes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Результаты опроса</p>
            <p className="text-sm font-semibold text-gray-800 leading-snug">{poll.question}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Варианты */}
        <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-4">
          {poll.options.map((opt) => {
            const pct = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : 0;
            return (
              <div key={opt.id}>
                {/* Вариант + прогресс */}
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className={`text-sm flex-1 ${opt.user_voted ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                    {opt.user_voted && (
                      <svg className="w-3.5 h-3.5 inline mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {opt.text}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">{opt.vote_count} · {pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Список голосовавших */}
                {opt.voters.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {opt.voters.map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Никто не выбрал</p>
                )}
              </div>
            );
          })}

          {totalVotes === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Ещё никто не проголосовал</p>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-400 text-center">
            Всего голосов: {totalVotes}
          </p>
        </div>
      </div>
    </div>
  );
}
