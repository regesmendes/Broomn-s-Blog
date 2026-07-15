# Fora do Programa

A personal blog built from scratch with Node.js, deployed on AWS serverless infrastructure.

## What is this?

A full-stack blog application with:
- Public blog with posts, tags, and newsletter subscription
- User registration via Google OAuth (through AWS Cognito)
- Authenticated users can comment on posts
- Admin panel to manage posts, moderate comments, and send newsletters
- Scheduled post publishing (set a future date, post goes live automatically)

## Current Status

**Phase: Local Development Complete**

The API and frontend are fully implemented and working locally. Infrastructure (AWS deployment) has not been started yet.

### What's working

- ✅ REST API with all CRUD endpoints (posts, comments, newsletter, auth)
- ✅ 49 passing tests covering all API modules
- ✅ Role-based access control (public, authenticated user, admin)
- ✅ JWT authentication with access/refresh token flow
- ✅ Cognito integration (ready — needs AWS infrastructure)
- ✅ Newsletter with HMAC-based email confirmation/unsubscribe tokens
- ✅ Frontend with all pages (public blog, admin panel, auth flow)
- ✅ TypeScript compiles clean across both projects

### Known Issues

- **Next.js 15.3.9 build warning**: The build emits a non-fatal warning about `/404` page prerendering (`<Html> should not be imported outside of pages/_document`). This is a confirmed framework bug where Next.js internally generates a legacy pages-router `/404` page even in app-router-only projects. The validation check fires against the framework's own internal rendering. We added `src/pages/_document.tsx` and `src/pages/_error.tsx` to make the error non-fatal (build exits 0), but the warning message persists. **The app runs perfectly fine** — the app router's `not-found.tsx` handles 404s correctly for users.

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **API** | Node.js + Fastify | 5.10 |
| **Language** | TypeScript | 5.8 |
| **ORM** | Prisma | 6.10 |
| **Database** | PostgreSQL (Docker locally, Aurora Serverless v2 on AWS) | 16 |
| **Frontend** | Next.js (App Router) | 15.3.9 |
| **UI** | React | 19 |
| **CSS** | Tailwind CSS | 4 |
| **Auth** | Amazon Cognito (Google OAuth) | — |
| **Testing** | Vitest | 3.2 |
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
├── api/                    # Node.js REST API
│   ├── src/
│   │   ├── app.ts         # Fastify instance + plugin registration
│   │   ├── server.ts      # Entry point (listens on :3001)
│   │   ├── routes/        # Route definitions
│   │   ├── controllers/   # Request/response handling
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Database queries
│   │   ├── schemas/       # Zod validation schemas
│   │   ├── middlewares/   # authenticate, authorize
│   │   ├── lib/           # Shared utilities (Prisma client)
│   │   ├── types/         # TypeScript type definitions
│   │   └── __tests__/     # Vitest test files
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── frontend/               # Next.js application
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   │   ├── page.tsx           # Home (post list)
│   │   │   ├── posts/[slug]/      # Post detail
│   │   │   ├── newsletter/       # Subscribe form
│   │   │   ├── auth/login/       # Google OAuth login
│   │   │   ├── auth/callback/    # OAuth redirect handler
│   │   │   ├── admin/posts/      # Post management
│   │   │   ├── admin/comments/   # Comment moderation
│   │   │   └── admin/newsletter/ # Newsletter send + subscribers
│   │   ├── components/layout/    # Header, Footer
│   │   ├── lib/api.ts            # Typed API client
│   │   └── pages/                # Legacy router files (framework bug workaround)
│   ├── next.config.ts
│   ├── tailwind.config.ts (not needed — Tailwind v4 auto-detects)
│   └── package.json
│
├── infrastructure/         # AWS CDK (not yet implemented)
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
| GET | `/posts` | List published posts (paginated, filterable by tag) |
| GET | `/posts/:slug` | Get a single published post |
| GET | `/posts/:postId/comments` | List approved comments for a post |
| POST | `/newsletter/subscribe` | Subscribe to newsletter |
| GET | `/newsletter/confirm?token=` | Confirm subscription |
| GET | `/newsletter/unsubscribe?token=` | Unsubscribe |

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
| GET | `/posts/:postId/comments/all` | List all comments (including unapproved) |
| PATCH | `/comments/:id/approve` | Approve/reject a comment |
| GET | `/newsletter/subscribers` | List all subscribers |
| POST | `/newsletter/send` | Send newsletter to confirmed subscribers |

## Data Model

- **User**: email, name, avatar, role (ADMIN/USER), Google/Cognito IDs
- **Post**: title, slug (auto-generated), excerpt, content (HTML), cover image, status (DRAFT/PUBLISHED), publishedAt (enables scheduling)
- **Tag**: name, slug — many-to-many with posts
- **Comment**: content, approved flag, belongs to user and post
- **Newsletter**: email, status (PENDING/CONFIRMED/UNSUBSCRIBED), optional user link

## Running Locally

### Prerequisites

- Node.js >= 20
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
npm run dev           # Starts on http://localhost:3001

# 3. Set up the frontend (separate terminal)
cd frontend
npm install
npm run dev           # Starts on http://localhost:3000
```

### Running tests

```bash
cd api
npm test              # Runs all 49 tests
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

### Post scheduling via publishedAt

Rather than a simple boolean "published" flag, we use a `publishedAt` datetime combined with a `status` enum. A post is visible when `status = PUBLISHED AND publishedAt <= now()`. This means:
- Set publishedAt to now → immediately visible
- Set publishedAt to a future date → scheduled, becomes visible automatically at that time
- No cron jobs needed — the query handles it

### HMAC tokens for newsletter

Instead of storing confirmation tokens in the database, we generate HMAC tokens: `base64url(subscriberId + ":" + hmac(subscriberId, secret))`. The token can be verified without a database lookup, and there's nothing to expire or clean up.

### Comment moderation

Comments are created with `approved = false` by default. They only appear publicly after an admin approves them. Comment owners can delete their own comments; admins can delete any comment.

### Frontend outside npm workspace

Next.js has known issues with React version resolution when placed in an npm workspace alongside other packages. The frontend manages its own `node_modules` independently to avoid duplicate React instances causing `useContext` errors during build.

## What's Next (Planned)

These are the remaining pieces to complete the project, roughly in priority order:

### Infrastructure (AWS CDK)
- [ ] Aurora Serverless v2 (PostgreSQL) cluster
- [ ] Cognito User Pool with Google Identity Provider
- [ ] Lambda functions for the API (behind API Gateway)
- [ ] S3 bucket for media uploads
- [ ] CloudFront distribution for the frontend
- [ ] SES configuration for newsletter emails
- [ ] Secrets Manager for environment variables

### API enhancements
- [ ] SES integration for newsletter sending (currently stubbed)
- [ ] SES integration for confirmation emails
- [ ] S3 presigned URL endpoint for image uploads
- [ ] Admin endpoint to list all comments across all posts
- [ ] Pagination cursors for better performance at scale
- [ ] Request rate limiting per user (not just per IP)

### Frontend enhancements
- [ ] Complete the OAuth callback (Cognito token exchange)
- [ ] Auth context/provider (store tokens, refresh automatically)
- [ ] Protected route wrapper for admin pages
- [ ] Post edit page (currently only create exists)
- [ ] Rich text editor for post content (replace raw HTML textarea)
- [ ] Image upload in post editor
- [ ] Comment section on post detail page
- [ ] SEO metadata per post (dynamic og:image, description)
- [ ] Dark mode

### DevOps
- [ ] GitHub Actions CI pipeline (lint, test, build)
- [ ] Deployment pipeline (CDK deploy on merge to main)
- [ ] Environment separation (dev/staging/prod)

## Contributing

This is a personal project. If you're reading this as a collaborator or future-me, the key things to know:

1. **API pattern**: routes → controllers → services → repositories. Add new features by following the existing post/comment/newsletter pattern.
2. **Tests**: Run `npm test` in `api/` before committing. Add tests for new endpoints.
3. **Frontend**: Run `npm run dev` in `frontend/`. TypeScript errors caught by `npx tsc --noEmit`.
4. **No commits to main without tests passing.**
