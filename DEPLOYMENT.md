# EAJ Ticketing — Production Deployment Guide

## 1. Server requirements
- PHP 8.2+ with `pdo_mysql`, `mbstring`, `openssl`, `pcntl` (for Reverb), `gd` or `imagick`
- MySQL 8 / MariaDB 10.6+
- Node 18+ (build only — not needed at runtime)
- nginx (or Apache) + HTTPS certificate (Let's Encrypt)
- Supervisor (or systemd) to keep Reverb + queue worker alive

## 2. First deploy

```bash
git clone <repo> /var/www/eaj-ticketing && cd /var/www/eaj-ticketing

cp .env.production.example .env      # fill in ALL values (DB, mail, Reverb keys, APP_URL)
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force         # optional: only if you want the demo lookups; edit seeder first!
php artisan storage:link

npm ci && npm run build              # emits hashed assets to public/build

php artisan optimize                 # caches config, routes, views
chown -R www-data:www-data storage bootstrap/cache
```

> **Important:** regenerate `REVERB_APP_ID/KEY/SECRET` for production — do not reuse the
> local dev values. Any random strings work; the key is what clients use to connect.

## 3. nginx (single origin: app + API + WebSockets)

```nginx
server {
    listen 443 ssl http2;
    server_name support.yourdomain.com;
    root /var/www/eaj-ticketing/public;
    index index.php;

    client_max_body_size 12m;   # attachment uploads (10MB) + headroom

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # WebSockets -> Reverb
    location /app/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }
}
```

## 4. Supervisor — keep Reverb & queue alive

```ini
[program:eaj-reverb]
command=php /var/www/eaj-ticketing/artisan reverb:start
autostart=true
autorestart=true
user=www-data

[program:eaj-queue]
command=php /var/www/eaj-ticketing/artisan queue:work --tries=3 --timeout=90
autostart=true
autorestart=true
user=www-data
```

## 5. Scheduler (auto-close, cache warm-ups)
Add to crontab:
```
* * * * * cd /var/www/eaj-ticketing && php artisan schedule:run >> /dev/null 2>&1
```

## 6. Each subsequent deploy

```bash
cd /var/www/eaj-ticketing
php artisan down
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
npm ci && npm run build
php artisan optimize:clear && php artisan optimize
supervisorctl restart eaj-reverb eaj-queue
php artisan up
```

## 7. Pre-launch checklist

- [ ] `APP_DEBUG=false`, `APP_ENV=production`, real `APP_URL`
- [ ] Fresh `APP_KEY` and fresh `REVERB_*` credentials
- [ ] Dedicated MySQL user (not root), strong password
- [ ] **Remove/replace demo accounts** — change every seeded password or reseed with real staff
- [ ] Mail configured (invites, future password resets)
- [ ] HTTPS enforced; `SESSION_SECURE_COOKIE=true`
- [ ] Backups scheduled for the database + `storage/app/public` (attachments/avatars)
- [ ] Test: register → appears in Admin → Clients → Pending → approve → client logs in
- [ ] Test: live chat between two browsers (WebSocket through nginx)
