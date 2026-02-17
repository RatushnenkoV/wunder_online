import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import PeoplePage from './pages/PeoplePage';
import SchoolPage from './pages/SchoolPage';
import SettingsPage from './pages/SettingsPage';
import KTPListPage from './pages/KTPListPage';
import KTPDetailPage from './pages/KTPDetailPage';
import SchedulePage from './pages/SchedulePage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Загрузка...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.must_change_password) return <Navigate to="/change-password" />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" />;

  return <>{children}</>;
}

function AuthRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user && user.must_change_password) return <Navigate to="/change-password" />;
  if (user) return <Navigate to="/" />;

  return <>{children}</>;
}

function PasswordRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!user.must_change_password) return <Navigate to="/" />;

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/change-password" element={<PasswordRoute><ChangePasswordPage /></PasswordRoute>} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/ktp" element={<KTPListPage />} />
            <Route path="/ktp/:id" element={<KTPDetailPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/admin/people" element={<ProtectedRoute adminOnly><PeoplePage /></ProtectedRoute>} />
            <Route path="/admin/school" element={<ProtectedRoute adminOnly><SchoolPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
