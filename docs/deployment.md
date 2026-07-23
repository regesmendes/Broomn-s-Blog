# Deployment (AWS CDK)

See the root [README](../README.md) for local setup, the [architecture doc](./architecture.md#cicd-pipeline) for how the CI/CD pipeline drives this, and [disaster-recovery.md](./disaster-recovery.md) for backup posture and recovery runbooks if something goes wrong with the deployed data (RDS, S3, Cognito).

The infrastructure is defined in the `infrastructure/` directory using AWS CDK (TypeScript).

## Prerequisites

- AWS CLI configured with credentials
- CDK bootstrapped: `npx cdk bootstrap`
- Google OAuth credentials (Client ID + Secret from Google Cloud Console)
- Route53 hosted zone for `blogdobroomn.com`

## Deploy

**Normal path**: merge a PR into `prod` — the CI/CD pipeline (see [architecture](./architecture.md#cicd-pipeline)) builds and deploys everything automatically. The manual command below is for the very first deploy of a fresh environment, or for troubleshooting independently of the pipeline:

```bash
cd infrastructure
npm install
npx cdk deploy --all \
  --context googleClientId=YOUR_GOOGLE_CLIENT_ID \
  --context googleClientSecret=YOUR_GOOGLE_CLIENT_SECRET \
  --context hostedZoneId=YOUR_ROUTE53_HOSTED_ZONE_ID
```

## Architecture

| Stack | Resources |
|---|---|
| BromnBlog-Cognito | User Pool, Google IdP, App Client, Hosted UI |
| BromnBlog-Database | VPC (3-tier: public/private-with-egress/isolated), RDS PostgreSQL 16 (t4g.micro), Security Groups |
| BromnBlog-Storage | S3 bucket (media uploads, public read) |
| BromnBlog-Api | Lambda, API Gateway HTTP API, custom domain |
| BromnBlog-Frontend | S3 + CloudFront + ACM cert + Route53 |
| BromnBlog-Ses | SES domain identity for email |

## URLs after deployment

- Blog: `https://blogdobroomn.com`
- API: `https://api.blogdobroomn.com`
- Cognito Hosted UI: `https://broomns-blog.auth.us-east-1.amazoncognito.com`

## Current Deployment Status (as of July 2026)

**Everything is deployed and working in production**, including the pieces that used to block launch (SSR, DB migrations, Cognito callback URL — all resolved):

- ✅ BromnBlog-Cognito (User Pool ID: `us-east-1_ApHF59Xas`, Client ID: `535qq83rh90srom3ij4ospn78e`) — real Google OAuth login working end-to-end
- ✅ BromnBlog-Database (RDS PostgreSQL t4g.micro in private subnet) — migrations applied via the on-demand migration Lambda (see below)
- ✅ BromnBlog-Storage (S3 bucket: `broomns-blog-media-099710233970`) — media uploads/deletes now go directly to this bucket via `api/src/lib/s3.ts` (`S3_BUCKET_NAME` env var, already wired to the Lambda; IAM already granted `s3:PutObject`/`s3:DeleteObject`)
- ✅ BromnBlog-Api (Lambda + API Gateway, domain: `api.blogdobroomn.com`) — Fastify app wrapped via `@fastify/aws-lambda`, bundled with esbuild (`NodejsFunction`), running in a `PRIVATE_WITH_EGRESS` subnet (not `PRIVATE_ISOLATED` — it needs real internet egress for SES and Cognito's JWKS endpoint, neither of which has a VPC Gateway Endpoint). The `broomns-blog-migrate` Lambda runs in the same `PRIVATE_WITH_EGRESS` subnet for the same reason — see the note under "Running database migrations" below.
- ✅ BromnBlog-Frontend (S3 + CloudFront distribution: `EKN0G1CK1QQC`) — full SSR via OpenNext + a Lambda Function URL behind CloudFront OAC, not just static files
- ✅ BromnBlog-Ses — `blogdobroomn.com` domain verified (DKIM via Route53, automatic, `DkimAttributes.Status: SUCCESS`). **Production access granted** (confirmed via `aws sesv2 get-account`: `ProductionAccessEnabled: true`, review case `178438314600754` status `GRANTED`) — sending works to any recipient, not just pre-verified addresses. Quota: 50,000 emails/24h, 14/sec.
- ✅ Google OAuth configured and confirmed working (redirect URI registered in Google Cloud Console, real login tested)

## ⚠️ Two footguns that already caused real incidents — read before touching `cdk deploy`

1. **Never pass placeholder Google OAuth credentials on any deploy that includes `BromnBlog-Api`, or anything else, unless you pass `--exclusively`.** `bin/infrastructure.ts` falls back to literal `PLACEHOLDER_GOOGLE_CLIENT_ID`/`PLACEHOLDER_GOOGLE_CLIENT_SECRET` strings if `--context googleClientId`/`googleClientSecret` aren't passed — harmless on its own, **except** `ApiStack.addDependency(cognitoStack)` means CDK will also evaluate (and, if the template differs, silently overwrite) `BromnBlog-Cognito` as a dependency. This happened for real: Cognito's Google Identity Provider got its real Client ID/Secret replaced with the literal placeholder strings, breaking login with `Error 401: invalid_client` from Google, until someone with the real credentials redeployed Cognito directly. **If you need to deploy `BromnBlog-Api`/`BromnBlog-Frontend` without the real Google credentials in hand, always add `--exclusively`** so CDK never touches Cognito:
   ```bash
   npx cdk deploy BromnBlog-Api BromnBlog-Frontend --exclusively \
     --context googleClientId=PLACEHOLDER_GOOGLE_CLIENT_ID \
     --context googleClientSecret=PLACEHOLDER_GOOGLE_CLIENT_SECRET \
     --context hostedZoneId=Z03952433C47AYNUTV3QU
   ```

2. **CloudFormation only diffs the S3 key *name* for Lambda code assets, not the object's actual content.** If a `cdk deploy` gets interrupted (e.g. killed) mid-upload, it can leave a truncated zip sitting at that content-hash key in the CDK bootstrap assets bucket (`cdk-hnb659fds-assets-<account>-<region>`). A later deploy that recomputes the *same* hash (nothing in the source changed) will see the object already exists and skip re-uploading — silently deploying the corrupted zip, with CloudFormation reporting success. This happened for real and took the whole site down (502s) until it was traced by comparing local build file counts against the deployed package. If you ever kill a `cdk deploy` mid-flight, or see a Lambda erroring with `Cannot find module` for something that's clearly bundled, don't just retry — verify the deployed artifact matches what's on disk (`aws lambda get-function --function-name <fn> --query Code.Location` and diff it), delete the corrupted object from the assets bucket, and redeploy. If CloudFormation still reports "no changes," force it with `aws lambda update-function-code` directly.

## Frontend deploy procedure (SSR via OpenNext)

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

## Running database migrations / one-off admin SQL

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

Note: `prisma db execute` runs the statement but doesn't print `SELECT` results — it's designed for DDL/DML, not querying. If the local `@prisma/engines` package is missing the `rhel-openssl-3.0.x` schema engine binary needed to rebuild this Lambda, fetch it with `node api/scripts/fetch-migrate-engine.js` before redeploying `BromnBlog-Api` (`npm rebuild @prisma/engines` is unreliable on a fresh checkout — see the script's own comment for why).

Note: neither this Lambda nor `BromnBlog-Api`'s main function gets a `DATABASE_URL` baked in at deploy time anymore — both fetch DB credentials live from Secrets Manager at cold start (`api/src/lib/dbCredentials.ts`), since the DB secret now rotates automatically every 90 days. See [disaster-recovery.md](./disaster-recovery.md#secrets-rotation) for details. **This is why `broomns-blog-migrate` runs in a `PRIVATE_WITH_EGRESS` subnet, not `PRIVATE_ISOLATED`** — this broke for real on 2026-07-23: the migrate Lambda was left in `PRIVATE_ISOLATED` after secret rotation was added, so its Secrets Manager call had no route out and hung until timeout (`ETIMEDOUT`), silently blocking every migration since. The RDS connection itself was never the problem — that's same-VPC routing either way — only the Secrets Manager call needs internet egress.

## Running an on-demand Cognito user export

A weekly export already runs automatically (EventBridge rule, `broomns-blog-cognito-export` Lambda) and lands in the private backups bucket. To trigger one manually (e.g. right before a risky Cognito change):

```bash
aws lambda invoke --function-name broomns-blog-cognito-export --region us-east-1 /dev/stdout
```

See [disaster-recovery.md](./disaster-recovery.md#scenario-cognito-user-pool-lost-or-deleted) for what this export is for and how to use it during an actual recovery.

## Key AWS Resources

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
| S3 Backups Bucket (private) | `broomns-blog-backups-099710233970` |
| API Lambda | `broomns-blog-api` |
| API Gateway | `58m9fzd8lj` |
| Migration/admin-SQL Lambda | `broomns-blog-migrate` |
| Cognito Export Lambda | `broomns-blog-cognito-export` (weekly, also invocable on demand) |
| Frontend SSR Lambda | `broomns-blog-frontend-server` |
| CDK Bootstrap Assets Bucket | `cdk-hnb659fds-assets-099710233970-us-east-1` |
| GitHub Actions deploy role | `broomns-blog-github-deploy` (OIDC, trust-scoped to this repo's `prod` branch only) |

## Node.js 25 Compatibility Note

The project runs on Node.js 25 which has a built-in `localStorage` global requiring `--localstorage-file` flag. This affects:
- Frontend dev server: handled via `NODE_OPTIONS` in package.json `dev` script
- OpenNext build: must pass `NODE_OPTIONS='--localstorage-file=.next/.localStorage'` when running `npx open-next build`
- Lambda runtime: uses Node.js 24 (no issue there — the `localStorage` global was introduced in Node 25, one major version later)
