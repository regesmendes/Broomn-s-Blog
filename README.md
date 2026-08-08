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
- **[docs/disaster-recovery.md](./docs/disaster-recovery.md)** — RPO/RTO target, current backup posture, and per-resource recovery runbooks (RDS, S3, Cognito, region loss).

## Current Status

**Phase: Live in production** — https://blogdobroomn.com

The API and frontend are deployed and working end-to-end on AWS: real Google OAuth login, real newsletter emails, the full admin panel. See [docs/deployment.md](./docs/deployment.md) for infrastructure details and known operational gotchas.

### What's working

- ✅ REST API with all CRUD endpoints (posts, comments, newsletter, auth)
- ✅ 352 passing tests across all three packages — api (198), frontend (139), infrastructure (15)
- ✅ Role-based access control (public, authenticated user, admin)
- ✅ JWT authentication with access/refresh token flow
- ✅ Cognito integration with real Google OAuth login, live in production
- ✅ Newsletter with HMAC-based email confirmation/unsubscribe tokens — real SES sending, graceful confirm/unsubscribe pages (not bare API JSON)
- ✅ Rich-text newsletter composer (same Tiptap editor as posts, including images) — the HTML goes straight into the styled email template, no more plain-textarea content collapsing into one paragraph
- ✅ Newsletter subscriber search (by email) and admin block/unblock — a blocked address stops receiving newsletters and can't re-subscribe, independent of unsubscribe status
- ✅ Frontend with all pages (public blog, admin panel, auth flow) — server-rendered via OpenNext/Lambda, not just static
- ✅ Auth context with token management and auto-refresh
- ✅ Protected admin routes (redirects to login if unauthenticated)
- ✅ Rich text editor (Tiptap) for creating/editing posts
- ✅ Post tag management (`/admin/tags`, searchable and paginated) — rename a tag (merges into an existing tag if the new name collides, e.g. fixing a typo), or delete one outright; the post editor's tag field autocompletes against existing tags to avoid creating near-duplicates in the first place
- ✅ Dark mode with toggle (persists preference)
- ✅ Comment section on post detail page with moderation, capped per-user pending queue (flood protection)
- ✅ Admin can reply to comments as "Broomn" — one level of threading, identity masked server-side (never just in the UI), auto-approved, notifies the original commenter by email
- ✅ SEO metadata (dynamic og:title, description, og:image per post)
- ✅ Mulgore-inspired visual identity (landscape hero, druidic emblem, vine dividers)
- ✅ Custom typography (Cinzel headings, Lora body — manuscript/scroll feel)
- ✅ i18n: Portuguese (default) + English with language switcher — all pages, including auth/login and newsletter flows
- ✅ Manual bilingual authoring for posts, the About page, and the Support page — PT/EN tabs in each editor with a one-click MyMemory "Translate" button (admin-triggered and reviewed once, then persisted); no page calls MyMemory on a live request anymore. Untranslated content falls back to the Portuguese original with a badge, noindexed and excluded from the sitemap until translated. Posts additionally require a translation before they can be published (no equivalent gate for About/Support, which have no draft state — a save there is always immediately live)
- ✅ Image captions in the post editor, tied to that specific image occurrence in that specific post
- ✅ Editable About page (rich text, media library images) with a top-nav link, admin-editable, no comments
- ✅ "Say Thanks" support page (`/support`, footer link) — same singleton/rich-text pattern as About, listing free ways to help plus optional Pix/Buy Me a Coffee/PayPal links entered by the admin
- ✅ Raw HTML/script embeds in the rich text editor (Posts, About, Support) — e.g. the Buy Me a Coffee widget script, which the editor can't otherwise preserve; stored safely, resolved back to live markup only at final render
- ✅ TypeScript compiles clean across all three projects (api, frontend, infrastructure)
- ✅ Tab favicon spins while any API request is in flight — feedback that a click registered, even before the page itself shows anything
- ✅ `robots.txt`/`sitemap.xml` (`frontend/src/app/robots.ts`/`sitemap.ts`) — the sitemap is dynamically generated from live published posts, in both locales
- ✅ Google Analytics (GA4), wired via `next/script` with manual page_view tracking on client-side route changes (App Router navigations don't trigger gtag's automatic one)
- ✅ Social share buttons on every post (X, Facebook, LinkedIn, WhatsApp, Instagram, copy-link) — pre-filled share-intent links, no OAuth or platform APIs; Instagram falls back to copy-link with a paste-it-yourself hint
- ✅ Internal analytics dashboard (`/admin/analytics`) — registered-user request logging, page-view tracking with per-session journey reconstruction, newsletter subscriber stats; raw rows auto-pruned after 180 days by a daily Lambda (covers what GA's aggregate/anonymous data can't)
- ✅ Media CDN — uploaded images are resized (2000px cap) and converted to WebP at upload time, then served through a dedicated CloudFront distribution (`media.blogdobroomn.com`) with a long cache TTL and active per-object invalidation on delete, instead of unresized originals served directly from S3. The S3 bucket itself is now CloudFront-only (Origin Access Control, no public reads at all) — the one accepted, permanent cost being that direct-S3 image URLs already baked into sent newsletter emails no longer resolve. Backed by a rate-limiting WAF rule and a CloudFront+S3 cost budget alarm; see [docs/architecture.md](./docs/architecture.md#media-served-via-a-dedicated-cloudfront-distribution-not-the-frontend-one)

### Known Issues

- **Next.js 15.3.9 build warning**: The build emits a non-fatal warning about `/404` page prerendering (`<Html> should not be imported outside of pages/_document`). This is a confirmed framework bug where Next.js internally generates a legacy pages-router `/404` page even in app-router-only projects. The validation check fires against the framework's own internal rendering. We added `src/pages/_document.tsx` and `src/pages/_error.tsx` to make the error non-fatal (build exits 0), but the warning message persists. **The app runs perfectly fine** — the app router's `not-found.tsx` handles 404s correctly for users.
- **`npm audit` findings across all three packages, accepted for now** (checked 2026-08-06) — in each case `npm audit fix` (no `--force`) was already run and is safe to rerun any time; what's left below all needs a breaking/major bump we haven't evaluated, so we're deferring rather than forcing it in blind:
  - **`frontend/`: 5 vulnerabilities (2 moderate, 3 high)**, down from an original 4 as of 2026-07-19 (the count moves around release to release as new advisories land, not a regression). `npm audit fix` bumped `next` to the latest 15.x (`15.5.22`) and cleared `brace-expansion`/`undici` outright. Left: `postcss` (path-traversal/XSS advisories) and `sharp` (libvips CVEs), both pulled in *inside* `next`'s own dependency tree, plus `esbuild` (dev-server CORS advisory) inside `open-next`'s tree — none are top-level deps we control. Clearing postcss/sharp needs `next@16.3.0` (major, untested against this app); clearing esbuild needs downgrading `open-next` to `0.0.1` (an ancient pre-1.0 release) — both worse than the vulnerabilities. **Recheck on the next `next`/`open-next` version bump.**
  - **`api/`: 2 vulnerabilities (1 moderate, 1 high)**, down from 6. `npm audit fix` cleared `brace-expansion`, `fast-uri`, `find-my-way`, and `postcss`. Left: `@fastify/static` (authorization-bypass/path-traversal advisories), pulled in transitively via `@fastify/swagger-ui` (the Swagger docs UI) — nothing in `api/src` uses `@fastify/static` directly. Fixing it needs `@fastify/static@10.1.2` via `--force`, a breaking bump. **Recheck before the next `@fastify/swagger-ui` upgrade.**
  - **`infrastructure/`: 1 high-severity vulnerability (`brace-expansion`)**, unchanged. Bundled *inside* `aws-cdk-lib`'s own dependency tree — not a top-level dependency, and npm's own audit output confirms it "cannot be fixed automatically." Bumped `aws-cdk-lib` to the latest `2.263.0` within its existing `^2.254.0` range, which narrowed the vulnerable range but didn't fully clear it. **Recheck on the next `aws-cdk-lib` version bump.**

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

- Node.js >= 24 (matches CI and the Lambda runtime; also tested locally on Node 25 — see note below). Node 20 is no longer supported here: it reached its own upstream end-of-life in April 2026, and CI/Lambda already moved off it in July 2026 after GitHub Actions started flagging it as a deprecated runner.
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
npm test              # 198 tests (Vitest — Prisma and SES are globally mocked, no DB or real network needed)

cd frontend
npm test              # 139 tests (Vitest + React Testing Library + jsdom)

cd infrastructure
npm test              # 15 tests (Jest — CDK synth/snapshot tests, no AWS credentials needed)
```

## Contributing

This is a personal project. If you're reading this as a collaborator or future-me, the key things to know:

1. **API pattern**: routes → controllers → services → repositories. Add new features by following the existing post/comment/newsletter pattern.
2. **Tests**: Run `npm test` in `api/`, `frontend/`, and `infrastructure/` before committing — see [Running tests](#running-tests). Add tests for new endpoints, components, and CDK stack changes respectively.
3. **Frontend**: Run `npm run dev` in `frontend/`. TypeScript errors caught by `npx tsc --noEmit`.
4. **No commits to master without tests passing.** CI runs automatically on every PR/push to `master`, and GitHub branch protection now actually enforces it on both `master` and `prod` (see [docs/architecture.md#cicd-pipeline](./docs/architecture.md#cicd-pipeline)) — a PR with a failing check can't be merged, not even by an admin.
5. **Always update the docs** ([docs/architecture.md](./docs/architecture.md), [docs/api.md](./docs/api.md), [docs/deployment.md](./docs/deployment.md), [docs/disaster-recovery.md](./docs/disaster-recovery.md), or this README) when adding features or changing architecture, before raising a PR.
