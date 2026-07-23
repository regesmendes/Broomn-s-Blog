import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * Scheduled export of Cognito user pool users to the private backups bucket
 * (see storage-stack.ts's BackupBucket and api-stack.ts's EventBridge rule).
 *
 * This is the one piece of state CDK can't reproduce by redeploying — if the
 * pool is ever lost, recreating the stack gives every user a brand new
 * Cognito `sub`, which (per docs/disaster-recovery.md's Cognito runbook)
 * locks every existing user out of login until their app-side User row is
 * manually repointed to the new sub. This export at least gives an admin a
 * record of which sub belonged to which email beforehand.
 */
export const handler = async () => {
  const userPoolId = process.env.COGNITO_USER_POOL_ID!
  const bucketName = process.env.BACKUP_BUCKET_NAME!

  const cognito = new CognitoIdentityProviderClient({})
  const users: Record<string, unknown>[] = []
  let paginationToken: string | undefined

  do {
    const result = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
      })
    )

    for (const user of result.Users ?? []) {
      users.push(toExportedUser(user))
    }

    paginationToken = result.PaginationToken
  } while (paginationToken)

  const exportDate = new Date().toISOString().slice(0, 10)
  const key = `cognito-exports/${exportDate}.json`

  const s3 = new S3Client({})
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(
        { exportedAt: new Date().toISOString(), userCount: users.length, users },
        null,
        2
      ),
      ContentType: 'application/json',
    })
  )

  console.log(`Exported ${users.length} Cognito users to s3://${bucketName}/${key}`)
  return { statusCode: 200, userCount: users.length, key }
}

function toExportedUser(user: UserType) {
  const attributes = Object.fromEntries(
    (user.Attributes ?? []).map((a) => [a.Name, a.Value])
  )

  return {
    sub: attributes.sub,
    email: attributes.email,
    name: attributes.name,
    enabled: user.Enabled,
    userStatus: user.UserStatus,
    userCreateDate: user.UserCreateDate,
  }
}
