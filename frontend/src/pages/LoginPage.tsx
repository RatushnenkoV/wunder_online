import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(firstName, lastName, password);
      navigate('/');
    } catch {
      setPassword('');
      setError('Неверные имя, фамилия или пароль');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-950 relative overflow-hidden">
      {/* Декоративная волна как на логотипе */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-700 rounded-full opacity-60 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-600 rounded-full opacity-40 blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full mx-4">
        {/* Логотип */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Wunder<span className="text-brand-400">Online</span>
          </h1>
          <p className="text-white/50 text-sm mt-2">Система управления школой</p>
        </div>

        <div className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Вход в систему</h2>
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-300 p-3 rounded-lg mb-4 text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Имя</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Фамилия</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-500 transition font-medium mt-2"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
