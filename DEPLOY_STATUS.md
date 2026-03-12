# Статус развёртывания WunderOnline

## Сделано ✅

- [x] Куплен VPS на ps.kz (Ubuntu)
- [x] Сменён пароль root
- [x] Обновлена система (`apt update && apt upgrade`)
- [x] Установлены базовые пакеты (git, curl, wget, nano, ufw, fail2ban)
- [x] Создан пользователь `wunder` с sudo-правами
- [x] Настроен firewall (ufw: SSH + 80 + 443)
- [x] Установлен Python 3.12
- [x] Установлен PostgreSQL, создана БД `wunder_db` и пользователь `wunder_user`
- [x] Установлен Redis
- [x] Установлен Node.js 20
- [x] Установлен Nginx
- [x] Клонирован проект (`git clone` в `/var/www/wunder`)
- [x] Создан venv, установлены зависимости (`pip install -r requirements.txt`)
- [x] Вручную доустановлены `channels`, `channels-redis`, `daphne` (не попали в requirements.txt на сервере)
- [x] Создан и заполнен `.env`
- [x] Выполнен `python manage.py migrate`
- [x] Создан суперпользователь
- [x] `python manage.py collectstatic --noinput`
- [x] Сборка фронтенда (`npm install && npm run build`)
- [x] Systemd-сервис для Daphne (порт 8001)
- [x] Настройка Nginx (конфиг сайта, HTTP→HTTPS редирект)
- [x] SSL-сертификат Let's Encrypt (certbot --nginx)
- [x] Финальная проверка — сайт доступен по https://wunderos.kz

## Что нужно исправить в коде локально

- [x] `channels==4.2.0`, `channels-redis==4.2.1`, `daphne==4.1.2` — уже есть в `backend/requirements.txt`

## Безопасность (настроено 2026-03-11)

- [x] Swap 2 GB (`/swapfile`) — защита от OOM при пиках памяти
- [x] Ежедневные бэкапы БД в `/var/backups/wunder/` + отправка в Telegram (3:00 UTC)
- [x] Nginx security headers: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [x] TLS 1.2/1.3 only в Nginx
- [x] `client_max_body_size` снижен с 500M до 100M
- [x] Django: `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_CONTENT_TYPE_NOSNIFF`
- [x] fail2ban: добавлены jail-ы `django-login` (20 попыток / 5 мин → бан 30 мин) и `nginx-4xx` (30 запросов / 1 мин → бан 10 мин)

## Замеченные подводные камни

- `ALLOWED_HOSTS` — только имена хостов, **без** `https://`. Пример: `wunderos.kz,www.wunderos.kz`
- Daphne-сервис по умолчанию поднялся на порту **8000**, а Nginx ждёт **8001** — нужно явно прописать `-p 8001` в `ExecStart`
- Certbot не находит `server_name` если Nginx-конфиг ещё не создан — сначала создать конфиг, потом запускать certbot
