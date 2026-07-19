---
name: db-migrate
description: Run Prisma migrations or one-off admin SQL against the production database via the broomns-blog-migrate Lambda. Use when the user asks to run a prod migration, promote a user to admin, or execute a one-off SQL statement in production.
disable-model-invocation: true
---

The production RDS instance has no public access. The only way in is the `broomns-blog-migrate` Lambda, which runs inside the same VPC. Confirm with the user before invoking — this touches the production database.

## Apply pending Prisma migrations (default behavior)

```bash
aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 /dev/stdout
```

## Run an arbitrary one-off SQL statement

Useful for admin tasks like promoting a user to `ADMIN` — there's no bastion host, this Lambda is the admin console.

```bash
aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"args":["db","execute","--stdin"],"stdin":"UPDATE users SET role = '"'"'ADMIN'"'"' WHERE email = '"'"'you@example.com'"'"';"}' \
  /dev/stdout
```

Note: `prisma db execute` runs the statement but doesn't print `SELECT` results — it's for DDL/DML, not querying.

## If the Lambda needs rebuilding first

If local `@prisma/engines` is missing the `rhel-openssl-3.0.x` binary this Lambda needs (Amazon Linux 2023 runtime), fetch it before redeploying `BromnBlog-Api`:

```bash
PRISMA_CLI_BINARY_TARGETS=native,rhel-openssl-3.0.x npm rebuild @prisma/engines
```
