import { NextRequest, NextResponse } from 'next/server'
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3, dynamo, BUCKET, TABLE, CUBES_TABLE } from '@/lib/aws'
import { verifyClaim } from '@/lib/claim'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const form        = await req.formData()
  const title       = String(form.get('title')       ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const token       = String(form.get('token')       ?? '').trim()
  const file        = form.get('image') as File | null

  if (!title || !description || !file || !token) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const claim = verifyClaim(token)
  if (!claim) return NextResponse.json({ error: 'Invalid or expired claim' }, { status: 403 })

  const id        = randomUUID()
  const ext       = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const s3Key     = `uploads/${id}.${ext}`
  const timestamp = new Date().toISOString()
  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
               ??  req.headers.get('x-real-ip')
               ??  'unknown'

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         s3Key,
    Body:        Buffer.from(await file.arrayBuffer()),
    ContentType: file.type,
  }))

  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName:           CUBES_TABLE,
            Item:                { cube_id: claim.cubeId, submission_id: id, color: claim.color, claimed_at: timestamp },
            ConditionExpression: 'attribute_not_exists(cube_id)',
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item:      { id, ip, timestamp, title, description, s3_key: s3Key, cube_id: claim.cubeId, color: claim.color },
          },
        },
      ],
    }))
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'TransactionCanceledException') {
      return NextResponse.json({ error: 'already_claimed' }, { status: 409 })
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}
