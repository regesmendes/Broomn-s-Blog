import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import { getDatabaseUrl } from './lib/dbCredentials'

/**
 * On-demand migration Lambda: runs prisma CLI commands against the live
 * database from inside the VPC (the RDS instance is only reachable from the
 * Lambda security group). Defaults to `prisma migrate deploy` — invoke after
 * deploying new migrations:
 *
 *   aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 /dev/stdout
 *
 * Also accepts a payload to run other one-off prisma CLI commands (e.g.
 * `db execute` for an ad-hoc SQL statement) against the same database, since
 * there's no other way to reach it:
 *
 *   aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 \
 *     --cli-binary-format raw-in-base64-out \
 *     --payload '{"args":["db","execute","--stdin"],"stdin":"UPDATE ..."}' \
 *     /dev/stdout
 *
 * The prisma CLI and the rhel-openssl-3.0.x schema engine binary are bundled
 * into the Lambda package by the CDK stack (see api-stack.ts).
 */
export const handler = async (event?: { args?: string[]; stdin?: string }) => {
  const taskRoot = process.env.LAMBDA_TASK_ROOT ?? '/var/task'
  const args = event?.args ?? ['migrate', 'deploy']

  // Fetched fresh (not baked in at deploy time) so this Lambda keeps working
  // across a scheduled DB credential rotation without needing a redeploy —
  // see api/src/lib/dbCredentials.ts and docs/disaster-recovery.md.
  const databaseUrl = await getDatabaseUrl()

  const output = execFileSync(
    'node',
    [
      path.join(taskRoot, 'node_modules', 'prisma', 'build', 'index.js'),
      ...args,
      '--schema',
      path.join(taskRoot, 'prisma', 'schema.prisma'),
    ],
    {
      input: event?.stdin,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        // /var/task is read-only; give anything that wants $HOME a writable dir
        HOME: '/tmp',
        // Point the CLI at the bundled Lambda-compatible schema engine so it
        // never tries to download one (no internet in the isolated subnet)
        PRISMA_SCHEMA_ENGINE_BINARY: path.join(taskRoot, 'schema-engine-rhel-openssl-3.0.x'),
        // Disable telemetry/update checks — they would hang without internet
        CHECKPOINT_DISABLE: '1',
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
    },
  )

  console.log(output)
  return { statusCode: 200, output }
}
