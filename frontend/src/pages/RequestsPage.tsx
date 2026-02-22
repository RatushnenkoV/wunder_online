import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

// ─── АХО форма ───────────────────────────────────────────────────────────────

const NAMED_LOCATIONS = [
  'Рекреация',
  'Ресепшн',
  'Кухня',
  'Директорская',
  'Учительская',
  'Бухгалтерия',
  'Коворкинг',
  'Психолог',
  'Мед. кабинет',
  'Улица',
  'Новый корпус (1-2 этажи)',
];

const WORK_TYPES = [
  { value: 'furniture', label: 'Ремонт мебели' },
  { value: 'rooms', label: 'Ремонт помещений' },
  { value: 'plumbing', label: 'Ремонт сантехники' },
  { value: 'other', label: 'Прочее' },
];

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`text-2xl leading-none transition-colors select-none ${
              star <= (hover || value) ? 'text-yellow-400' : 'text-gray-200'
            }`}
            onClick={() => onChange(value === star ? 0 : star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function AhoTab() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<{ id: number; name: string }[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    name: user ? `${user.first_name} ${user.last_name}`.trim() : '',
    description: '',
    location: '',
    phone: user?.phone ?? '',
    work_type: '',
    urgency: 0,
    importance: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/school/rooms/').then((res) => setRooms(res.data)).catch(() => {});
  }, []);

  // Обновить телефон если пользователь сохранил его на странице аккаунта
  useEffect(() => {
    if (user?.phone && !form.phone) {
      setForm((p) => ({ ...p, phone: user.phone }));
    }
  }, [user?.phone]);

  const clearError = (field: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Поле обязательно для заполнения';
    if (!form.description.trim()) errs.description = 'Поле обязательно для заполнения';
    if (!form.work_type) errs.work_type = 'Поле обязательно для заполнения';
    if (!agreed) errs.agreed = 'Необходимо принять условия соглашения';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      await api.post('/school/aho/', {
        name: form.name,
        description: form.description,
        location: form.location,
        phone: form.phone,
        work_type: form.work_type,
        urgency: form.urgency ? String(form.urgency) : '',
        importance: form.importance ? String(form.importance) : '',
      });
      setSubmitted(true);
    } catch {
      setErrors({ submit: 'Ошибка отправки. Попробуйте ещё раз.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setForm((prev) => ({
      ...prev,
      description: '',
      location: '',
      work_type: '',
      urgency: 0,
      importance: 0,
    }));
    setAgreed(false);
    setErrors({});
  };

  if (submitted) {
    return (
      <div className="max-w-lg py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Отправлено!</h2>
        <p className="text-gray-500 mb-6">Ваша заявка принята в работу</p>
        <button
          onClick={handleReset}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          Отправить ещё одну
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-sm text-gray-500 mb-5">
          Форма для сбора заявок в административно-хозяйственный отдел
        </p>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ваше имя и фамилия <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`w-full px-3 py-2.5 border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors ${
                errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
              value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); clearError('name'); }}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Опишите задачу <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              className={`w-full px-3 py-2.5 border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none transition-colors ${
                errors.description ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
              value={form.description}
              onChange={(e) => { setForm((p) => ({ ...p, description: e.target.value })); clearError('description'); }}
              placeholder="Опишите, что нужно сделать..."
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Местоположение</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            >
              <option value="">— не выбрано —</option>
              {rooms.length > 0 && (
                <optgroup label="Кабинеты">
                  {rooms.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Помещения">
                {NAMED_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Укажите ваш номер телефона
            </label>
            <input
              type="tel"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+7 (___) ___-__-__"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Выберите вид работ <span className="text-red-500">*</span>
            </label>
            <select
              className={`w-full px-3 py-2.5 border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors ${
                errors.work_type ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
              value={form.work_type}
              onChange={(e) => { setForm((p) => ({ ...p, work_type: e.target.value })); clearError('work_type'); }}
            >
              <option value="">— выберите —</option>
              {WORK_TYPES.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
            {errors.work_type && <p className="text-red-500 text-xs mt-1">{errors.work_type}</p>}
          </div>

          <div className="flex gap-8">
            <StarRating
              value={form.urgency}
              onChange={(v) => setForm((p) => ({ ...p, urgency: v }))}
              label="Срочно"
            />
            <StarRating
              value={form.importance}
              onChange={(v) => setForm((p) => ({ ...p, importance: v }))}
              label="Важно"
            />
          </div>

          <div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 flex-shrink-0"
                checked={agreed}
                onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) clearError('agreed'); }}
              />
              <span className="text-sm text-gray-600">
                Нажимая на кнопку, я принимаю условия{' '}
                <a
                  href="https://wunderfamily.kz/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  соглашения
                </a>.
                <span className="text-red-500 ml-1">*</span>
              </span>
            </label>
            {errors.agreed && <p className="text-red-500 text-xs mt-1">{errors.agreed}</p>}
          </div>

          {errors.submit && <div className="text-red-500 text-sm">{errors.submit}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── ИТ-отдел (заглушка) ─────────────────────────────────────────────────────

function ItTab() {
  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-1">Раздел в разработке</h3>
        <p className="text-sm text-gray-400">Заявки в ИТ-отдел появятся здесь</p>
      </div>
    </div>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────

type Tab = 'aho' | 'it';

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('aho');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'aho', label: 'Заявки в АХО' },
    { id: 'it', label: 'Заявки в ИТ' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Заявки</h1>

      {/* Вкладки */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'aho' && <AhoTab />}
      {activeTab === 'it' && <ItTab />}
    </div>
  );
}
