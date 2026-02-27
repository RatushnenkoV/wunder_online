import type { ChatMessage, ChatUser } from '../../types';

interface Props {
  message: ChatMessage;
  currentUser: ChatUser | null;
  isGroup: boolean;
  onReply: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
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

export default function ChatMessageBubble({ message, currentUser, isGroup, onReply, onDelete }: Props) {
  const isMine = currentUser && message.sender?.id === currentUser.id;

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
              {message.text}
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
