import type { SlideType } from '../../types';

export default function SlideTypePicker({ onSelect, onClose }: { onSelect: (type: SlideType) => void; onClose: () => void }) {
  const types: { type: SlideType; icon: string; label: string; desc: string }[] = [
    { type: 'content',    icon: '📄', label: 'Контент',    desc: 'Свободный холст' },
    { type: 'form',       icon: '📋', label: 'Форма',      desc: 'Вопросы и ответы' },
    { type: 'quiz',       icon: '🏆', label: 'Викторина',  desc: 'Вопрос с таймером' },
    { type: 'video',      icon: '📹', label: 'Видео',      desc: 'YouTube и другие' },
    { type: 'discussion', icon: '💬', label: 'Доска',      desc: 'Стикеры + стрелки' },
    { type: 'vocab',      icon: '📚', label: 'Словарь',    desc: 'Заучивание слов' },
    { type: 'textbook',   icon: '📖', label: 'Учебник',    desc: 'Страницы из учебника' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-4">Выберите тип слайда</h2>
        <div className="grid grid-cols-2 gap-3">
          {types.map(({ type, icon, label, desc }) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-100 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 transition-all text-center"
            >
              <span className="text-3xl">{icon}</span>
              <div>
                <div className="font-medium text-sm text-gray-800 dark:text-slate-200">{label}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{desc}</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 transition-colors">Отмена</button>
      </div>
    </div>
  );
}
