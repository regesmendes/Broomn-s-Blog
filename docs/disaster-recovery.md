# Disaster Recovery Plan

See the root [README](../README.md) for local setup, [architecture](./architecture.md) for data model/design decisions, and [deployment](./deployment.md) for normal deploy procedures and key resource identifiers referenced throughout this doc.

This is a personal blog, not a business-critical system — the goal here is a plan proportionate to that, not maximum-availability engineering. Planning only; the follow-up work below is tracked as separate issues once prioritized.

## RPO / RTO target

**RPO: up to ~1 week of data loss. RTO: up to ~1 day of downtime, acceptable.** Chosen deliberately loose for a personal blog — the current infrastructure already gets close to this (RDS's 7-day automated backup window covers the RPO target on its own), so this plan mostly documents and shores up existing gaps rather than adding new automation. Cross-region redundancy and sub-hour recovery are explicitly **not** pursued under this target (see "Explicitly deferred" below) — revisit only if the blog's stakes materially change.

## Current posture (verified against source, 2026-07)

| Resource | State | Gap |
|---|---|---|
| RDS PostgreSQL (`infrastructure/lib/stacks/database-stack.ts`) | Automated backups, `backupRetention: 7 days`, `deletionProtection: true`, `removalPolicy: RETAIN`, single-AZ, credentials auto-rotate every 90 days (`addRotationSingleUser`) | Backup window satisfies the RPO target on paper, but **no restore has ever been performed** — untested in practice |
| S3 media bucket (`broomns-blog-media-099710233970`, `infrastructure/lib/stacks/storage-stack.ts`) | `versioned: true`, noncurrent versions expire after 90 days, bucket-level `removalPolicy: RETAIN` | Closed — an overwritten/deleted object is now recoverable (see runbook below) |
| S3 backups bucket (`broomns-blog-backups-099710233970`, private, new) | Holds weekly Cognito user exports (`cognito-exports/YYYY-MM-DD.json`), objects expire after 1 year | — |
| Cognito User Pool (`us-east-1_ApHF59Xas`) | `removalPolicy` now genuinely `RETAIN`s in prod (was dead code — see Changelog); weekly user export to the backups bucket (`broomns-blog-cognito-export` Lambda, EventBridge rule) | Export exists now, but restoring the pool itself with the same IDs still isn't possible — see the Cognito runbook for why losing it is worse than plain data loss |
| Secrets Manager: `broomns-blog/database` | Auto-rotates every 90 days; app fetches credentials dynamically from Secrets Manager at Lambda cold start (`api/src/lib/dbCredentials.ts`) rather than a value baked in at deploy time | Rotation itself untested against the real DB (tracked as a follow-up, same as the restore drill) |
| Secrets Manager: `broomns-blog/jwt-secret` | No automatic rotation — manual runbook only (see "Secrets rotation" below) | Rotating it force-invalidates every active session; accepted for a personal blog |
| IaC (all 6 CDK stacks) | Fully defined in `infrastructure/lib/stacks/*.ts`, reproducible from source | Stateful data inside each stack (DB rows, S3 objects, Cognito users) is **not** reproducible by redeploying code — that's exactly what this plan covers |
| Region | Single region, `us-east-1`, no cross-region copies of anything | Accepted risk under the current RPO/RTO target (see below) |

## Decisions made in this plan

1. **RDS's existing 7-day automated backup window is sufficient** for the accepted RPO — no additional periodic manual snapshots or cross-region copies needed right now. What's actually missing is *validating* the restore procedure works (tracked as a follow-up).
2. **Cross-region backup copies: explicitly not pursued.** Given the accepted RTO/RPO, a full `us-east-1` regional outage is an accepted risk for a personal blog. Revisit only if traffic/stakes grow enough to justify the added complexity and cost.
3. **Cognito user export is still the highest-priority gap**, despite the otherwise loose target — because today's actual RPO for Cognito isn't "1 week," it's "never." This is tracked as the top follow-up issue.
4. **S3 object-level versioning is a cheap near-term win**, recommended as a follow-up even under a loose RPO/RTO — it protects against a different failure mode (an admin/bug overwriting or deleting one image) than large-scale disaster recovery, and costs little to enable.
5. **Fixed as part of this change** (not deferred): `cognito-stack.ts`'s `removalPolicy` was dead code — `condition ? undefined : undefined` always evaluates to `undefined` regardless of environment, so prod never actually got `RemovalPolicy.RETAIN` despite the comment claiming it did. Now genuinely retains the pool in prod. Low-risk, directly closes part of the stated gap, so it didn't make sense to leave broken pending a separate issue.

## Runbooks

### Scenario: RDS instance/data lost or corrupted

1. Identify the most recent good automated snapshot: `aws rds describe-db-snapshots --db-instance-identifier <id> --region us-east-1`.
2. Restore it to a **new** instance (RDS cannot restore in place onto the existing instance): `aws rds restore-db-instance-from-db-snapshot --db-instance-identifier <new-id> --db-snapshot-identifier <snapshot-id>`.
3. Wait for the new instance to reach `available`, then update `infrastructure/lib/stacks/database-stack.ts` (or the relevant CDK context) to point at it, and redeploy `BromnBlog-Api` — the API/migration Lambdas fetch `DB_HOST`/`DB_PORT`/`DB_NAME` from their environment (`infrastructure/lib/stacks/api-stack.ts`, built from `props.dbInstance.dbInstanceEndpointAddress`) and only the username/password live in Secrets Manager (fetched dynamically at cold start, see "Secrets rotation" below). Restoring the data alone is not enough; the new instance has a different endpoint address, so the Lambdas must be redeployed to pick up the new `DB_HOST`.
4. Run `prisma migrate deploy` via the `broomns-blog-migrate` Lambda (see [deployment.md](./deployment.md#running-database-migrations--one-off-admin-sql)) if the snapshot predates any migrations already applied elsewhere.
5. Validate app connectivity end to end before decommissioning the old instance.

**This procedure is untested** — the first real DR exercise should be a dry run of exactly this, against a scratch instance, before relying on it in a real incident (tracked as a follow-up).

### Scenario: S3 media object(s) accidentally overwritten or deleted

Versioning is enabled — recovering a prior version:
```bash
aws s3api list-object-versions --bucket broomns-blog-media-099710233970 --prefix <key>
```
to find the version ID of the version you want back, then `aws s3api copy-object` (copy that version back to the current, un-versioned key) or, if the "deletion" was actually just a delete marker, `aws s3api delete-object --bucket ... --key <key> --version-id <delete-marker-version-id>` to remove the marker and un-hide the underlying object. Noncurrent versions expire after 90 days, so this only works within that window — past it, the object is genuinely gone.

### Scenario: Cognito User Pool lost or deleted

This is the most severe scenario in this plan — worse than plain data loss. Recreating the stack creates a **new** pool with a new pool ID, and every user's Cognito `sub` claim (what the app calls `cognitoId`) changes on their next Google login, even though it's the same Google account and email.

The app links users by `cognitoId`, not `email` (`api/src/repositories/user.repository.ts`'s `upsertByCognitoId`, called from `api/src/services/auth.service.ts`'s `loginWithGoogle`): on login it looks up `where: { cognitoId }`, and if not found, tries to **create** a new `User` row with that email. Since `email` is `@unique` (`api/prisma/schema.prisma`), and the original `User` row (with the old `cognitoId`) still exists, this **create** hits a unique-constraint violation — **every existing user, including the admin, is locked out of login entirely** until manually reconciled. This is not "orphaned comments," it's a full authentication outage.

Recovery: for each affected user (starting with the admin, so they regain the ability to fix everything else), have them attempt to log in once to get their new Cognito `sub` from the failed request/CloudWatch logs, then manually repoint their existing `User` row via the `broomns-blog-migrate` Lambda's one-off admin SQL (see [deployment.md](./deployment.md#running-database-migrations--one-off-admin-sql)):
```bash
aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"args":["db","execute","--stdin"],"stdin":"UPDATE users SET \"cognitoId\" = '"'"'<new-sub>'"'"' WHERE email = '"'"'<user-email>'"'"';"}' \
  /dev/stdout
```
This preserves the user's existing comments/subscriptions (both keyed off the stable `User.id`, not `cognitoId`), at the cost of manual, one-by-one reconciliation.

A weekly export (`broomns-blog-cognito-export` Lambda, `api/src/cognito-export.ts`, triggered by an EventBridge rule every 7 days — see `infrastructure/lib/stacks/api-stack.ts`) writes `{ sub, email, name, enabled, userStatus, userCreateDate }` for every user to `s3://broomns-blog-backups-099710233970/cognito-exports/YYYY-MM-DD.json`. This is exactly the `email` → old-`sub` mapping the reconciliation step above needs, cutting down the manual work from "reconstruct who's who from scratch" to "look up the export." It does **not** restore the pool itself with the same IDs (not possible via CDK/API) — the login-lockout-until-reconciled outcome above still applies. Run one on demand:
```bash
aws lambda invoke --function-name broomns-blog-cognito-export --region us-east-1 /dev/stdout
```

### Scenario: entire AWS account/region issue

Given the accepted RPO/RTO and single-region deployment, this is an explicitly accepted risk for now (see "Decisions made" above) — no cross-region infrastructure exists. Recovery would mean standing up all 6 CDK stacks in a new account/region from source (should work per [deployment.md](./deployment.md), but this has never actually been dry-run — tracked as a follow-up), restoring RDS from a snapshot **copy** (which requires the snapshot to have been copied out of the affected region *beforehand* — not currently automated, since it's out of scope under the accepted RPO/RTO), and otherwise following the RDS/S3/Cognito runbooks above per-resource.

## Secrets rotation

### DB secret (`broomns-blog/database`) — automatic

Rotates every 90 days via CDK's `dbInstance.addRotationSingleUser` (`infrastructure/lib/stacks/database-stack.ts`) — AWS's hosted single-user rotation Lambda handles the actual password change, deployed into the same `PRIVATE_WITH_EGRESS` subnet as the API Lambda (reusing the existing NAT Gateway, so this adds no new networking cost — deliberately avoided a VPC interface endpoint, which would).

This is only safe because of a matching app change: `DATABASE_URL` used to be baked into the API/migrate Lambdas' environment at CDK deploy time, which would've gone stale and silently broken every DB connection at the first scheduled rotation. Now both Lambdas call `api/src/lib/dbCredentials.ts`'s `getDatabaseUrl()` at cold start, which fetches the current username/password from Secrets Manager live (falling back to `process.env.DATABASE_URL` unchanged for local dev/tests) and combines them with the stable `DB_HOST`/`DB_PORT`/`DB_NAME` env vars. No redeploy needed after a rotation — the next cold start just picks up the new password.

**Untested against the real DB** — same caveat as the RDS restore procedure above; verifying a rotation actually completes cleanly against production is a good candidate to combine with that same follow-up drill.

### JWT secret (`broomns-blog/jwt-secret`) — manual only

No automatic rotation, deliberately — it isn't an RDS-attached secret, so there's no AWS-hosted rotation function for it, and building a custom one plus dual-secret grace-period verification (so rotating doesn't instantly log out every active session) was judged more engineering than a personal blog's stakes justify. To rotate manually:
```bash
aws secretsmanager rotate-secret --secret-id broomns-blog/jwt-secret --region us-east-1
# or generate + set a new value directly:
aws secretsmanager update-secret --secret-id broomns-blog/jwt-secret --generate-random-password --region us-east-1
```
then redeploy `BromnBlog-Api` so the new value gets baked into the Lambda's `JWT_SECRET` (same mechanism as today — this secret is *not* on the dynamic-fetch path, unlike the DB one). **Every active session is invalidated immediately** — both access and refresh tokens stop verifying — so this is a "everyone please log in again" event, not silent data loss. Acceptable as an occasional, deliberate action; don't automate it without first building the grace-period support above.

## Follow-up issues to file

1. **Medium** — Actually perform and document a real RDS restore-from-snapshot dry run (new instance, point a scratch `DATABASE_URL` at it, verify data, tear down), and while at it, verify a DB secret rotation completes cleanly against a real instance. Both are unverified in practice today.
2. **Low** — Dry-run a full CDK stack redeploy in a scratch AWS account/region to confirm the "all 6 stacks are reproducible from source" claim in practice.
3. **Low, deferred** — Cross-region snapshot/export copies. Explicitly not pursued under the current RPO/RTO; revisit only if the blog's stakes grow.
4. **Low, deferred** — Automatic JWT secret rotation with dual-secret grace-period verification. Only worth building if forced re-logins on rotation become a real annoyance.

## Changelog

- **2026-07-23** — Initial plan (issue #61). Fixed `cognito-stack.ts`'s dead `removalPolicy` ternary as part of this change (previously always `undefined` regardless of environment; now genuinely `RemovalPolicy.RETAIN` in prod).
- **2026-07-23** — Implemented three of the follow-ups instead of just tracking them: S3 media bucket versioning (+ noncurrent-version lifecycle rule), a weekly Cognito user export to a new private backups bucket, and automatic 90-day DB secret rotation (which required switching the API/migrate Lambdas to fetch DB credentials from Secrets Manager dynamically at cold start instead of baking them in at deploy time — see `api/src/lib/dbCredentials.ts`). JWT secret rotation stayed manual-only, by choice.
