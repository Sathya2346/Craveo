# Craveo — PHP edition

The same storefront and admin panel as `../client`, running on the **same MySQL schema** and the
**same database**, with the Express API replaced by a dependency-free **PHP 8** API.

Nothing in `../server` or `../client` was changed or removed: this folder is a standalone second
implementation. The React app is byte-for-byte the same code — only its Vite proxy/dev port and the
API it talks to differ.

| | Node edition (`../`) | PHP edition (this folder) |
| --- | --- | --- |
| Backend | Express 5 + mysql2 | PHP 8.1+ + PDO |
| Endpoints | 87 | 87 (identical paths, payloads and status codes) |
| Database | `craveo` (MySQL/MariaDB) | the **same** `craveo` database |
| Frontend | `client/` | `web/` (copy of the same app) |
| Tests | 65 API + 36 UI | **143 API + 36 UI** |

---

## 1. Layout

```
php-version/
├── api/                     PHP backend (front controller)
│   ├── index.php            router + /api/health + 404 handler
│   ├── config.php           env-driven config (DB, JWT, CORS, uploads)
│   ├── .env.example         copy to api/.env
│   ├── src/                 env, db (PDO), http, jwt, auth, validate, router, mappers
│   │   └── services/        settings/pricing, coupons, order workflow
│   └── routes/              public, auth, addresses, favourites, orders, reviews,
│                            uploads, admin_catalog, admin_marketing, admin_orders,
│                            admin_users, admin_reviews, admin_stats
├── web/                     React + Vite storefront & admin panel
├── database/
│   ├── schema.sql           14 tables (identical to the Node schema)
│   ├── seed.sql             demo data dump
│   └── install.sql          schema + demo data in one import
├── tests/
│   ├── api-smoke.mjs        143 end-to-end API assertions
│   └── cleanup.php          removes test accounts, repairs coupon counters
├── router.php               router for PHP's built-in server
├── .htaccess                Apache: /api -> PHP, everything else -> web/dist
└── uploads/                 uploaded images (git-ignored except .gitkeep)
```

---

## 2. Requirements

- **XAMPP** (or any Apache/Nginx + PHP 8.1+ and MySQL 5.7+/MariaDB 10.4+)
- PHP extensions: `pdo_mysql`, `fileinfo`, `mbstring` (all enabled in a default XAMPP)
- Node 20+ only for the React frontend

---

## 3. Run locally

### 3.1 Database

Start **MySQL** from the XAMPP control panel, then either reuse the existing `craveo` database or
create a fresh one:

```bash
# fresh database with schema + demo data
/c/xampp/mysql/bin/mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS craveo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
/c/xampp/mysql/bin/mysql.exe -u root craveo < database/install.sql
```

### 3.2 API

```bash
cd api
cp .env.example .env      # XAMPP defaults already match: root / empty password / craveo
cd ..
/c/xampp/php/php.exe -S localhost:8000 -t . router.php
# -> http://localhost:8000/api/health
```

`api/.env` is already created for this machine (XAMPP, port 3306, `craveo`, random `JWT_SECRET`).

### 3.3 Frontend

```bash
cd web
npm install
npm run dev               # -> http://localhost:5174 (proxies /api to :8000)
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@craveo.app` | `Admin@123` |
| Manager | `manager@craveo.app` | `Manager@123` |
| Customer | `priya@example.com` | `Customer@123` |

The PHP backend verifies both `$2y$` hashes it creates and the `$2a$`/`$2b$` hashes the Node seed
produced, so the same database works with either backend.

### Under XAMPP Apache instead of `php -S`

Copy (or symlink) this folder into `htdocs`, then open
`http://localhost/craveo-php/api/health`. `api/.htaccess` routes every request through
`api/index.php`; `.htaccess` in the root serves the built SPA from `web/dist`.

---

## 4. API surface

Every path, payload and status code matches the Node build, so the React app is unchanged:

- **Public** — `/api/restaurants`, `/api/restaurants/:idOrSlug(/foods)`, `/api/foods`,
  `/api/foods/:id(/reviews)`, `/api/categories`, `/api/banners`, `/api/coupons`, `/api/settings`,
  `/api/stats`, `/api/health`
- **Auth** — `/api/auth/register|login|me|password|logout|check-email`
- **Customer** — `/api/addresses`, `/api/favourites`, `/api/orders/quote`, `/api/orders`,
  `/api/orders/:id/cancel`, `/api/reviews`
- **Admin** — `/api/admin/stats`, `/api/admin/orders(/:id|/status|/payment)`, `/api/admin/users`,
  `/api/admin/reviews`, `/api/admin/restaurants|categories|foods`, `/api/admin/coupons|banners`,
  `/api/admin/settings(/reset)`, `/api/uploads/image`

Server-authoritative behaviours are preserved: pricing is recomputed from the database, coupons are
validated and locked inside the order transaction, stock is decremented with a conditional UPDATE
and restored on cancellation, and role gates return 401/403 exactly like the Express build.

---

## 5. Tests

```bash
# API: needs the PHP server on :8000
node tests/api-smoke.mjs

# UI: needs the PHP API (:8000) and Vite (:5174)
cd ../tools && APP_URL=http://localhost:5174 API_URL=http://localhost:8000 node ui-check.mjs

# tidy up the accounts the suite creates
php tests/cleanup.php
```

**Last run:** `143/143` API assertions pass, `36/36` headless-Chrome UI checks pass, **0 browser
errors**, **0 PHP warnings**. Covered: catalog filters, auth (register/login/profile/password),
address CRUD with default promotion, favourites, quote maths, coupon rules (unknown/minimum/percent
cap), order placement with stock decrement, cancellation with stock restore, the full
`PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED` workflow, review moderation, admin
CRUD for every entity, settings reset, role gates and validation errors.

---

## 6. Deploy

This stack needs a PHP runtime (Vercel's Node serverless model does not run PHP — use the Node
edition there). You can still host **only** `web/` on Vercel/Netlify as a static site
(`VITE_API_URL=https://your-php-api.com/api`) while the API runs on a PHP host.

**Single folder, Apache/cPanel shared hosting:**

```bash
cd web && npm run build          # produces web/dist
```

1. Upload the whole `php-version` folder (or just `api/`, `web/dist`, `uploads/`, `.htaccess`).
2. Create a MySQL database in cPanel and import `database/install.sql` (or `schema.sql` only).
3. Edit `api/.env`: `DB_*`, a long `JWT_SECRET`, `APP_ENV=production`, `CLIENT_ORIGIN=https://your-domain`.
4. Point the domain's document root at `php-version/` and make sure `mod_rewrite` + `.htaccess`
   are enabled.
5. `chmod 755 uploads/` so image uploads work.

**Any VPS / Docker host** with Apache or Nginx + PHP-FPM works the same way — `api/` only needs PHP,
`web/dist` is static files, and `uploads/` must be writable.

Health check after deploy: `GET /api/health` → `{"success":true,"data":{"database":"up",...}}`.

---

## 7. Notes

- **Rate limiting** uses a file-per-key fixed window in the system temp folder (single instance).
  Swap for Redis if you run several PHP workers behind a load balancer.
- **JWTs** are signed manually with HS256 (`src/jwt.php`); tokens from the Node build are *not*
  valid here unless both use the same `JWT_SECRET`.
- **Uploads** go to `uploads/` on disk. On ephemeral hosts, point the admin image fields at URLs
  instead (they accept any `https://` link).
- Payments remain simulated (`COD` / `UPI` / `CARD` just set the initial payment status).
