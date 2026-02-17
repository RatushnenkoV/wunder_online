import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-blue-600">
                WunderOnline
              </Link>
              {user && (
                <>
                  <Link to="/ktp" className="text-gray-700 hover:text-blue-600">
                    КТП
                  </Link>
                  <Link to="/schedule" className="text-gray-700 hover:text-blue-600">
                    Расписание
                  </Link>
                  {user.is_admin && (
                    <>
                      <Link to="/admin/people" className="text-gray-700 hover:text-blue-600">
                        Люди
                      </Link>
                      <Link to="/admin/school" className="text-gray-700 hover:text-blue-600">
                        Школа
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
            {user && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {user.last_name} {user.first_name}
                  <span className="ml-2 text-xs text-gray-400">
                    ({user.roles.join(', ')})
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
