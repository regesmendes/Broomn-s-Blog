# Broomn's Blog

Chronicles from Broomn, the druid storyteller. A place for stories worth sharing around the fire.

Built from scratch with Node.js, deployed on AWS serverless infrastructure.

## What is this?

A full-stack blog application with:
- Public blog with posts, tags, and newsletter subscription
- User registration via Google OAuth (through AWS Cognito)
- Authenticated users can comment on posts
- Admin panel to manage posts, moderate comments, send newsletters, and edit an About page
- Scheduled post publishing (set a future date, post goes live automatically)

## Documentation

This README covers local setup and orientation. Deeper reference material lives in `docs/`:

- **[docs/architecture.md](./docs/architecture.md)** — data model, auth flow, and the reasoning behind every non-obvious design decision (cursor pagination, post scheduling, rate limiting, CI/CD pipeline, etc).
- **[docs/api.md](./docs/api.md)** — full REST endpoint reference (public / authenticated / admin).
- **[docs/deployment.md](./docs/deployment.md)** — AWS CDK deployment procedures, known footguns, and key resource identifiers.

## Current Status

**Phase: Live in production** — https://blogdobroomn.com

The API and frontend are deployed and working end-to-end on AWS: real Google OAuth login, real newsletter emails, the full admin panel. See [docs/deployment.md](./docs/deployment.md) for infrastructure details and known operational gotchas.

### What's working

- ✅ REST API with all CRUD endpoints (posts, comments, newsletter, auth)
- ✅ 80 passing tests covering all API modules
- ✅ Role-based access control (public, authenticated user, admin)
- ✅ JWT authentication with access/refresh token flow
- ✅ Cognito integration with real Google OAuth login, live in production
- ✅ Newsletter with HMAC-based email confirmation/unsubscribe tokens — real SES sending, graceful confirm/unsubscribe pages (not bare API JSON)
- ✅ Frontend with all pages (public blog, admin panel, auth flow) — server-rendered via OpenNext/Lambda, not just static
- ✅ Auth context with token management and auto-refresh
- ✅ Protected admin routes (redirects to login if unauthenticated)
- ✅ Rich text editor (Tiptap) for creating/editing posts
- ✅ Dark mode with toggle (persists preference)
- ✅ Comment section on post detail page with moderation, capped per-user pending queue (flood protection)
- ✅ SEO metadata (dynamic og:title, description, og:image per post)
- ✅ Mulgore-inspired visual identity (landscape hero, druidic emblem, vine dividers)
- ✅ Custom typography (Cinzel headings, Lora body — manuscript/scroll feel)
- ✅ i18n: Portuguese (default) + English with language switcher — all pages, including auth/login and newsletter flows
- ✅ On-the-fly post translation via MyMemory API (preserves HTML structure)
- ✅ Image captions in the post editor, tied to that specific image occurrence in that specific post
- ✅ Editable About page (rich text, media library images) with a top-nav link, admin-editable, no comments
- ✅ TypeScript compiles clean across all three projects (api, frontend, infrastructure)
- ✅ `robots.txt`/`sitemap.xml` (`frontend/src/app/robots.ts`/`sitemap.ts`) — the sitemap is dynamically generated from live published posts, in both locales
- ✅ Google Analytics (GA4), wired via `next/script` with manual page_view tracking on client-side route changes (App Router navigations don't trigger gtag's automatic one)

### Known Issues

- **Next.js 15.3.9 build warning**: The build emits a non-fatal warning about `/404` page prerendering (`<Html> should not be imported outside of pages/_document`). This is a confirmed framework bug where Next.js internally generates a legacy pages-router `/404` page even in app-router-only projects. The validation check fires against the framework's own internal rendering. We added `src/pages/_document.tsx` and `src/pages/_error.tsx` to make the error non-fatal (build exits 0), but the warning message persists. **The app runs perfectly fine** — the app router's `not-found.tsx` handles 404s correctly for users.
- **`npm audit` reports 4 vulnerabilities in `frontend/` (3 moderate, 1 high), accepted for now** (checked 2026-07-19): `postcss@8.4.31` (XSS advisory) and `esbuild@0.19.2` (dev-server CORS advisory) are bundled *inside* `next`'s and `open-next`'s own dependency trees respectively — not top-level deps we control. Confirmed even `next@16.2.10` (latest) still pins the same vulnerable postcss internally, so upgrading `next` within its current major wouldn't help. `npm audit fix --force` would downgrade `open-next` to `0.0.1` (an ancient pre-1.0 release) to "fix" esbuild — worse than the vulnerability. The remaining `next` advisories (SSRF/DoS/cache-poisoning in Image Optimization, middleware) mostly affect features this app doesn't use heavily. **Recheck on the next `next`/`open-next` version bump** — a future release may finally drop the vulnerable nested deps.

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **API** | Node.js + Fastify | 5.10 |
| **Language** | TypeScript | 5.8 |
| **ORM** | Prisma | 6.10 |
| **Database** | PostgreSQL (Docker locally, RDS t4g.micro on AWS) | 16 |
| **Frontend** | Next.js (App Router) | 15.3.9 |
| **UI** | React | 19 |
| **CSS** | Tailwind CSS | 4 |
| **Auth** | Amazon Cognito (Google OAuth) | — |
| **Testing** | Vitest (api: 3.2, frontend: 4.1, + React Testing Library) | — |
| **Package Manager** | npm | — |

### Why these choices?

- **Fastify over Express**: Faster, better TypeScript support, built-in validation, cleaner plugin system. No reason to start a new project with Express in 2026.
- **Prisma**: Schema-first ORM with auto-generated types, readable migrations, excellent DX with PostgreSQL.
- **Next.js 15 + React 19**: Latest stable versions. App Router is the modern Next.js pattern (server components, layouts, streaming).
- **Tailwind v4**: Ships with Next.js 15's scaffolding. Uses `@import "tailwindcss"` syntax instead of v3's directives.
- **Vitest over Jest**: Native ESM support, faster, compatible with the same APIs.
- **Separate projects (not npm workspace for frontend)**: Next.js has dependency resolution issues when hoisted in a workspace with other packages (React version conflicts). The API remains in an npm workspace; the frontend manages its own `node_modules`.

## Project Structure

```
/
├── .github/workflows/      # CI (ci.yml) and prod deploy (deploy.yml) — see docs/architecture.md#cicd-pipeline
├── api/                    # Node.js REST API
│   ├── src/
│   │   ├── app.ts         # Fastify instance + plugin registration
│   │   ├── server.ts      # Entry point for local dev (listens on :3001)
│   │   ├── lambda.ts      # Lambda entry point (wraps the Fastify app via @fastify/aws-lambda)
│   │   ├── migrate.ts     # On-demand Lambda: prisma migrate deploy + one-off admin SQL (see docs/deployment.md)
│   │   ├── routes/        # Route definitions
│   │   ├── controllers/   # Request/response handling
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Database queries
│   │   ├── schemas/       # Zod validation schemas
│   │   ├── middlewares/   # authenticate, authorize
│   │   ├── lib/           # Shared utilities (Prisma client, SES client, S3 client, cursor pagination helper)
│   │   ├── types/         # TypeScript type definitions
│   │   └── __tests__/     # Vitest test files
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   ├── .env.example
│   ├── eslint.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── frontend/               # Next.js application
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   │   ├── page.tsx                   # Home (post list)
│   │   │   ├── posts/[slug]/              # Post detail
│   │   │   ├── about/                     # About page (public)
│   │   │   ├── newsletter/                # Subscribe form
│   │   │   ├── newsletter/confirm/        # Confirm-subscription landing page
│   │   │   ├── newsletter/unsubscribe/    # Unsubscribe landing page
│   │   │   ├── auth/login/                # Google OAuth login
│   │   │   ├── auth/callback/             # OAuth redirect handler
│   │   │   ├── admin/posts/               # Post management
│   │   │   ├── admin/comments/            # Comment moderation
│   │   │   ├── admin/newsletter/          # Newsletter send + subscribers
│   │   │   ├── admin/media/               # Media library
│   │   │   └── admin/about/               # About page editor
│   │   ├── components/layout/    # Header, Footer
│   │   ├── lib/api.ts            # Typed API client
│   │   ├── lib/useCursorPagination.ts  # Shared cursor pagination state (Prev/Next)
│   │   └── pages/                # Legacy router files (framework bug workaround)
│   ├── next.config.ts
│   ├── open-next.config.ts       # Disables the ISR queue/tag cache (nothing uses ISR — see docs/deployment.md)
│   ├── tailwind.config.ts (not needed — Tailwind v4 auto-detects)
│   ├── vitest.config.ts
│   └── package.json
│
├── infrastructure/         # AWS CDK — deployed, see docs/deployment.md
├── docs/                   # Architecture, API, and deployment reference (see Documentation above)
├── docker-compose.yml      # Local PostgreSQL
├── package.json            # Root workspace (API only)
└── README.md               # This file
```

## Running Locally

### Prerequisites

- Node.js >= 20 (tested on Node 25 — see note below)
- Docker (for PostgreSQL)
- npm

### Steps

```bash
# 1. Start the database
docker compose up -d

# 2. Set up the API
cd api
cp .env.example .env
npm install
npm run db:migrate    # Type "init" when prompted for migration name
npm run db:seed       # Creates admin user, test user, and a sample post
npm run dev           # Starts on http://localhost:3001

# 3. Set up the frontend (separate terminal)
cd frontend
npm install
npm run dev           # Starts on http://localhost:3000
```

Open http://localhost:3000 — you should see the "Hello World" sample post.

### Dev authentication

Since Google OAuth (Cognito) requires AWS infrastructure, we provide a **dev-only login endpoint** for local development:

```bash
# Get an admin JWT token
curl -X POST http://localhost:3001/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@broomns-blog.local"}'

# Get a regular user token
curl -X POST http://localhost:3001/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@broomns-blog.local"}'
```

Use the returned `accessToken` in the `Authorization: Bearer <token>` header to access admin endpoints.

**This endpoint only exists when `NODE_ENV !== 'production'`.** It will never be available in production.

**Caution**: newsletter emails are sent for real whenever `api/.env` has working AWS credentials configured, even in local dev — there's no dev/test stub for SES. Testing `/newsletter/subscribe` locally with real credentials sends a real email.

### Seeded users

| Email | Role | Purpose |
|---|---|---|
| `admin@broomns-blog.local` | ADMIN | Create/edit posts, moderate comments, send newsletters |
| `user@broomns-blog.local` | USER | Test commenting as a regular user |

### Node.js 25 note

Node.js 25 introduced a built-in `localStorage` global that requires `--localstorage-file` to function. Next.js's dev overlay uses `localStorage` internally, which crashes on Node 25 without this flag. The frontend's `dev` script includes `NODE_OPTIONS='--localstorage-file=.next/.localStorage'` to handle this. If you're on Node 20–22, this is harmless. See [docs/deployment.md](./docs/deployment.md#nodejs-25-compatibility-note) for how this also affects the OpenNext build and Lambda runtime.

### Running tests

```bash
cd api
npm test              # Runs all 80 tests
```

## Contributing

This is a personal project. If you're reading this as a collaborator or future-me, the key things to know:

1. **API pattern**: routes → controllers → services → repositories. Add new features by following the existing post/comment/newsletter pattern.
2. **Tests**: Run `npm test` in `api/` before committing. Add tests for new endpoints.
3. **Frontend**: Run `npm run dev` in `frontend/`. TypeScript errors caught by `npx tsc --noEmit`.
4. **No commits to master without tests passing.** CI runs automatically on every PR/push to `master`, but only `prod` has branch protection actually enforcing it (see [docs/architecture.md#cicd-pipeline](./docs/architecture.md#cicd-pipeline)) — `master` still relies on this being followed by convention.
5. **Always update the docs** ([docs/architecture.md](./docs/architecture.md), [docs/api.md](./docs/api.md), [docs/deployment.md](./docs/deployment.md), or this README) when adding features or changing architecture, before raising a PR.
