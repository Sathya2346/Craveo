# Deploying Craveo on Vercel

Two Vercel projects from one repo:

```
GitHub repo
├── client  → Vercel Project A (static Vite site)   https://craveo.vercel.app
└── server  → Vercel Project B (Express function)  https://craveo-api.vercel.app
                    │
                    └── managed MySQL (Railway / Aiven / Clever Cloud)
```

> Vercel's filesystem is ephemeral. Everything works except **local image uploads** — see
> [Step 5](#step-5--image-uploads-on-vercel-read-this). If you want uploads to just work,
> use the Render/Railway API option in [Step 6](#step-6--alternative-api-on-renderrailway-with-a-disk).

---

## Step 0 — Create the MySQL database

Any MySQL 8-compatible host works. Common choices: **Railway**, **Aiven**, **Clever Cloud**,
**filess.io**. Free tiers change often — pick one that gives you a public hostname.

You need five values:

```
DB_HOST=containers-us-west-x.railway.app
DB_PORT=6543
DB_USER=root
DB_PASSWORD=********
DB_NAME=craveo
```

**Managed hosts usually require TLS:** set `DB_SSL=true` (the pool already handles this).

Create the schema from your machine (the app never auto-migrates in production):

```bash
cd server
DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=true \
  node src/db/migrate.js
```

On Windows PowerShell, set them with `$env:DB_HOST="..."` first; in Git Bash the line above works.
Verify the 14 tables exist in your provider's console.

Optional demo data (⚠️ **truncates every table** — never run against real data):

```bash
cd server
DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=true npm run db:seed
```

For a real launch, skip the seed and insert one admin instead:

```sql
INSERT INTO users (name, email, phone, password_hash, role)
VALUES ('Your Name', 'you@company.com', NULL,
        '$2a$10$REPLACE_WITH_A_BCRYPT_HASH', 'ADMIN');
```

Generate the hash locally:

```bash
node -e "console.log(require('bcryptjs').hashSync('YourStrongPassword', 10))"
```

---

## Step 1 — Push the repository to GitHub

This folder is already a git repo with one commit (`git log` to confirm). Create the remote and
push:

1. **Create an empty repo** on GitHub — <https://github.com/new> → name it `craveo` → **do not**
   add a README, `.gitignore` or licence (that would make the push conflict).
2. **Push** (replace `YOUR-USER`):

   ```bash
   git remote add origin https://github.com/YOUR-USER/craveo.git
   git push -u origin main
   ```

   The first push pops a browser window for GitHub sign-in. If it asks for a password, paste a
   **Personal Access Token** instead (GitHub → Settings → Developer settings → Tokens (classic) →
   `repo` scope).

> **Never committed:** `server/.env` and `client/.env` are git-ignored, along with `node_modules`,
> `dist`, `server/uploads/*` and `.localdb/`. Only the `.env.example` templates go up. Run
> `git status --short` before pushing if you are unsure.

### Why deploy from Git

Vercel and Render both watch the connected branch: **every `git push` to `main` redeploys
automatically**, and every pull request gets its own preview URL. That is the whole deployment
workflow after Step 2 and Step 3:

```bash
git add . && git commit -m "your change" && git push
```

Because the repo holds two apps, both Vercel projects point at the *same* repo with a different
**Root Directory** (`server` and `client`). A push redeploys both; if you touched only one, cancel
the other build.

---

## Step 2 — Deploy the API to Vercel

1. Vercel dashboard → **Add New… → Project** → import this repo.
2. **Root Directory:** `server`
3. **Framework Preset:** Other (Vercel detects `api/index.js` automatically).
4. **Build & Output Settings:** leave defaults — `server/vercel.json` rewrites every path to
   the Express function.
5. **Environment Variables** (Production + Preview):

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DB_HOST` | from Step 0 |
   | `DB_PORT` | from Step 0 |
   | `DB_USER` | from Step 0 |
   | `DB_PASSWORD` | from Step 0 |
   | `DB_NAME` | `craveo` |
   | `DB_SSL` | `true` (if your host requires TLS) |
   | `JWT_SECRET` | output of the command below |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_ORIGIN` | `https://your-client.vercel.app` (add the final URL in Step 3) |
   | `MAX_UPLOAD_MB` | `5` |

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

6. **Deploy**, then check:

   ```bash
   curl https://<your-api>.vercel.app/api/health
   # {"success":true,"data":{"status":"ok","database":"up",...}}
   ```

If `database` is `"down"`, the DB env vars or TLS flag are wrong — check **Deployments → Functions → Logs**.

---

## Step 3 — Deploy the storefront to Vercel

1. **Add New… → Project** → same repo again.
2. **Root Directory:** `client`
3. Framework Preset: **Vite** (build `npm run build`, output `dist` — both already in `client/vercel.json`).
4. **Environment Variable:**

   | Key | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://<your-api>.vercel.app/api` |

   ⚠️ Include the `/api` suffix and **no trailing slash**. Vite inlines this at build time, so
   changing it requires a redeploy.

5. **Deploy** → open `https://<your-client>.vercel.app`.
6. Go back to the **API** project → Settings → Environment Variables → set
   `CLIENT_ORIGIN` to `https://<your-client>.vercel.app` (comma-separate a `www` or preview
   domain if you use them) → **Redeploy** so CORS allows the site.

### Custom domains (optional)

Add `craveo.app` to the client project and `api.craveo.app` to the API project. Then update
`VITE_API_URL` (rebuild client) and `CLIENT_ORIGIN` (redeploy API).

---

## Step 4 — Verify the deployment

| Check | How | Expected |
| --- | --- | --- |
| API health | `GET /api/health` | `status: ok`, `database: up` |
| Public catalog | `GET /api/restaurants` | JSON list |
| CORS | Sign in on the deployed site | No CORS error in devtools |
| Admin | Sign in as an admin → `/admin` | Dashboard cards + charts render |
| Order flow | Add a dish → checkout → place order | Success page with `CRV-…` number |
| Status workflow | Admin → Orders → accept → deliver | Tracker updates on the customer order page |
| Settings | Admin → Settings → change site name | Storefront header updates after refresh |

Anything failing? Check **Vercel → Project → Logs**, and the browser console for the exact error code.

---

## Step 5 — Image uploads on Vercel (read this)

Vercel functions can only write to `/tmp`, which is wiped between invocations. The upload
endpoint (`POST /api/uploads/image`) returns a `/uploads/…` path that will **404 later** in
production. Two options:

**A. Use external image URLs (works today, zero code changes).**
Every admin image field accepts a URL as well as an upload — paste an Unsplash/Cloudinary/
S3 URL and it is stored directly.

**B. Switch to Cloudinary (≈20 lines).**

```bash
cd server && npm i cloudinary
```

Add to `server/vercel.json` env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

Replace `server/src/middleware/upload.js` disk storage with memory storage:

```js
const storage = multer.memoryStorage();
export const imageUpload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Only images are allowed')),
}).single('image');
```

Then in `server/src/modules/uploads.js`, upload the buffer:

```js
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploaded = await new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'craveo', resource_type: 'image' },
    (error, result) => (error ? reject(error) : resolve(result)),
  );
  stream.end(req.file.buffer);
});

res.status(201).json({ success: true, data: { url: uploaded.secure_url } });
```

The frontend already handles absolute `https://` URLs (`assetUrl()`), so nothing else changes.

---

## Step 6 — Alternative: API on Render/Railway with a disk

Pick this when you want uploads to persist with **zero** code changes, or you expect long
requests (cold starts on serverless can add 1–3 s).

1. New **Web Service** → repo → Root Directory `server`
2. Build: `npm install` · Start: `npm start`
3. Env vars: same as Step 2, plus `CLIENT_ORIGIN=https://<client>.vercel.app`
4. Add a **persistent disk** mounted at `/opt/render/project/src/server/uploads`
   (Render) or mount `/app/server/uploads` (Railway), 1 GB is plenty.
5. Deploy, then set `VITE_API_URL=https://<service>.onrender.com/api` on the client and redeploy.

---

## Step 7 — Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `blocked by CORS policy` | `CLIENT_ORIGIN` missing the exact origin | Set it to the full `https://…vercel.app` value, redeploy the API |
| `/api/health` → `database: down` | Wrong DB creds or TLS | Verify host/port/user/password; try `DB_SSL=true`; allow Vercel IPs if the host has an allowlist |
| `ER_ACCESS_DENIED_ERROR` | Password contains `#`/`@` unescaped | Paste the raw value into Vercel env vars (no quotes) |
| 404 on refresh at `/orders` | SPA rewrite missing | `client/vercel.json` must ship with the deployment |
| Images 404 after a while | Ephemeral function disk | Step 5 (external URLs or Cloudinary) |
| Everyone logged out after deploy | `JWT_SECRET` changed | Keep one stable secret across deployments |
| `ER_NO_SUCH_TABLE` | Migrations never ran | Step 0 migration command |
| Client calls `localhost:5000` | Missing/typo `VITE_API_URL` | Rebuild — Vite env vars are baked in |
| Function timeout at 30 s | Large cold start / slow DB | Check DB region and connection count; raise `maxDuration` |

---

## Step 8 — Rollback & operations

- **Rollback:** Vercel → Deployments → pick a previous build → **Promote to Production**.
- **Logs:** Vercel → Project → Logs (function logs include every request and error).
- **Database backups:** enable automated backups on your MySQL host before going live.
- **Rate limits:** the API uses an in-memory limiter, so each function instance counts
  separately. For strict limits behind multiple instances, move it to Redis.
