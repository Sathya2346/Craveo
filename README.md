# Craveo — food delivery platform (MERN + MySQL)

A complete, production-shaped food delivery app: an animated storefront, a full customer
panel, and an admin panel where **everything the customer sees can be created, edited and
deleted** — restaurants, categories, dishes, prices, stock, banners, coupons, orders,
reviews, users and site copy.

- **Frontend:** React 18 + Vite, Framer Motion, Recharts, hand-written responsive CSS
- **Backend:** Node.js + Express 5, JWT auth with roles, Zod validation
- **Database:** MySQL 8 / MariaDB 10.4+ (`mysql2`, no ORM — plain SQL with parameterised queries)
- **Uploads:** Multer (local disk by default, see `DEPLOYMENT.md` for the serverless caveat)

---

## 1. What's inside

### Customer experience

| Area | What works |
| --- | --- |
| Home | Animated hero, announcement strip, category rail, featured kitchens, trending dishes, live offers, how-it-works |
| Browse | Search, category filter, veg / non-veg / egg filter, price sort, pagination, skeleton loading |
| Restaurant | Cover, live open/closed state, per-category menu, add to cart, sold-out and low-stock states |
| Dish detail | Gallery image, rating, macros, quantity picker, related dishes, verified reviews |
| Cart | Server-validated pricing, coupon apply/remove, minimum-order guard, free-delivery progress |
| Checkout | Saved or new address, COD/UPI/card, delivery instructions, server-authoritative bill |
| Orders | Status tabs, live tracker timeline, bill breakdown, cancel (with reason), per-dish reviews |
| Account | Profile + avatar upload, password change, up to 10 addresses, favourites, my reviews |
| Offers | Every active coupon with copy-to-clipboard, validated against your cart |

### Admin panel (`/admin`)

| Module | Capabilities |
| --- | --- |
| Dashboard | Revenue, orders, AOV, customers with period-over-period deltas; revenue trend, daily orders, status donut; top dishes, top kitchens, recent orders; 7/30/90-day ranges |
| Orders | Filter by status/search/date, full detail view, status workflow (accept → cook → dispatch → deliver), cancel with stock restore, payment status, delete cancelled orders |
| Dishes | Create/edit/delete, discount pricing with validation, stock, veg type, tags, featured flag, availability toggle, image upload |
| Categories | Create/edit/delete with unique slug generation, sort order, visibility |
| Restaurants | Create/edit/delete, delivery fee/time, minimum order, cost for two, open/closed toggle, card + cover images |
| Coupons | Percentage/flat, caps, min order, total + per-customer limits, start/end windows, pause |
| Banners | Hero/promo cards with CTA link, accent colour, ordering, visibility |
| Reviews | Publish/hide/delete; dish ratings recompute automatically |
| Users & roles | Create staff accounts, change roles, activate/deactivate, delete (order history protected), order counts and spend |
| Settings | Brand, announcement, contact, delivery fee, free-delivery threshold, tax %, currency, social links — live on the storefront |

Everything above is role-gated: `CUSTOMER` → `MANAGER` → `ADMIN`.

---

## 2. Project layout

```
MERN/
├── client/                  React + Vite storefront and admin panel
│   ├── src/components/      UI kit, cards, layouts
│   ├── src/context/         Auth, Cart, Favourites, Settings, Toast
│   ├── src/pages/           Public + user pages
│   ├── src/pages/admin/     Admin panel pages
│   └── vercel.json
├── server/                  Express API
│   ├── src/config/          env + MySQL pool
│   ├── src/db/              schema.sql, migrate.js, seed.js
│   ├── src/middleware/      auth, validation, errors, rate limit, upload
│   ├── src/modules/         auth, catalog, orders, reviews, admin/*
│   ├── src/services/        pricing, coupons, order workflow
│   ├── tests/               65 edge-case API tests
│   └── vercel.json
├── tools/ui-check.mjs       Headless-Chrome UI smoke checks (36 assertions)
├── TEST_REPORT.md           Test results, bugs found, known gaps
└── DEPLOYMENT.md            Step-by-step Vercel deployment
```

---

## 3. Quick start

### Prerequisites

- Node.js 20+ (built and tested on 22)
- XAMPP (MySQL/MariaDB) running locally, or any MySQL 8 / MariaDB 10.4+ server

### 3.1 API

```bash
cd server
npm install
cp .env.example .env          # then set DB_* and JWT_SECRET
npm run db:reset              # creates the schema and seeds demo data
npm run dev                   # http://localhost:5000
```

`npm run db:reset` **drops and recreates** every table, then seeds 6 restaurants,
31 dishes, 5 users, 4 coupons and 5 demo orders. Use `npm run db:migrate` alone if you
only want the schema.

> **Local database: XAMPP.** Start **Apache + MySQL** from the XAMPP control panel (MySQL must be
> listening on port **3306**), then run `npm run db:reset`. `server/.env` is already configured for
> the XAMPP default (`root`, no password):
>
> ```env
> DB_HOST=127.0.0.1
> DB_PORT=3306
> DB_USER=root
> DB_PASSWORD=
> DB_NAME=craveo
> ```
>
> Set a XAMPP root password? Put the same value in `DB_PASSWORD`. Prefer phpMyAdmin? Create an empty
> `craveo` database there (collation `utf8mb4_unicode_ci`) and `npm run db:reset` will fill it.

### 3.2 Client

```bash
cd client
npm install
cp .env.example .env          # leave VITE_API_URL empty for the dev proxy
npm run dev                   # http://localhost:5173
```

Vite proxies `/api` and `/uploads` to `http://localhost:5000`, so no CORS setup is needed
in development.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@craveo.app` | `Admin@123` |
| Manager | `manager@craveo.app` | `Manager@123` |
| Customer | `priya@example.com` | `Customer@123` |

The login page has one-tap buttons to fill these.

---

## 4. Environment variables

### `server/.env`

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL host |
| `DB_USER` / `DB_PASSWORD` | `root` / empty | MySQL credentials |
| `DB_NAME` | `craveo` | Database name |
| `DB_NAME_TEST` | `craveo_test` | Used by `npm test` |
| `JWT_SECRET` | dev fallback | **Required** in production |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `MAX_UPLOAD_MB` | `5` | Image upload cap |

### `client/.env`

| Variable | Notes |
| --- | --- |
| `VITE_API_URL` | Full API URL including `/api`, e.g. `https://craveo-api.vercel.app/api`. Empty in dev. |

---

## 5. How the important logic works

- **Money is server-authoritative.** The client can post any price it likes; `POST /api/orders`
  re-reads dish prices, applies the restaurant's minimum order, coupon rules, delivery fee,
  the free-delivery threshold and tax, then writes the totals. A tampered payload changes nothing.
- **Stock is transactional.** Order placement runs inside a `START TRANSACTION`, decrements
  stock with `WHERE stock >= ?`, and rolls everything back if any line fails. Cancellations
  and admin cancels restore stock and decrement coupon usage.
- **Status workflow is a graph, not a free-form field.** `PENDING → CONFIRMED → PREPARING →
  OUT_FOR_DELIVERY → DELIVERED`, with `CANCELLED` allowed until hand-off. Invalid jumps return 409.
- **Coupons are checked four ways:** active flag, date window, min order, and both global and
  per-customer usage limits (using a redemption ledger, so cancelled orders free the coupon).
- **Reviews are earned.** Only delivered orders can be reviewed, once per dish per order;
  hiding a review in the admin panel immediately recalculates the dish rating.
- **Roles are re-read on every request**, so deactivating a customer or demoting a manager
  takes effect instantly — no stale tokens.
- **Destructive actions are guarded.** You cannot delete categories with dishes, restaurants
  or users with order history, or yourself; at least one active admin always remains.

---

## 6. API surface

| Group | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me`, `PATCH /api/auth/password`, `GET /api/auth/check-email` |
| Public | `GET /api/restaurants`, `/restaurants/:slug`, `/restaurants/:slug/foods`, `/foods`, `/foods/:id`, `/foods/:id/reviews`, `/categories`, `/banners`, `/coupons`, `/settings`, `/stats`, `/health` |
| Customer | `GET/POST/PATCH/DELETE /api/addresses`, `GET/POST/DELETE /api/favourites`, `POST /api/orders`, `POST /api/orders/quote`, `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/cancel`, `GET/POST/DELETE /api/reviews` |
| Admin | `GET /api/admin/stats`, `/admin/orders`, `/admin/users`, `/admin/reviews`, `POST/PATCH/DELETE /api/admin/{restaurants,categories,foods,banners,coupons}`, `PUT /api/admin/settings`, `POST /api/uploads/image` |

Responses use `{ success, data, meta?, message? }`; errors use
`{ success: false, error: { code, message, details? } }`.

---

## 7. Tests

```bash
cd server && npm test        # 65 API edge-case tests (isolated craveo_test DB)
cd tools  && npm install && node ui-check.mjs   # 36 headless-Chrome UI checks
```

The UI checker needs the API (`:5000`) and Vite (`:5173`) running. It fails on any browser
console error and covers desktop + mobile layouts, login, cart, real order placement and every
admin screen. Results and the bugs these tests caught are in [`TEST_REPORT.md`](./TEST_REPORT.md).

---

## 8. Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for Vercel (frontend + serverless API), managed MySQL
setup, environment variables, post-deploy checks and the image-upload caveat on serverless.

---

## 9. Known limitations

- Payments are **simulated** (COD/UPI/card status changes only) — no gateway is integrated.
- Uploads are stored on local disk; on Vercel's ephemeral filesystem you must switch to
  Cloudinary/S3 or paste external image URLs (steps are in `DEPLOYMENT.md`).
- JWTs are kept in `localStorage`. httpOnly cookies + CSRF tokens would be stronger against XSS.
- Rate limiting is in-memory, so it is per-instance (use Redis for multi-instance deployments).
- No email/SMS notifications, websockets or real rider GPS — the tracker reflects order status.
