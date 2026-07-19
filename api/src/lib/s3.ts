import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const region = process.env.AWS_REGION ?? 'us-east-1'
const bucketName = process.env.S3_BUCKET_NAME ?? ''

const s3Client = new S3Client({ region })

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}
