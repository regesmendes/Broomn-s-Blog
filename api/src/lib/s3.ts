import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const region = process.env.AWS_REGION ?? 'us-east-1'
const bucketName = process.env.S3_BUCKET_NAME ?? ''
// CloudFront media distribution base URL (e.g. https://media.blogdobroomn.com,
// no trailing slash) — set in production only (infrastructure/lib/stacks/api-stack.ts).
// Unset locally falls back to the direct S3 URL, so dev without a CDN still works.
const cdnUrl = process.env.MEDIA_CDN_URL

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
      // Safe because media URLs are immutable — every upload gets a brand-new
      // crypto.randomUUID() key (media.routes.ts), nothing ever re-uploads
      // bytes to an existing key.
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  return cdnUrl
    ? `${cdnUrl}/${key}`
    : `https://${bucketName}.s3.${region}.amazonaws.com/${key}`
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}
