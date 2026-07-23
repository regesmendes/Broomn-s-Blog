import awsLambdaFastify from '@fastify/aws-lambda'
import { getDatabaseUrl } from './lib/dbCredentials'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let proxy: ((event: any, context: any) => Promise<any>) | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any, context: any) => {
  if (!proxy) {
    // Must resolve before anything that touches lib/prisma.ts is required —
    // PrismaClient reads DATABASE_URL at construction time, so the fetch has
    // to land in process.env before that module (transitively pulled in by
    // ./app) is ever loaded. Hence the runtime require() below instead of a
    // static top-level import.
    process.env.DATABASE_URL = await getDatabaseUrl()
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildApp } = require('./app')
    const app = await buildApp()
    proxy = awsLambdaFastify(app)
  }
  return proxy(event, context)
}
