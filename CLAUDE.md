# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Broomn's Blog — full-stack blog + newsletter app, live at https://blogdobroomn.com. See @README.md for local setup and orientation, and `docs/` for deeper reference — `docs/architecture.md` (data model, auth flow, design decisions), `docs/api.md` (endpoints), `docs/deployment.md` (AWS CDK procedures). Both are kept current and are the source of truth for this repo.

## Structure

- `api/` — Fastify + Prisma REST API. Part of the root npm workspace.
- `frontend/` — Next.js 15 App Router. NOT an npm workspace — install separately (`cd frontend && npm install`); hoisting it causes React version conflicts.
- `infrastructure/` — AWS CDK (TypeScript). Also installed separately.

## Commands

Root `npm test` / `npm run build:api` just proxy into the `api` workspace. There's no root command for `frontend` or `infrastructure` — always `cd` into them first.

| Package | Dev | Test | Build |
|---|---|---|---|
| `api` | `npm run dev` (tsx watch, :3001) | `npm test` (Vitest — Prisma and SES are globally mocked, no DB or real network needed) | `npm run build` |
| `frontend` | `npm run dev` (:3000) | `npm test` (Vitest + React Testing Library + jsdom) | `npm run build` (local dev only — NOT how production is built; see `docs/deployment.md`'s "Frontend deploy procedure") |
| `infrastructure` | — | `npm test` (Jest) | `npm run build` |

Both `api` and `frontend` have real ESLint configs. `frontend`'s `next.config.ts` sets `eslint.ignoreDuringBuilds: true`, so lint errors never fail a `next build` — run `npm run lint` explicitly to catch them.

## Gotchas

- Frontend production build is **not** `next build` — it's a 3-step OpenNext + S3 + CDK procedure with real footguns (placeholder OAuth creds silently overwriting Cognito, truncated Lambda zips on interrupted deploys). Read `docs/deployment.md` in full before running `cdk deploy` or an OpenNext build.
- Never `return null` (even conditionally) from a Provider that wraps the root layout (e.g. `ThemeProvider`) — it silently blanks SSR output for the whole app. See `docs/architecture.md`'s "Never conditionally return null from a top-level Provider".
- Local dev sends real newsletter emails via SES if `api/.env` has working AWS credentials — there is no dev/test stub for SES.
- The `broomns-blog-migrate` Lambda is the only network path into the private-subnet RDS instance — it's used both for `prisma migrate deploy` and one-off admin SQL (e.g. promoting a user to ADMIN). See `docs/deployment.md`'s "Running database migrations / one-off admin SQL".
- No CI pipeline exists yet — correctness is enforced by convention only (tests must pass locally before merging to `master`).
- Media uploads go directly to S3 (`api/src/lib/s3.ts`, `S3_BUCKET_NAME` env var) — no dev-mode fallback, local dev hits the real bucket too if AWS credentials are configured (same pattern as SES).
- All list endpoints use cursor pagination (`api/src/lib/pagination.ts`'s `paginateWithCursor`), not `page`/`skip` — new list endpoints should follow the same pattern (`cursor`/`limit` query params, `orderBy: [{field: 'desc'}, {id: 'desc'}]` for a stable tiebreaker). See `docs/architecture.md`'s "Cursor-based pagination" under Architecture Decisions.
- Rate limiting keys by authenticated user (verified JWT `sub`), falling back to IP — see `docs/architecture.md`'s "Per-user rate limiting". The in-memory store is per-Lambda-instance, not a true distributed limit; a known, accepted tradeoff.

## i18n

next-intl, locales `pt` (default) and `en`, routed via a `[locale]` segment. Messages live in `frontend/messages/{pt,en}.json`; config in `frontend/src/i18n/`.

## Conventions

- Commits: conventional-style prefixes (`feat:`, `fix:`, `docs:`, `chore:`).
- Branches: `feat/<topic>`, merged into `master` via PR.
- Update the docs (`docs/architecture.md`, `docs/api.md`, `docs/deployment.md`, or README.md, whichever is relevant) when adding features or changing architecture, before raising a PR.
- `prod` is a protected, deploy-triggering branch — merging into it (from `master`, via PR) redeploys the entire live stack. Never push to it directly (branch protection blocks this anyway). See `docs/architecture.md`'s "CI/CD pipeline" under Architecture Decisions.
