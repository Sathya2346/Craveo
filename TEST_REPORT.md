# Craveo — test & verification report

**Date:** 28 October 2026
**Result:** ✅ **65/65 API tests pass** · ✅ **36/36 UI checks pass** · **0 browser console errors**

| Suite | Files | Tests | Result | Runtime |
| --- | --- | --- | --- | --- |
| API edge cases (`server/tests`) | 5 | 65 | 65 pass, 0 fail | ~20 s |
| Headless UI smoke (`tools/ui-check.mjs`) | 1 | 36 | 36 pass | ~90 s |
| Production build (`client`) | — | — | success | ~25 s |

**Environment:** Node 22.13.1 · XAMPP MariaDB 10.4.32 (MySQL wire-compatible, `mysql2`, port 3306) ·
Windows 11 · Chrome headless · Vite 6 · Express 5. The full suite was re-run against this XAMPP
server after the database switch: 65/65 still pass.

---

## How to reproduce

```bash
# API edge cases — uses an isolated craveo_test database, never touches your data
cd server
npm test

# UI smoke — needs the API (:5000) and Vite (:5173) running, plus Chrome
cd client && npm run dev
cd ../server && npm start
cd ../tools && npm install && node ui-check.mjs

# Production build
cd client && npm run build
```

The UI checker fails the process on **any** `console.error` or uncaught page error, so a clean
run also proves there are no React runtime warnings of the error class.

---

## 1. Bugs found and fixed

Every one of these was caught by the suite while it was being written — none were left in the code.

| # | Severity | Bug | How it surfaced | Fix |
| --- | --- | --- | --- | --- |
| 1 | **Critical** | Any order with a coupon crashed with a 500: `Column 'coupon_id' cannot be null`. `buildQuote()` returned a coupon object without its `id`, so the redemption insert and `used_count` update were sent `NULL`. | `orders.test.js` → "coupon minimum order, percentage cap and usage accounting" | Pass the coupon id through: `{ id, code, description, discount }` in `server/src/modules/orders.js` |
| 2 | **High** | Profile avatar accepted `javascript:alert(1)` — `z.string().url()` allows any scheme. Stored XSS vector once rendered in an `img src`. | `auth.test.js` → "profile update validates the avatar URL" | Scheme allowlist (`http(s)://` or `/uploads` path) in `server/src/modules/auth.js` |
| 3 | Medium | Public pagination contract was inconsistent: `?limit=500` returned **400**, and when accepted, `meta.limit` reported a different number than the SQL `LIMIT`. | `catalog.test.js` → "clamps absurd pagination" | Clamp instead of reject (`max 500` at the edge, hard cap 100), and mirror the clamp in `paginationMeta()` |
| 4 | **High** | Server refused to boot: `TypeError: foodBody.partial is not a function`. `ZodEffects` (from `.superRefine`) has no `.partial()`, so PATCH validators for dishes and coupons were broken. | Caught by the first `npm start` — the process exited immediately | Split each schema into a base object + refined variant (`foodBase`/`foodBody`, `couponBase`/`couponBody`) |
| 5 | Medium (UX) | "Place order" was clickable before saved addresses finished loading, so a fast click showed the misleading "Please choose a delivery address" and never sent a request. | An intermittent UI-check flake, traced to the button's `disabled` condition | Disable the CTA while addresses load or no address is selected (`client/src/pages/Checkout.jsx`) |
| 6 | Low (UX) | Coupon failures said "Add ₹50 more to use FLAT50" without stating the rule. | Order test assertion on the message | Now: "…(minimum order ₹300)" |

> Note on #5: the flake was worth chasing — the first two explanations (animation timing, stale
> server) were wrong, and the browser run eventually proved a real product race. Two consecutive
> clean runs after the fix.

---

## 2. What the API suite covers

### Authentication & accounts (`auth.test.js`)
- Invalid email / short password rejected with field-level details
- Duplicate email → 409, no account enumeration (identical message for unknown email and wrong password)
- **Role escalation blocked**: posting `role: "ADMIN"` to `/auth/register` still creates a `CUSTOMER`
- Deactivated account cannot log in, and an existing token is rejected on the next request
- Missing / malformed / forged-signature valid JWT → 401
- Profile update cannot change role; unsafe avatar URLs rejected
- Password change: wrong current password, unchanged password, then success — old password stops working
- Email availability lookup is case-insensitive

### Catalog (`catalog.test.js`)
- Dishes from inactive restaurants and unavailable dishes are hidden from public listings
- Pagination clamps; `page=0` rejected
- SQL-injection-shaped search (`%' OR 1=1 --`) returns a safe, filtered result
- Combined filters (diet + price, category, impossible price range → empty array not error)
- Missing / non-numeric ids return 404
- RBAC: customers can't write catalog; managers can
- Unique slugs auto-suffix (`desserts` → `desserts-2`); rename regenerates the slug
- Deleting a category that still has dishes → 409 with a human explanation
- Discount ≥ price rejected on create **and** update; negative price rejected; unknown restaurant/category rejected
- 404 route handler and invalid JSON body handled without a stack trace

### Orders, coupons & workflow (`orders.test.js`)
- **Client-supplied prices/totals are ignored** — server recomputes ₹250 + ₹30 + 5% = ₹292.50
- Minimum order per restaurant enforced
- Mixed-restaurant cart rejected
- Closed restaurant / inactive restaurant / unavailable dish → 409 (not 500)
- Stock shortfall reported per dish, and a failed order leaves stock untouched
- Quantity 0/21, >50 total items, empty cart all rejected
- Address ownership enforced; missing delivery fields return field-level errors
- Coupon: invalid, expired, exhausted, inactive, below minimum, per-customer limit, percentage cap (₹250 → capped ₹100), free delivery above ₹499
- COD → `PENDING`, UPI/card → `PAID`
- Stock decrement and coupon redemption written on success
- Quote endpoint works anonymously and returns `couponError` (200) instead of failing the cart
- Customers see only their own orders (404 on someone else's)
- Cancel: restores stock, decrements coupon usage, refunds paid orders, double-cancel → 409
- Customer cannot cancel once `PREPARING`
- Admin transition graph: `PENDING → DELIVERED` → 409; full happy path stamps `delivered_at` and marks COD paid; no backwards transitions
- Admin cancellation restores stock mid-flight
- Status filter + pagination on `/orders`

### Admin (`admin.test.js`)
- RBAC matrix: anonymous 401, customer 403, manager/admin 200
- Manager blocked from user management, settings and order deletion
- Dashboard shape for 7/14/30/90 days (series length matches the range), invalid range → 400
- Revenue counts **only delivered** orders
- Self-protection: can't change own role, deactivate or delete self
- Staff account creation → login works; duplicate email → 409
- Deleting a customer with order history → 409 with "deactivate instead"; deactivation immediately blocks login
- Settings: unknown key → 400; update is reflected on the public `/api/settings`; reset restores defaults
- Payment status guards (cancelled order can't be marked paid), delete restricted to cancelled orders and admins
- Uploads: 401 anonymous, non-image rejected, PNG accepted for a customer (avatars), missing file → 400

### Addresses, favourites, reviews (`extras.test.js`)
- Only one default address at a time; deleting the default promotes another
- Cross-user patch/delete → 404
- Pincode/phone validation; 10-address cap
- Favourites are idempotent, unknown dish → 404, delete works
- Review before delivery → 400; dish not in order → 400; someone else's order → 404
- Duplicate review for the same order+dish → 409
- Dish rating and review count recompute on create, hide and delete
- Hidden reviews disappear from the public list but remain visible to their author
- Order `canReview`/`hasReview` flags flip correctly after reviewing

---

## 3. What the UI smoke suite covers (36 checks)

| Area | Checks |
| --- | --- |
| Storefront | Hero + announcement render, 8 API-driven dish cards, 4 featured kitchens, full catalog (12), restaurant listing, restaurant menu, dish detail, offers/coupons |
| Cart | Add button updates the badge, drawer opens with the line, spring animation settles, close works |
| Auth | Real form login as a customer, session restored |
| Checkout | Deterministic dish pick, server quote settles, minimum-order gate, **real order placed end to end**, success page renders the `CRV-…` number, order appears in history, profile renders |
| Admin | Login, dashboard KPIs, ≥2 Recharts charts, orders queue, dishes/categories/coupons/banners/reviews/users tables, settings form |
| Responsive | Mobile 390×844: tab bar visible, **no horizontal overflow** on home/menu/restaurants/admin, grid collapses to two columns, admin sidebar off-canvas |
| Console | 0 `console.error` / page errors across every page visited |

The end-to-end order is cancelled afterwards through the API so demo stock stays consistent.

---

## 4. Deliberately not covered / known gaps

| Gap | Why | Mitigation |
| --- | --- | --- |
| Payment gateway behaviour | Payments are simulated by design | Integration point is `payment_status` + `POST /api/orders` |
| Real image uploads on Vercel | Serverless filesystem is ephemeral | Documented Cloudinary swap in `DEPLOYMENT.md` §5; UI accepts URLs today |
| Email/SMS delivery | No provider configured | Notifications are UI toasts only |
| WebSocket live tracking | Tracker is status-driven polling | Status history table already records timestamps |
| Multi-instance rate limiting | In-memory limiter | Swap `middleware/rateLimit.js` for Redis |
| Load/perf testing | Out of scope for this task | Queries are indexed; `EXPLAIN` on the hot listings is recommended before launch |
| Cross-browser | Verified in Chrome only | CSS uses standard flex/grid; run BrowserStack before launch |
