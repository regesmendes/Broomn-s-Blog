import { execFileSync } from 'node:child_process'
import * as path from 'node:path'

/**
 * On-demand migration Lambda: runs `prisma migrate deploy` against the live
 * database from inside the VPC (the RDS instance is only reachable from the
 * Lambda security group). Invoke manually after deploying new migrations:
 *
 *   aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 /dev/stdout
 *
 * The prisma CLI and the rhel-openssl-3.0.x schema engine binary are bundled
 * into the Lambda package by the CDK stack (see api-stack.ts).
 */
export const handler = async () => {
  const taskRoot = process.env.LAMBDA_TASK_ROOT ?? '/var/task'

  const output = execFileSync(
    'node',
    [
      path.join(taskRoot, 'node_modules', 'prisma', 'build', 'index.js'),
      'migrate',
      'deploy',
      '--schema',
      path.join(taskRoot, 'prisma', 'schema.prisma'),
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
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
