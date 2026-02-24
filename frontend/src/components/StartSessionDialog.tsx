import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import type { SchoolClass } from '../types';

interface Props {
  lessonId: number;
  lessonTitle: string;
  onClose: () => void;
}

export default function StartSessionDialog({ lessonId, lessonTitle, onClose }: Props) {
  const navigate = useNavigate();
  const [classes,  setClasses]  = useState<SchoolClass[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get('/school/classes/').then(res => {
      setClasses(res.data);
      if (res.data.length > 0) setSelected(res.data[0].id);
    }).finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    if (!selected) return;
    setStarting(true);
    try {
      const res = await api.post('/lessons/sessions/', {
        lesson: lessonId,
        school_class: selected,
      });
      navigate(`/lessons/session/${res.data.id}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 mb-1">Начать урок</h2>
        <p className="text-sm text-gray-500 mb-4 truncate">{lessonTitle}</p>

        {loading ? (
          <div className="text-sm text-gray-400 text-center py-4">Загрузка классов...</div>
        ) : classes.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">Классы не найдены</div>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto mb-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Выберите класс</p>
            {classes.map(cls => (
              <label
                key={cls.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  selected === cls.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="school_class"
                  value={cls.id}
                  checked={selected === cls.id}
                  onChange={() => setSelected(cls.id)}
                  className="accent-blue-600"
                />
                <span className="text-sm font-medium">{cls.display_name}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleStart}
            disabled={!selected || starting || loading}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-1.5"
          >
            {starting ? (
              'Запуск...'
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Начать
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
