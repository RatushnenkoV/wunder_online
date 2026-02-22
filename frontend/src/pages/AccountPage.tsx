import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AccountPage() {
  const { user, changePassword, updatePhone } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Синхронизировать поле телефона когда user обновится из фонового запроса
  useEffect(() => {
    setPhone(user?.phone ?? '');
  }, [user?.phone]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Ошибка при смене пароля. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSave = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess(false);
    setPhoneLoading(true);
    try {
      await updatePhone(phone);
      setPhoneSuccess(true);
    } catch {
      setPhoneError('Не удалось сохранить. Попробуйте ещё раз.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    teacher: 'Учитель',
    student: 'Ученик',
    parent: 'Родитель',
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Аккаунт</h1>

      {/* Информация о пользователе */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Профиль
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg select-none">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div>
            <div className="text-base font-semibold text-gray-900">
              {user?.last_name} {user?.first_name}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              {user?.roles.map(r => roleLabels[r] ?? r).join(', ')}
            </div>
          </div>
        </div>
      </div>

      {/* Телефон */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Контакты
        </h2>
        {phoneSuccess && (
          <div className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm mb-4">
            Телефон сохранён
          </div>
        )}
        {phoneError && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">
            {phoneError}
          </div>
        )}
        <form onSubmit={handlePhoneSave} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Номер телефона
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneSuccess(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+7 (___) ___-__-__"
            />
          </div>
          <button
            type="submit"
            disabled={phoneLoading || phone === (user?.phone ?? '')}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {phoneLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </div>

      {/* Смена пароля */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Изменить пароль
        </h2>

        {success && (
          <div className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm mb-4">
            Пароль успешно изменён
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Новый пароль
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Подтвердите пароль
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Повторите новый пароль"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Сохранение...' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
