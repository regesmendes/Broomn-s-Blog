---
name: deploy-frontend
description: Deploy the Next.js frontend to production (S3 + CloudFront + Lambda via OpenNext). Use when the user asks to deploy, redeploy, or ship frontend changes to blogdobroomn.com.
disable-model-invocation: true
---

Deploying frontend code changes requires 3 steps in order — a plain `cdk deploy` alone does nothing, since the CDK stack just packages whatever is already on disk in `frontend/.open-next/`.

Before running anything, confirm with the user which step(s) they want run — this touches production.

## 1. Build

`NEXT_PUBLIC_*` env vars are inlined at build time, not runtime.

```bash
cd frontend
rm -rf .next .open-next   # WSL2/DrvFs file-watching is unreliable — always start clean
NEXT_PUBLIC_API_URL=https://api.blogdobroomn.com \
NEXT_PUBLIC_COGNITO_DOMAIN=https://broomns-blog.auth.us-east-1.amazoncognito.com \
NEXT_PUBLIC_COGNITO_CLIENT_ID=535qq83rh90srom3ij4ospn78e \
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://blogdobroomn.com/pt/auth/callback \
NODE_OPTIONS='--localstorage-file=.next/.localStorage' npx open-next build
```

## 2. Sync static assets to S3

```bash
aws s3 sync .open-next/assets s3://broomns-blog-frontend-099710233970/_assets --delete
```

## 3. Deploy the CDK stack

Always pass `--exclusively` — without it, CDK also evaluates `BromnBlog-Cognito` as a dependency, and if real Google OAuth credentials aren't passed, `bin/infrastructure.ts` falls back to placeholder strings that can silently overwrite Cognito's real Google IdP secret. This happened for real once and broke login.

```bash
cd ../infrastructure
npx cdk deploy BromnBlog-Frontend --exclusively \
  --context googleClientId=PLACEHOLDER_GOOGLE_CLIENT_ID \
  --context googleClientSecret=PLACEHOLDER_GOOGLE_CLIENT_SECRET \
  --context hostedZoneId=Z03952433C47AYNUTV3QU
```

## 4. Invalidate CloudFront

```bash
aws cloudfront create-invalidation --distribution-id EKN0G1CK1QQC --paths "/*"
```

## If something looks wrong after deploy

CloudFormation only diffs the S3 asset key by hash, not content — an interrupted deploy can leave a truncated zip that a later "no changes" deploy silently reuses. If a Lambda errors with something like `Cannot find module` for code that's clearly bundled, don't just retry:

```bash
aws lambda get-function --function-name broomns-blog-frontend-server --query Code.Location
```

Compare against the local build. If it's stale/corrupted, delete the object from the CDK assets bucket (`cdk-hnb659fds-assets-099710233970-us-east-1`) and redeploy, or force it with `aws lambda update-function-code` directly.
