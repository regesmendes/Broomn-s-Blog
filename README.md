# Broomn's Blog

Chronicles from Broomn, the druid storyteller. A place for stories worth sharing around the fire.

Built from scratch with Node.js, deployed on AWS serverless infrastructure.

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
- ✅ Auth context with token management and auto-refresh
- ✅ Protected admin routes (redirects to login if unauthenticated)
- ✅ Rich text editor (Tiptap) for creating/editing posts
- ✅ Dark mode with toggle (persists preference)
- ✅ Comment section on post detail page with moderation
- ✅ SEO metadata (dynamic og:title, description, og:image per post)
- ✅ Mulgore-inspired visual identity (landscape hero, druidic emblem, vine dividers)
- ✅ Custom typography (Cinzel headings, Lora body — manuscript/scroll feel)
- ✅ i18n: Portuguese (default) + English with language switcher
- ✅ On-the-fly post translation via MyMemory API (preserves HTML structure)
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
| GET | `/posts` | List published posts (paginated, filterable by tag, text search) |
| GET | `/posts/:slug` | Get a single published post |
| GET | `/posts/:postId/comments` | List approved comments for a post |
| GET | `/tags` | List all tags with post count |
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
| POST | `/media/upload` | Upload an image (multipart, 5MB max) |
| GET | `/media` | List all media with usage count |
| GET | `/media/:id` | Get media details with posts using it |
| DELETE | `/media/:id` | Delete a media file |
| PATCH | `/media/:id/replace` | Replace image URL across all posts |

## Data Model

- **User**: email, name, avatar, role (ADMIN/USER), Google/Cognito IDs
- **Post**: title, slug (auto-generated), excerpt, content (HTML), cover image, status (DRAFT/PUBLISHED), publishedAt (enables scheduling)
- **Tag**: name, slug — many-to-many with posts
- **Comment**: content, approved flag, belongs to user and post
- **Newsletter**: email, status (PENDING/CONFIRMED/UNSUBSCRIBED), optional user link

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

## Deployment (AWS CDK)

The infrastructure is defined in the `infrastructure/` directory using AWS CDK (TypeScript).

### Prerequisites

- AWS CLI configured with credentials
- CDK bootstrapped: `npx cdk bootstrap`
- Google OAuth credentials (Client ID + Secret from Google Cloud Console)
- Route53 hosted zone for `blogdobroomn.com`

### Deploy

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
| BromnBlog-Database | VPC, Aurora Serverless v2 (PostgreSQL 16), Security Groups |
| BromnBlog-Storage | S3 bucket (media uploads, public read) |
| BromnBlog-Api | Lambda, API Gateway HTTP API, custom domain |
| BromnBlog-Frontend | S3 + CloudFront + ACM cert + Route53 |
| BromnBlog-Ses | SES domain identity for email |

### URLs after deployment

- Blog: `https://blogdobroomn.com`
- API: `https://api.blogdobroomn.com`
- Cognito Hosted UI: `https://broomns-blog.auth.us-east-1.amazoncognito.com`

### Current Deployment Status (as of July 2026)

**Deployed and working:**
- ✅ BromnBlog-Cognito (User Pool ID: `us-east-1_ApHF59Xas`, Client ID: `535qq83rh90srom3ij4ospn78e`)
- ✅ BromnBlog-Database (RDS PostgreSQL t4g.micro in private subnet)
- ✅ BromnBlog-Storage (S3 bucket: `broomns-blog-frontend-099710233970`)
- ✅ BromnBlog-Api (Lambda + API Gateway, domain: `api.blogdobroomn.com`)
- ✅ BromnBlog-Frontend (S3 + CloudFront distribution: `EKN0G1CK1QQC`)
- ✅ BromnBlog-Ses (using existing SES identity)
- ✅ Static assets uploaded to S3
- ✅ Google OAuth configured (redirect URI added to Google Cloud Console)

**NOT YET COMPLETE — blocking production launch:**

1. **Frontend SSR Lambda**: The Next.js app uses Server Components and cannot be served purely from S3. OpenNext (`open-next` package) has been installed and successfully builds the app into Lambda-compatible bundles (output at `frontend/.open-next/`). However, the CDK Frontend stack currently only creates an S3+CloudFront setup for static files. It needs:
   - A new Lambda function using the server bundle from `.open-next/server-functions/default/`
   - A Lambda Function URL (or API Gateway) for the SSR handler
   - CloudFront behavior routing: `/_next/static/*` → S3 origin, everything else → Lambda origin
   - The image optimization function (`.open-next/image-optimization-function/`) optionally deployed as another Lambda behind CloudFront `/\_next/image*`

2. **Database migration**: The RDS instance is in a private VPC subnet with no public access. Prisma migrations need to be run against it. Options:
   - Add a migration step to the API Lambda (run on first cold start or via a custom event)
   - Create a one-time "migration Lambda" that runs in the same VPC
   - Use a bastion host / EC2 instance to tunnel and run `npx prisma migrate deploy`
   - Temporarily enable public access on RDS (not recommended for production)

3. **Cognito callback URL update**: The Cognito stack was initially deployed with `broomn.foradoprograma.com` callback URLs. It was later updated to `blogdobroomn.com` in the code, but you need to re-deploy the Cognito stack with the new domain:
   ```bash
   npx cdk deploy BromnBlog-Cognito --context googleClientId=... --context googleClientSecret=... --context hostedZoneId=Z03952433C47AYNUTV3QU
   ```

### OpenNext Build

The frontend is built for Lambda deployment using OpenNext:

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://api.blogdobroomn.com NODE_OPTIONS='--localstorage-file=.next/.localStorage' npx open-next build
```

This produces `.open-next/` with:
- `assets/` — static files (already uploaded to S3)
- `server-functions/default/` — the SSR Lambda handler
- `image-optimization-function/` — image optimization Lambda
- `revalidation-function/` — ISR revalidation handler
- `warmer-function/` — keeps Lambda warm

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

### Node.js 25 Compatibility Note

The project runs on Node.js 25 which has a built-in `localStorage` global requiring `--localstorage-file` flag. This affects:
- Frontend dev server: handled via `NODE_OPTIONS` in package.json `dev` script
- OpenNext build: must pass `NODE_OPTIONS='--localstorage-file=.next/.localStorage'` when running `npx open-next build`
- Lambda runtime: uses Node.js 20 (no issue there)

## What's Next (Planned)

These are the remaining pieces to complete the project:

### API enhancements
- [ ] SES integration for newsletter sending (currently stubbed)
- [ ] SES integration for confirmation emails
- [ ] Pagination cursors for better performance at scale
- [ ] Per-user rate limiting

### DevOps
- [ ] GitHub Actions CI pipeline (lint, test, build)
- [ ] Deployment pipeline (CDK deploy on merge to master)
- [ ] Environment separation (dev/staging/prod)

## Contributing

This is a personal project. If you're reading this as a collaborator or future-me, the key things to know:

1. **API pattern**: routes → controllers → services → repositories. Add new features by following the existing post/comment/newsletter pattern.
2. **Tests**: Run `npm test` in `api/` before committing. Add tests for new endpoints.
3. **Frontend**: Run `npm run dev` in `frontend/`. TypeScript errors caught by `npx tsc --noEmit`.
4. **No commits to master without tests passing.**
5. **Always update this README** when adding features or changing architecture before raising a PR.
