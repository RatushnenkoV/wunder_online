# WunderOnline — Руководство по развёртыванию

> Пошаговый план запуска на продакшен-сервере.

---

## Шаг 0. Выбор и покупка сервера

Нужен VPS с Ubuntu **22.04 LTS или 24.04 LTS**. Минимальные характеристики: **2 CPU / 2 GB RAM / 20 GB SSD**.

Рекомендуемые провайдеры (РФ):
- [Timeweb Cloud](https://timeweb.cloud/) — облако, удобная панель
- [Selectel](https://selectel.ru/services/cloud/servers/) — надёжный, хорошая поддержка
- [Beget VPS](https://beget.com/ru/vps) — дёшево, просто

Рекомендуемые провайдеры (международные):
- [Hetzner](https://www.hetzner.com/cloud/) — лучшее соотношение цена/качество в Европе
- [DigitalOcean](https://www.digitalocean.com/products/droplets)

**После покупки**: у тебя будет IP-адрес сервера и root-пароль (или SSH-ключ).
Также нужен **домен** — купи его там же или отдельно (например, [reg.ru](https://www.reg.ru/)).
Направь A-запись домена на IP сервера в настройках DNS.

---

## Шаг 1. Первичная настройка сервера

Подключись к серверу:
```bash
ssh root@YOUR_SERVER_IP
```

Обнови систему и поставь базовые пакеты:
```bash
apt update && apt upgrade -y
apt install -y git curl wget nano ufw fail2ban
```

Создай пользователя (не работай под root):
```bash
adduser wunder
usermod -aG sudo wunder
# Скопируй SSH-ключ если нужно
rsync --archive --chown=wunder:wunder ~/.ssh /home/wunder
```

Настрой firewall:
```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Переключись на нового пользователя:
```bash
su - wunder
```

---

## Шаг 2. Установка Python 3.12

```bash
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3.12-dev build-essential libpq-dev
```

Проверка:
```bash
python3.12 --version
# Python 3.12.x
```

---

## Шаг 3. Установка PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Создай базу данных и пользователя:
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE wunder_db;
CREATE USER wunder_user WITH PASSWORD 'придумай_сложный_пароль';
ALTER ROLE wunder_user SET client_encoding TO 'utf8';
ALTER ROLE wunder_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE wunder_user SET timezone TO 'Europe/Moscow';
GRANT ALL PRIVILEGES ON DATABASE wunder_db TO wunder_user;
\q
```

---

## Шаг 4. Установка Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Проверка:
```bash
redis-cli ping
# PONG
```

---

## Шаг 5. Установка Node.js (для сборки фронтенда)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # v20.x.x
npm --version
```

---

## Шаг 6. Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Шаг 7. Клонирование проекта

```bash
sudo mkdir -p /var/www/wunder
sudo chown wunder:wunder /var/www/wunder
cd /var/www/wunder
git clone https://github.com/RatushnenkoV/wunder_online.git .
```

---

## Шаг 8. Настройка Python-окружения и зависимостей

```bash
cd /var/www/wunder
python3.12 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install -r backend/requirements.txt
```

---

## Шаг 9. Настройка переменных окружения

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Заполни файл:
```env
SECRET_KEY=сгенерируй_командой_ниже
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

DB_ENGINE=django.db.backends.postgresql
DB_NAME=wunder_db
DB_USER=wunder_user
DB_PASSWORD=придумай_сложный_пароль
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

REDIS_URL=redis://127.0.0.1:6379
```

Сгенерируй SECRET_KEY:
```bash
source /var/www/wunder/venv/bin/activate
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```
Скопируй результат в `SECRET_KEY=` в `.env`.

---

## Шаг 10. Подготовка Django

```bash
cd /var/www/wunder/backend
source /var/www/wunder/venv/bin/activate

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

Создай папку media если её нет:
```bash
mkdir -p /var/www/wunder/backend/media
```

---

## Шаг 11. Сборка фронтенда

```bash
cd /var/www/wunder/frontend
npm install
npm run build
# Результат: frontend/dist/
```

---

## Шаг 12. Systemd-сервис для Daphne

Создай файл сервиса:
```bash
sudo nano /etc/systemd/system/wunder.service
```

Вставь содержимое:
```ini
[Unit]
Description=WunderOnline Daphne ASGI Server
After=network.target postgresql.service redis.service

[Service]
User=wunder
Group=wunder
WorkingDirectory=/var/www/wunder/backend
EnvironmentFile=/var/www/wunder/backend/.env
ExecStart=/var/www/wunder/venv/bin/daphne -b 127.0.0.1 -p 8001 config.asgi:application
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Запусти сервис:
```bash
sudo systemctl daemon-reload
sudo systemctl enable daphne
sudo systemctl start daphne
sudo systemctl status daphne
```

Убедись что статус `active (running)`.

---

## Шаг 13. Настройка Nginx

Создай конфиг сайта:
```bash
sudo nano /etc/nginx/sites-available/wunder
```

Вставь (замени `yourdomain.com` на свой домен):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Фронтенд (React SPA)
    root /var/www/wunder/frontend/dist;
    index index.html;

    # Статика Django (admin, drf)
    location /static/ {
        alias /var/www/wunder/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Медиафайлы (загрузки пользователей)
    location /media/ {
        alias /var/www/wunder/backend/media/;
        expires 7d;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Django API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # React Router — все остальные пути отдаём index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Подключи и проверь:
```bash
sudo ln -s /etc/nginx/sites-available/wunder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Шаг 14. SSL-сертификат (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot автоматически:
- Получит бесплатный сертификат
- Настроит HTTPS в Nginx
- Добавит автообновление в cron

Проверь автообновление:
```bash
sudo certbot renew --dry-run
```

---

## Шаг 15. Проверка

Открой в браузере `https://yourdomain.com` — должна появиться страница входа WunderOnline.

Проверь логи если что-то не работает:
```bash
# Логи Django/Daphne
sudo journalctl -u daphne -f

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## Обновление проекта (после изменений в коде)

```bash
cd /var/www/wunder
git pull origin main          # или dev

# Backend
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart daphne

# Frontend (если были изменения)
cd /var/www/wunder/frontend
npm install
npm run build
```

---

## Бэкапы и защита данных

### Что нужно защищать

| Данные | Где хранятся | Что будет при потере |
|---|---|---|
| **База данных** (PostgreSQL) | на сервере | потеря всех пользователей, расписания, КТП, задач, новостей |
| **Медиафайлы** (`backend/media/`) | на сервере | потеря учебников, фото в новостях, вложений в задачах и чатах |
| **`.env` файл** | на сервере | потеря SECRET_KEY = все JWT-токены станут невалидными, нужно перенастраивать |
| **Код** | GitHub | не пропадёт, уже защищён |

---

### Шаг 1. Создай скрипт автобэкапа

```bash
sudo mkdir -p /var/backups/wunder
sudo chown wunder:wunder /var/backups/wunder
nano /var/www/wunder/backup.sh
```

Вставь содержимое:
```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/wunder"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=30

# --- База данных ---
pg_dump -U wunder_user wunder_db | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# --- Медиафайлы ---
tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" -C /var/www/wunder/backend media/

# --- Удалить старые бэкапы ---
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "media_*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "[$DATE] Backup done"
```

Сделай исполняемым:
```bash
chmod +x /var/www/wunder/backup.sh
```

Проверь что работает:
```bash
/var/www/wunder/backup.sh
ls -lh /var/backups/wunder/
```

---

### Шаг 2. Настрой автозапуск через cron

```bash
crontab -e
```

Добавь строку (бэкап каждый день в 3:00 ночи):
```
0 3 * * * /var/www/wunder/backup.sh >> /var/log/wunder_backup.log 2>&1
```

---

### Шаг 3. Настрой хранение бэкапов в облаке (рекомендуется)

Бэкапы только на том же сервере — ненадёжно: если сервер сгорит, пропадут вместе с ним. Нужно копировать куда-то ещё.

#### Вариант А: Yandex Object Storage (S3-совместимый, РФ)

Зарегистрируйся на [yandex.cloud](https://yandex.cloud/) и создай бакет. Затем:

```bash
# Установи утилиту s3cmd
sudo apt install -y s3cmd
s3cmd --configure
# Введи: Access Key, Secret Key, endpoint = storage.yandexcloud.net, и т.д.
```

Добавь в `backup.sh` перед последней строкой:
```bash
# --- Отправить в облако ---
s3cmd put "$BACKUP_DIR/db_$DATE.sql.gz" s3://имя-бакета/backups/
s3cmd put "$BACKUP_DIR/media_$DATE.tar.gz" s3://имя-бакета/backups/
```

#### Вариант Б: Второй сервер через rsync (проще)

Если есть второй сервер или домашний компьютер с Linux — добавь в cron на основном сервере:
```bash
rsync -avz /var/backups/wunder/ user@второй-сервер:/backups/wunder/
```

#### Вариант В: Telegram-бот (совсем просто)

Есть готовый скрипт `telegram-backup` — отправляет файл бэкапа в Telegram-чат. Небольшая БД (до 50MB) влезет в файл.

---

### Восстановление из бэкапа

```bash
# Восстановить базу данных
gunzip -c /var/backups/wunder/db_2026-03-01_03-00.sql.gz | psql -U wunder_user wunder_db

# Восстановить медиафайлы
tar -xzf /var/backups/wunder/media_2026-03-01_03-00.tar.gz -C /var/www/wunder/backend/
```

---

### Сохрани `.env` отдельно

Файл `.env` хранит пароли и SECRET_KEY — его нет в GitHub (и не должно быть). Сохрани его в надёжном месте:
- В менеджере паролей (Bitwarden, 1Password, KeePass)
- Или отправь себе зашифрованным сообщением в Telegram (Избранное)

---

## Шпаргалка команд

| Действие | Команда |
|---|---|
| Статус сервиса | `sudo systemctl status daphne` |
| Перезапуск Django | `sudo systemctl restart daphne` |
| Перезапуск Nginx | `sudo systemctl reload nginx` |
| Логи Django | `sudo journalctl -u daphne -f` |
| Логи Nginx | `sudo tail -f /var/log/nginx/error.log` |
| Консоль Django | `cd /var/www/wunder/backend && source ../venv/bin/activate && python manage.py shell` |
| Бэкап БД | `pg_dump -U wunder_user wunder_db > backup.sql` |
