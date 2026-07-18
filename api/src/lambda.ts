import awsLambdaFastify from '@fastify/aws-lambda'
import { buildApp } from './app'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let proxy: ((event: any, context: any) => Promise<any>) | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any, context: any) => {
  if (!proxy) {
    const app = await buildApp()
    proxy = awsLambdaFastify(app)
  }
  return proxy(event, context)
}
