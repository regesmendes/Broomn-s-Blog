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

## Current Status

**Phase: Live in production** — https://blogdobroomn.com

The API and frontend are deployed and working end-to-end on AWS: real Google OAuth login, real newsletter emails, the full admin panel. See [Deployment (AWS CDK)](#deployment-aws-cdk) for infrastructure details and known operational gotchas.

### What's working

- ✅ REST API with all CRUD endpoints (posts, comments, newsletter, auth)
- ✅ 78 passing tests covering all API modules
- ✅ Role-based access control (public, authenticated user, admin)
- ✅ JWT authentication with access/refresh token flow
- ✅ Cognito integration with real Google OAuth login, live in production
- ✅ Newsletter with HMAC-based email confirmation/unsubscribe tokens — real SES sending, graceful confirm/unsubscribe pages (not bare API JSON)
- ✅ Frontend with all pages (public blog, admin panel, auth flow) — server-rendered via OpenNext/Lambda, not just static
- ✅ Auth context with token management and auto-refresh
- ✅ Protected admin routes (redirects to login if unauthenticated)
- ✅ Rich text editor (Tiptap) for creating/editing posts
- ✅ Dark mode with toggle (persists preference)
- ✅ Comment section on post detail page with moderation
- ✅ SEO metadata (dynamic og:title, description, og:image per post)
- ✅ Mulgore-inspired visual identity (landscape hero, druidic emblem, vine dividers)
- ✅ Custom typography (Cinzel headings, Lora body — manuscript/scroll feel)
- ✅ i18n: Portuguese (default) + English with language switcher — all pages, including auth/login and newsletter flows
- ✅ On-the-fly post translation via MyMemory API (preserves HTML structure)
- ✅ Editable About page (rich text, media library images) with a top-nav link, admin-editable, no comments
- ✅ TypeScript compiles clean across all three projects (api, frontend, infrastructure)

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
foradoprograma/
├── .github/workflows/      # CI (ci.yml) and prod deploy (deploy.yml) — see CI/CD pipeline below
├── api/                    # Node.js REST API
│   ├── src/
│   │   ├── app.ts         # Fastify instance + plugin registration
│   │   ├── server.ts      # Entry point for local dev (listens on :3001)
│   │   ├── lambda.ts      # Lambda entry point (wraps the Fastify app via @fastify/aws-lambda)
│   │   ├── migrate.ts     # On-demand Lambda: prisma migrate deploy + one-off admin SQL (see below)
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
│   ├── open-next.config.ts       # Disables the ISR queue/tag cache (nothing uses ISR — see Deployment)
│   ├── tailwind.config.ts (not needed — Tailwind v4 auto-detects)
│   ├── vitest.config.ts
│   └── package.json
│
├── infrastructure/         # AWS CDK — deployed, see Deployment (AWS CDK) below
├── docs/                   # Architecture docs (not yet populated)
├── docker-compose.yml      # Local PostgreSQL
├── package.json            # Root workspace (API only)
└── README.md               # This file
```

## API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/posts` | List published posts (paginated, filterable by tag, text search) |
| GET | `/posts/:slug` | Get a single published post |
| GET | `/posts/:postId/comments` | List approved comments for a post |
| GET | `/tags` | List all tags with post count |
| POST | `/newsletter/subscribe` | Subscribe to newsletter |
| GET | `/newsletter/confirm?token=` | Confirm subscription |
| GET | `/newsletter/unsubscribe?token=` | Unsubscribe |
| GET | `/about` | Get the About page content |

### Authenticated (any logged-in user)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/google` | Exchange Cognito ID token for app JWT |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user profile |
| POST | `/posts/:postId/comments` | Create a comment (pending approval) |
| DELETE | `/comments/:id` | Delete own comment |

### Admin only

| Method | Path | Description |
|---|---|---|
| POST | `/posts` | Create a post |
| PUT | `/posts/:id` | Update a post |
| DELETE | `/posts/:id` | Delete a post |
| PATCH | `/posts/:id/publish` | Publish/unpublish/schedule a post |
| GET | `/posts/admin/:id` | Get any post (including drafts) |
| GET | `/posts/:postId/comments/all` | List all comments for one post (including unapproved) |
| GET | `/comments/admin` | List all comments across every post, filterable by approval status |
| PATCH | `/comments/:id/approve` | Approve/reject a comment |
| GET | `/newsletter/subscribers` | List all subscribers |
| POST | `/newsletter/send` | Send newsletter to confirmed subscribers |
| POST | `/media/upload` | Upload an image (multipart, 5MB max) |
| GET | `/media` | List all media with usage count |
| GET | `/media/:id` | Get media details with posts (and whether the About page) uses it |
| DELETE | `/media/:id` | Delete a media file |
| PATCH | `/media/:id/replace` | Replace image URL across all posts and the About page |
| PUT | `/about` | Update the About page content |

## Data Model

- **User**: email, name, avatar, role (ADMIN/USER), Google/Cognito IDs
- **Post**: title, slug (auto-generated), excerpt, content (HTML), cover image, status (DRAFT/PUBLISHED), publishedAt (enables scheduling)
- **Tag**: name, slug — many-to-many with posts
- **Comment**: content, approved flag, belongs to user and post
- **Newsletter**: email, status (PENDING/CONFIRMED/UNSUBSCRIBED), optional user link
- **Media**: filename (S3 key), original name, mime type, size, public URL — many-to-many with posts via `MediaOnPosts` and with the About page via `MediaOnAboutPage`, kept in sync automatically whenever a post's or the About page's content is saved (see `syncMediaUsage` in `post.service.ts` / `about.service.ts`)
- **AboutPage**: content (HTML) — a singleton, exactly one row (seeded by migration), no title/tags/scheduling; many-to-many with media via `MediaOnAboutPage`

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

Node.js 25 introduced a built-in `localStorage` global that requires `--localstorage-file` to function. Next.js's dev overlay uses `localStorage` internally, which crashes on Node 25 without this flag. The frontend's `dev` script includes `NODE_OPTIONS='--localstorage-file=.next/.localStorage'` to handle this. If you're on Node 20–22, this is harmless.

### Running tests

```bash
cd api
npm test              # Runs all 78 tests
```

## Authentication Flow

1. User clicks "Sign in with Google" → redirected to Cognito Hosted UI
2. Cognito handles Google OAuth → redirects back with authorization code
3. Frontend exchanges code for tokens via Cognito's token endpoint
4. Frontend sends the Cognito ID token to `POST /auth/google`
5. API verifies the ID token using Cognito's JWKS public keys
6. API upserts the user in the database and issues its own JWT pair:
   - **Access token** (15 min) — sent on every request
   - **Refresh token** (7 days) — used to get new access tokens

## Architecture Decisions

### Cursor-based pagination

All list endpoints (`/posts`, `/posts/:postId/comments[/all]`, `/comments/admin`, `/newsletter/subscribers`, `/media`) use cursor pagination instead of `OFFSET`/`page`: the client passes `cursor` (the last-seen row's `id`) and gets back `{ data, meta: { nextCursor, hasMore } }`. This avoids two problems `page`/`skip` has at scale — the database has to walk past all skipped rows on every request (so page 500 costs far more than page 1), and rows can be duplicated or skipped across pages if data changes between requests.

- `api/src/lib/pagination.ts`'s `paginateWithCursor` fetches `limit + 1` rows to derive `hasMore` without a separate `COUNT(*)`.
- Every query orders by `[{ <field>: 'desc' }, { id: 'desc' }]` — the `id` tiebreaker is required because the primary sort field (e.g. `createdAt`) isn't unique; without it, rows with identical timestamps could be skipped or repeated across pages. Verified empirically against real Postgres with intentionally-tied timestamps, not just mocked unit tests.
- The API is forward-only (no `direction`/backward cursor) — the frontend's `useCursorPagination` hook keeps a client-side history of visited cursors so a "Previous" button works without the backend needing to support it, the same approach Stripe's and GitHub's APIs use.
- This trades away numbered-page jumping (no more "go to page 47") and any endpoint-wide `total` count. Where a total/breakdown is still genuinely useful for a dashboard (newsletter subscriber counts by status, admin comment moderation count), it's a separate, cheap indexed `COUNT()`/`groupBy` — unrelated to how deep the cursor pagination goes, so it doesn't reintroduce the scaling problem.

### Post scheduling via publishedAt

Rather than a simple boolean "published" flag, we use a `publishedAt` datetime combined with a `status` enum. A post is visible when `status = PUBLISHED AND publishedAt <= now()`. This means:
- Set publishedAt to now → immediately visible
- Set publishedAt to a future date → scheduled, becomes visible automatically at that time
- No cron jobs needed — the query handles it

### HMAC tokens for newsletter

Instead of storing confirmation tokens in the database, we generate HMAC tokens: `base64url(subscriberId + ":" + hmac(subscriberId, secret))`. The token can be verified without a database lookup, and there's nothing to expire or clean up.

### Comment moderation

Comments are created with `approved = false` by default. They only appear publicly after an admin approves them. Comment owners can delete their own comments; admins can delete any comment.

### About page is a singleton, not a Post

The About page (`/about`, admin editor at `/admin/about`) is deliberately its own model rather than a `Post` with a reserved slug — it doesn't need tags, a publish/schedule workflow, or listing/search, and reusing `Post` would mean filtering it out of every place that lists or searches posts. `AboutPage` has exactly one row, seeded by its migration so `/about` never 404s waiting for an admin to save content the first time; the API only ever finds-or-updates that row, there's no create/delete. It reuses the same editor UI (`RichTextEditor` + `ImagePickerModal`) and public rendering (`PostContent`, with the same on-the-fly Portuguese→English translation) as posts, and has its own `MediaOnAboutPage` join table — mirroring `MediaOnPosts` — so the media library's usage counts, the media detail panel, and "replace this image everywhere" all correctly account for images used on the About page too.

### Per-user rate limiting

The global rate limiter (`@fastify/rate-limit`, 100 req/min default) keys by authenticated user instead of IP when possible: its `keyGenerator` (in `api/src/app.ts`) attempts `request.jwtVerify()` and keys by `user:<sub>` on success, falling back to IP for anonymous requests. It verifies the token rather than just decoding it — trusting an unverified `sub` claim would let anyone dodge the limit by sending a fresh made-up token per request. A few high-abuse-risk routes are tightened further via per-route `config.rateLimit` (which inherits this same keyGenerator): `/newsletter/subscribe` (5/10min, public and a real SES-cost target), comment creation (10/min per user), and media upload (20/min per user).

**Known limitation, accepted for now**: `@fastify/rate-limit`'s default store is an in-memory `Map`, scoped to a single Lambda execution environment. Since API Gateway can spin up multiple concurrent Lambda instances, each with its own independent counter, this is a soft/best-effort limit rather than a mathematically exact global one under concurrent load. A true distributed limit would need a shared store (e.g. `@fastify/rate-limit`'s Redis option, via ElastiCache or Upstash) — real infra/cost disproportionate to this app's actual traffic. Revisit if usage ever grows enough for this gap to matter.

### CI/CD pipeline

**Branch flow**: feature branches → PR into `master` (everyday development, ungated) → PR from `master` into `prod` (a deliberate promotion step — merging into `prod` is what triggers a production deploy). `prod` has real GitHub branch protection: a PR is required (no direct pushes, no force-pushes, no deletions), and the CI workflow's three checks (`API`, `Frontend`, `Infrastructure`) must all pass against an up-to-date branch before the merge button is even enabled — this applies to repo admins too (`enforce_admins: true`). This repo was made **public** specifically to unlock branch protection: GitHub disables both classic branch protection rules and the newer Rulesets on private repos unless the account has GitHub Pro. The repo's git history was checked for secrets before flipping visibility — none found (no `.env` files, no AWS keys, no private keys were ever committed).

**CI** (`.github/workflows/ci.yml`) runs on every PR/push touching `master` or `prod`: lint + build (which is also the typecheck, via `tsc`) + test for `api`, and lint + typecheck + test + build for `frontend`, and build + test for `infrastructure`. Nothing here touches AWS.

Both workflows' `actions/setup-node` runners pin Node 24 (bumped from 20 after GitHub started emitting a runner-deprecation warning on Node 20; the Lambda *runtime* itself is unaffected and stays on Node 20 — see `NODEJS_20_X` in the CDK stacks — this only affects the GitHub Actions VM running `npm ci`/`cdk deploy`). Verified via clean-container reproduction (`node:24-bullseye`) that the full pipeline — `npm ci`, `prisma generate`, `api/scripts/fetch-migrate-engine.js`, `cdk synth --all` — behaves identically to Node 20.

**Deploy** (`.github/workflows/deploy.yml`) runs on push to `prod` (i.e. after a merge) and replays the manual procedure documented above in order — build frontend via OpenNext, sync static assets to S3, `cdk deploy --all`, invalidate CloudFront, invoke the migrate Lambda — as one automated job. Real Google OAuth credentials are always passed to `cdk deploy` (from GitHub Secrets), so it can never hit the placeholder-credential fallback that once overwrote Cognito's real Google IdP secret (see the footguns above) — every deploy is a full-stack deploy, safely.

**AWS auth**: GitHub Actions authenticates via OIDC (GitHub's `token.actions.githubusercontent.com` provider, already registered in this AWS account for another project) assuming a dedicated IAM role, `broomns-blog-github-deploy`. Its trust policy restricts assumption to `repo:regesmendes/Broomn-s-Blog:ref:refs/heads/prod` only — no other branch, PR, or repo can assume it. No long-lived AWS access keys are stored anywhere. Its permissions are least-privilege, not broad admin:
- `sts:AssumeRole`/`sts:TagSession` on the existing CDK bootstrap roles (`cdk-hnb659fds-*`) — the same mechanism the CDK CLI already uses for the human deploy user; the actual CloudFormation/resource permissions live on those pre-existing bootstrap roles, scoped by CDK itself.
- `s3:PutObject`/`DeleteObject`/`ListBucket` on the frontend bucket only.
- `cloudfront:CreateInvalidation`/`GetInvalidation` on the one distribution only.
- `lambda:InvokeFunction` on the one migrate Lambda only.

**GitHub repo configuration** (for reproducing this setup, or auditing what's in place): Secrets — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (pulled from the live Cognito Google IdP config, not re-typed by hand). Variables (non-secret) — `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `HOSTED_ZONE_ID`, `CLOUDFRONT_DISTRIBUTION_ID`, `FRONTEND_BUCKET`, `MIGRATE_FUNCTION_NAME`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_COGNITO_DOMAIN`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_REDIRECT_URI`.

### Frontend outside npm workspace

Next.js has known issues with React version resolution when placed in an npm workspace alongside other packages. The frontend manages its own `node_modules` independently to avoid duplicate React instances causing `useContext` errors during build.

### Never conditionally `return null` from a top-level Provider

`ThemeProvider` (`frontend/src/lib/theme-context.tsx`) used to `return null` while waiting for a `mounted` flag to avoid a flash of the wrong theme. Since it wraps the *entire app* in the root layout, this silently suppressed the server-rendered output of **every page** — the whole admin panel and auth flow rendered as blank/not-found in production for a while before this was caught, and it was hard to trace because pages using `next-intl` translations still looked fine (next-intl inlines all message JSON into the RSC payload regardless of whether the page's own HTML rendered, which masked the bug on translated pages). Any provider that wraps the root layout must always render its `children` — do the actual flash-prevention with a synchronous pre-hydration `<script>` in `app/layout.tsx` instead (reads `localStorage`/`prefers-color-scheme`, applies `.dark` before first paint).

### Migration Lambda doubles as an admin console

`api/src/migrate.ts` defaults to `prisma migrate deploy`, but also accepts `{ args, stdin }` in its invoke payload to run arbitrary one-off `prisma` CLI commands (e.g. `db execute --stdin` for a raw SQL statement) against the production database — it's the only Lambda with a network path into the private-subnet RDS instance, so it's the way to do any one-off admin task (like promoting the first user to `ADMIN`) without a bastion host. See [Deployment](#deployment-aws-cdk) for the invoke command.

## Deployment (AWS CDK)

The infrastructure is defined in the `infrastructure/` directory using AWS CDK (TypeScript).

### Prerequisites

- AWS CLI configured with credentials
- CDK bootstrapped: `npx cdk bootstrap`
- Google OAuth credentials (Client ID + Secret from Google Cloud Console)
- Route53 hosted zone for `blogdobroomn.com`

### Deploy

**Normal path**: merge a PR into `prod` — the CI/CD pipeline (see Architecture Decisions) builds and deploys everything automatically. The manual command below is for the very first deploy of a fresh environment, or for troubleshooting independently of the pipeline:

```bash
cd infrastructure
npm install
npx cdk deploy --all \
  --context googleClientId=YOUR_GOOGLE_CLIENT_ID \
  --context googleClientSecret=YOUR_GOOGLE_CLIENT_SECRET \
  --context hostedZoneId=YOUR_ROUTE53_HOSTED_ZONE_ID
```

### Architecture

| Stack | Resources |
|---|---|
| BromnBlog-Cognito | User Pool, Google IdP, App Client, Hosted UI |
| BromnBlog-Database | VPC (3-tier: public/private-with-egress/isolated), RDS PostgreSQL 16 (t4g.micro), Security Groups |
| BromnBlog-Storage | S3 bucket (media uploads, public read) |
| BromnBlog-Api | Lambda, API Gateway HTTP API, custom domain |
| BromnBlog-Frontend | S3 + CloudFront + ACM cert + Route53 |
| BromnBlog-Ses | SES domain identity for email |

### URLs after deployment

- Blog: `https://blogdobroomn.com`
- API: `https://api.blogdobroomn.com`
- Cognito Hosted UI: `https://broomns-blog.auth.us-east-1.amazoncognito.com`

### Current Deployment Status (as of July 2026)

**Everything is deployed and working in production**, including the pieces that used to block launch (SSR, DB migrations, Cognito callback URL — all resolved):

- ✅ BromnBlog-Cognito (User Pool ID: `us-east-1_ApHF59Xas`, Client ID: `535qq83rh90srom3ij4ospn78e`) — real Google OAuth login working end-to-end
- ✅ BromnBlog-Database (RDS PostgreSQL t4g.micro in private subnet) — migrations applied via the on-demand migration Lambda (see below)
- ✅ BromnBlog-Storage (S3 bucket: `broomns-blog-media-099710233970`) — media uploads/deletes now go directly to this bucket via `api/src/lib/s3.ts` (`S3_BUCKET_NAME` env var, already wired to the Lambda; IAM already granted `s3:PutObject`/`s3:DeleteObject`)
- ✅ BromnBlog-Api (Lambda + API Gateway, domain: `api.blogdobroomn.com`) — Fastify app wrapped via `@fastify/aws-lambda`, bundled with esbuild (`NodejsFunction`), running in a `PRIVATE_WITH_EGRESS` subnet (not `PRIVATE_ISOLATED` — it needs real internet egress for SES and Cognito's JWKS endpoint, neither of which has a VPC Gateway Endpoint)
- ✅ BromnBlog-Frontend (S3 + CloudFront distribution: `EKN0G1CK1QQC`) — full SSR via OpenNext + a Lambda Function URL behind CloudFront OAC, not just static files
- ✅ BromnBlog-Ses — `blogdobroomn.com` domain verified (DKIM via Route53, automatic, `DkimAttributes.Status: SUCCESS`). **Production access granted** (confirmed via `aws sesv2 get-account`: `ProductionAccessEnabled: true`, review case `178438314600754` status `GRANTED`) — sending works to any recipient, not just pre-verified addresses. Quota: 50,000 emails/24h, 14/sec.
- ✅ Google OAuth configured and confirmed working (redirect URI registered in Google Cloud Console, real login tested)

### ⚠️ Two footguns that already caused real incidents — read before touching `cdk deploy`

1. **Never pass placeholder Google OAuth credentials on any deploy that includes `BromnBlog-Api`, or anything else, unless you pass `--exclusively`.** `bin/infrastructure.ts` falls back to literal `PLACEHOLDER_GOOGLE_CLIENT_ID`/`PLACEHOLDER_GOOGLE_CLIENT_SECRET` strings if `--context googleClientId`/`googleClientSecret` aren't passed — harmless on its own, **except** `ApiStack.addDependency(cognitoStack)` means CDK will also evaluate (and, if the template differs, silently overwrite) `BromnBlog-Cognito` as a dependency. This happened for real: Cognito's Google Identity Provider got its real Client ID/Secret replaced with the literal placeholder strings, breaking login with `Error 401: invalid_client` from Google, until someone with the real credentials redeployed Cognito directly. **If you need to deploy `BromnBlog-Api`/`BromnBlog-Frontend` without the real Google credentials in hand, always add `--exclusively`** so CDK never touches Cognito:
   ```bash
   npx cdk deploy BromnBlog-Api BromnBlog-Frontend --exclusively \
     --context googleClientId=PLACEHOLDER_GOOGLE_CLIENT_ID \
     --context googleClientSecret=PLACEHOLDER_GOOGLE_CLIENT_SECRET \
     --context hostedZoneId=Z03952433C47AYNUTV3QU
   ```

2. **CloudFormation only diffs the S3 key *name* for Lambda code assets, not the object's actual content.** If a `cdk deploy` gets interrupted (e.g. killed) mid-upload, it can leave a truncated zip sitting at that content-hash key in the CDK bootstrap assets bucket (`cdk-hnb659fds-assets-<account>-<region>`). A later deploy that recomputes the *same* hash (nothing in the source changed) will see the object already exists and skip re-uploading — silently deploying the corrupted zip, with CloudFormation reporting success. This happened for real and took the whole site down (502s) until it was traced by comparing local build file counts against the deployed package. If you ever kill a `cdk deploy` mid-flight, or see a Lambda erroring with `Cannot find module` for something that's clearly bundled, don't just retry — verify the deployed artifact matches what's on disk (`aws lambda get-function --function-name <fn> --query Code.Location` and diff it), delete the corrupted object from the assets bucket, and redeploy. If CloudFormation still reports "no changes," force it with `aws lambda update-function-code` directly.

### Frontend deploy procedure (SSR via OpenNext)

Unlike the API stack, redeploying frontend *code* changes needs three steps in order — a plain `cdk deploy` alone does nothing, since the CDK stack just packages whatever is already on disk in `frontend/.open-next/`:

```bash
# 1. Build (env vars are inlined at build time — NEXT_PUBLIC_* won't work if set only at runtime)
cd frontend
rm -rf .next .open-next   # WSL2/DrvFs file-watching is unreliable — stale webpack cache has silently
                           # kept old NEXT_PUBLIC_* values baked in before; always start clean
NEXT_PUBLIC_API_URL=https://api.blogdobroomn.com \
NEXT_PUBLIC_COGNITO_DOMAIN=https://broomns-blog.auth.us-east-1.amazoncognito.com \
NEXT_PUBLIC_COGNITO_CLIENT_ID=535qq83rh90srom3ij4ospn78e \
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://blogdobroomn.com/pt/auth/callback \
NODE_OPTIONS='--localstorage-file=.next/.localStorage' npx open-next build

# 2. Sync static assets to S3 under the _assets/ prefix (CloudFront's S3 origin path)
aws s3 sync .open-next/assets s3://broomns-blog-frontend-099710233970/_assets --delete

# 3. Deploy the CDK stack (packages the SSR Lambda from .open-next/server-functions/default/)
cd ../infrastructure
npx cdk deploy BromnBlog-Frontend --exclusively \
  --context googleClientId=PLACEHOLDER_GOOGLE_CLIENT_ID \
  --context googleClientSecret=PLACEHOLDER_GOOGLE_CLIENT_SECRET \
  --context hostedZoneId=Z03952433C47AYNUTV3QU

# 4. Invalidate CloudFront so viewers see the new content immediately
aws cloudfront create-invalidation --distribution-id EKN0G1CK1QQC --paths "/*"
```

This produces `.open-next/` with:
- `assets/` — static files, synced to S3 above
- `server-functions/default/` — the SSR Lambda handler (fully self-contained, `node_modules` included — no esbuild/CDK bundling needed, unlike the API Lambda)
- `image-optimization-function/`, `revalidation-function/`, `warmer-function/` — built but **not deployed**: no `next/image` usage in the app (image optimizer skipped) and no ISR/SSG anywhere (every route is `force-dynamic`, revalidation/warmer skipped) — see `frontend/open-next.config.ts`

### Running database migrations / one-off admin SQL

The RDS instance has no public access — the only way in is the `broomns-blog-migrate` Lambda, which runs inside the same VPC:

```bash
# Apply pending Prisma migrations (default behavior)
aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 /dev/stdout

# Run an arbitrary one-off SQL statement (e.g. promoting a user to admin)
aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"args":["db","execute","--stdin"],"stdin":"UPDATE users SET role = '"'"'ADMIN'"'"' WHERE email = '"'"'you@example.com'"'"';"}' \
  /dev/stdout
```

Note: `prisma db execute` runs the statement but doesn't print `SELECT` results — it's designed for DDL/DML, not querying. If the local `@prisma/engines` package is missing the `rhel-openssl-3.0.x` schema engine binary needed to rebuild this Lambda, fetch it with `PRISMA_CLI_BINARY_TARGETS=native,rhel-openssl-3.0.x npm rebuild @prisma/engines` before redeploying `BromnBlog-Api`.

### Key AWS Resources

| Resource | Identifier |
|---|---|
| AWS Account | `099710233970` |
| Region | `us-east-1` |
| Route53 Hosted Zone (blogdobroomn.com) | `Z03952433C47AYNUTV3QU` |
| Cognito User Pool | `us-east-1_ApHF59Xas` |
| Cognito App Client | `535qq83rh90srom3ij4ospn78e` |
| Cognito Domain | `broomns-blog.auth.us-east-1.amazoncognito.com` |
| CloudFront Distribution | `EKN0G1CK1QQC` |
| S3 Frontend Bucket | `broomns-blog-frontend-099710233970` |
| API Lambda | `broomns-blog-api` |
| API Gateway | `58m9fzd8lj` |
| Migration/admin-SQL Lambda | `broomns-blog-migrate` |
| Frontend SSR Lambda | `broomns-blog-frontend-server` |
| CDK Bootstrap Assets Bucket | `cdk-hnb659fds-assets-099710233970-us-east-1` |
| GitHub Actions deploy role | `broomns-blog-github-deploy` (OIDC, trust-scoped to this repo's `prod` branch only) |

### Node.js 25 Compatibility Note

The project runs on Node.js 25 which has a built-in `localStorage` global requiring `--localstorage-file` flag. This affects:
- Frontend dev server: handled via `NODE_OPTIONS` in package.json `dev` script
- OpenNext build: must pass `NODE_OPTIONS='--localstorage-file=.next/.localStorage'` when running `npx open-next build`
- Lambda runtime: uses Node.js 24 (no issue there — the `localStorage` global was introduced in Node 25, one major version later)

## Contributing

This is a personal project. If you're reading this as a collaborator or future-me, the key things to know:

1. **API pattern**: routes → controllers → services → repositories. Add new features by following the existing post/comment/newsletter pattern.
2. **Tests**: Run `npm test` in `api/` before committing. Add tests for new endpoints.
3. **Frontend**: Run `npm run dev` in `frontend/`. TypeScript errors caught by `npx tsc --noEmit`.
4. **No commits to master without tests passing.** CI runs automatically on every PR/push to `master`, but only `prod` has branch protection actually enforcing it (see "CI/CD pipeline" under Architecture Decisions) — `master` still relies on this being followed by convention.
5. **Always update this README** when adding features or changing architecture before raising a PR.
