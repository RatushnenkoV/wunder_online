import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../api/client';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (firstName: string, lastName: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<void>;
  updatePhone: (phone: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (stored && token) {
      setUser(JSON.parse(stored));
      setLoading(false);
      // Фоновое обновление — подхватываем изменения (телефон, роли), сделанные администратором
      api.get('/auth/me/').then((res) => {
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
      }).catch(() => {});
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (firstName: string, lastName: string, password: string) => {
    const res = await api.post('/auth/login/', {
      first_name: firstName,
      last_name: lastName,
      password,
    });
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    // Fetch full user data (includes children for parents)
    const meRes = await api.get('/auth/me/');
    localStorage.setItem('user', JSON.stringify(meRes.data));
    setUser(meRes.data);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const changePassword = async (newPassword: string) => {
    const res = await api.post('/auth/change-password/', { new_password: newPassword });
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    const updatedUser = { ...user!, must_change_password: false };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const updatePhone = async (phone: string) => {
    const res = await api.patch('/auth/me/', { phone });
    const updatedUser = { ...user!, phone: res.data.phone };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword, updatePhone, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
