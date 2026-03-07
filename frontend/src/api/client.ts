import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Флаг "обновление уже идёт" + очередь запросов, ожидающих новый токен.
// Нужно чтобы не делать 10 параллельных refresh-запросов,
// если сразу несколько запросов получили 401.
let isRefreshing = false;
let waitingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function flushQueue(error: unknown, token: string | null) {
  waitingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  waitingQueue = [];
}

function clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если не 401, или уже пробовали refresh для этого запроса — пробрасываем ошибку.
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Если обновление уже идёт — ставим запрос в очередь.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // POST /api/auth/refresh/ — simplejwt вернёт новый access + новый refresh (ротация).
      const { data } = await axios.post('/api/auth/refresh/', { refresh: refreshToken });
      localStorage.setItem('access_token', data.access);
      // При включённой ротации сервер возвращает новый refresh — сохраняем его.
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }
      api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
      flushQueue(null, data.access);
      originalRequest.headers.Authorization = `Bearer ${data.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
