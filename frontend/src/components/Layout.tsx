import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type { TasksCount } from '../types';

function IconHome() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-14 0v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9m-2 0L12 3" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconTasks() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function IconPresentation() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.46-1.22a8.561 8.561 0 001.783-8.297M11.42 15.17a8.561 8.561 0 008.297-1.783" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasksCount, setTasksCount] = useState<TasksCount | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const loadTasksCount = useCallback(async () => {
    if (!user || user.must_change_password) return;
    try {
      const res = await api.get('/tasks/tasks/count/');
      setTasksCount(res.data);
    } catch {
      // ignore
    }
  }, [user]);

  // Обновлять счётчик при смене роута
  useEffect(() => {
    loadTasksCount();
  }, [location.pathname, loadTasksCount]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Закрывать сайдбар при смене роута (на мобильных)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Swipe жесты для мобильных
  useEffect(() => {
    const SWIPE_THRESHOLD = 50;
    const EDGE_ZONE = 48; // зона левого края для открытия

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;

      // Игнорируем вертикальные свайпы (скролл)
      if (Math.abs(dy) > Math.abs(dx)) {
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }

      if (dx > SWIPE_THRESHOLD && !sidebarOpen && touchStartX.current < EDGE_ZONE) {
        // Свайп вправо от левого края — открыть
        setSidebarOpen(true);
      } else if (dx < -SWIPE_THRESHOLD && sidebarOpen) {
        // Свайп влево при открытом сайдбаре — закрыть
        setSidebarOpen(false);
      }

      touchStartX.current = null;
      touchStartY.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [sidebarOpen]);

  const navItems = [
    { to: '/', label: 'Главная', icon: <IconHome />, end: true, badge: null },
    { to: '/ktp', label: 'КТП', icon: <IconBook />, end: false, badge: null },
    { to: '/schedule', label: 'Расписание', icon: <IconCalendar />, end: false, badge: null },
    {
      to: '/tasks',
      label: 'Задачи',
      icon: <IconTasks />,
      end: false,
      badge: tasksCount && tasksCount.total > 0 ? tasksCount.total : null,
    },
    { to: '/lessons', label: 'Уроки', icon: <IconPresentation />, end: false, badge: null },
    { to: '/requests', label: 'Заявки', icon: <IconWrench />, end: false, badge: null },
    ...(user?.is_admin
      ? [
          { to: '/admin/school', label: 'Ученики', icon: <IconUsers />, end: false, badge: null },
          { to: '/admin/people', label: 'Сотрудники', icon: <IconPeople />, end: false, badge: null },
          { to: '/admin/settings', label: 'Настройки', icon: <IconSettings />, end: false, badge: null },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Затемнение при открытом сайдбаре на мобильных */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Боковое меню */}
      <aside
        className={[
          'fixed top-0 left-0 h-full z-30 w-64 bg-white flex flex-col',
          'border-r border-gray-200 shadow-xl lg:shadow-none',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:flex-shrink-0',
        ].join(' ')}
      >
        {/* Логотип */}
        <div className="px-6 py-5 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600 tracking-tight">WunderOnline</span>
          </Link>
        </div>

        {/* Навигация */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors my-0.5',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== null && (
                    <span className="bg-blue-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Информация о пользователе */}
        {user && (
          <div className="border-t border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/account"
                className="flex items-center gap-2.5 min-w-0 rounded-lg hover:bg-gray-50 p-1 -m-1 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-700 font-bold text-xs select-none">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate leading-tight">
                    {user.last_name} {user.first_name}
                  </div>
                  <div className="text-xs text-gray-400 truncate leading-tight">
                    {user.roles.join(', ')}
                  </div>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                title="Выйти"
                className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <IconLogout />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Основной контент */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Топ-бар: только на мобильных/планшетах */}
        <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Открыть меню"
          >
            <IconMenu />
          </button>
          <span className="text-lg font-bold text-blue-600">WunderOnline</span>
        </header>

        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
