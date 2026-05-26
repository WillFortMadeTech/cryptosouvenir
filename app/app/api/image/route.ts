import { NextRequest } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3, BUCKET } from '@/lib/aws'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return new Response('Missing key', { status: 400 })

  const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const bytes  = await (result.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray()

  return new Response(bytes.buffer as ArrayBuffer, {
    headers: { 'Content-Type': result.ContentType ?? 'application/octet-stream' },
  })
}
