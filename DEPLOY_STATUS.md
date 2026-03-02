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
- [x] Создан суперпользователь (admin/admin)
- [ ] `collectstatic` — в процессе (правим STATIC_ROOT в settings.py вручную)

## Осталось ⬜

- [ ] `python manage.py collectstatic --noinput` (после правки settings.py)
- [ ] Сборка фронтенда (`npm install && npm run build`)
- [ ] Systemd-сервис для Daphne
- [ ] Настройка Nginx (конфиг сайта)
- [ ] SSL-сертификат Let's Encrypt (если есть домен)
- [ ] Финальная проверка в браузере

## Что нужно исправить в коде локально (после деплоя)

- [ ] Добавить в `backend/config/settings.py` строки `STATIC_ROOT` и `STATICFILES_STORAGE` и запушить в GitHub
- [ ] Убедиться что `channels==4.2.0`, `channels-redis==4.2.1`, `daphne==4.1.2` есть в `backend/requirements.txt` и запушить
