# Craveo — food delivery platform (MERN + MySQL)

A complete, production-shaped food delivery app: an animated storefront, a full customer
panel, and an admin panel where **everything the customer sees can be created, edited and
deleted** — restaurants, categories, dishes, prices, stock, banners, coupons, orders,
reviews, users and site copy.

- **Frontend:** React 18 + Vite, Framer Motion, Recharts, hand-written responsive CSS
- **Backend:** Node.js + Express 5, JWT auth with roles, Zod validation
- **Database:** MySQL 8 / MariaDB 10.4+ (`mysql2`, no ORM — plain SQL with parameterised queries)
- **Uploads:** Multer to local disk (ephemeral on serverless hosts — use image URLs there)

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

> **Two backends, one product.** `server/` is the Express API used by `client/`. The same frontend
> and the same MySQL database are also served by a dependency-free PHP 8 API in `php-version/`
> (`php-version/api` + `php-version/web`) — see [php-version/README.md](php-version/README.md).

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
├── php-version/             Same app, same database, PHP 8 backend (see php-version/README.md)
└── tools/ui-check.mjs       Headless-Chrome UI smoke checks (36 assertions)
```

---
## 3. How the important logic works

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

## 4. API surface

| Group | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me`, `PATCH /api/auth/password`, `GET /api/auth/check-email` |
| Public | `GET /api/restaurants`, `/restaurants/:slug`, `/restaurants/:slug/foods`, `/foods`, `/foods/:id`, `/foods/:id/reviews`, `/categories`, `/banners`, `/coupons`, `/settings`, `/stats`, `/health` |
| Customer | `GET/POST/PATCH/DELETE /api/addresses`, `GET/POST/DELETE /api/favourites`, `POST /api/orders`, `POST /api/orders/quote`, `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/cancel`, `GET/POST/DELETE /api/reviews` |
| Admin | `GET /api/admin/stats`, `/admin/orders`, `/admin/users`, `/admin/reviews`, `POST/PATCH/DELETE /api/admin/{restaurants,categories,foods,banners,coupons}`, `PUT /api/admin/settings`, `POST /api/uploads/image` |

Responses use `{ success, data, meta?, message? }`; errors use
`{ success: false, error: { code, message, details? } }`.

---

