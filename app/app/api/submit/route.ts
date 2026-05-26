import { NextRequest, NextResponse } from 'next/server'
import { TransactWriteCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { s3, dynamo, BUCKET, TABLE, CUBES_TABLE, CHALLENGES_TABLE } from '@/lib/aws'
import { verifyClaim } from '@/lib/claim'
import { resolveDevice } from '@/lib/webauthn'
import { randomUUID, createHash } from 'crypto'

const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000'
const RP_ID  = process.env.WEBAUTHN_RP_ID  ?? 'localhost'

export async function POST(req: NextRequest) {
  const form        = await req.formData()
  const title       = String(form.get('title')        ?? '').trim()
  const description = String(form.get('description')  ?? '').trim()
  const token       = String(form.get('token')        ?? '').trim()
  const challengeId = String(form.get('challenge_id') ?? '').trim()
  const attestation = String(form.get('attestation')  ?? '').trim()
  const file        = form.get('image') as File | null

  if (!title || !description || !file || !token || !challengeId || !attestation) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const claim = verifyClaim(token)
  if (!claim) return NextResponse.json({ error: 'Invalid or expired claim' }, { status: 403 })

  // Fetch and consume the WebAuthn challenge
  const challengeItem = await dynamo.send(new GetCommand({
    TableName: CHALLENGES_TABLE,
    Key:       { challenge_id: challengeId },
  }))
  if (!challengeItem.Item) {
    return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 403 })
  }
  if (challengeItem.Item.ttl < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 403 })
  }

  // Parse attestation once — reuse for verification and transport extraction
  let parsedAttestation: Record<string, unknown>
  try {
    parsedAttestation = JSON.parse(attestation)
  } catch {
    return NextResponse.json({ error: 'Invalid attestation' }, { status: 400 })
  }
  const transports: string[] = (parsedAttestation?.response as Record<string, unknown>)?.transports as string[] ?? []

  // Verify the WebAuthn attestation
  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>
  try {
    verification = await verifyRegistrationResponse({
      response:                parsedAttestation as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge:       challengeItem.Item.challenge as string,
      expectedOrigin:          ORIGIN,
      expectedRPID:            RP_ID,
      requireUserVerification: false,
    })
  } catch {
    return NextResponse.json({ error: 'WebAuthn verification failed' }, { status: 403 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'WebAuthn verification failed' }, { status: 403 })
  }

  // Consume the challenge so it can't be replayed
  await dynamo.send(new DeleteCommand({ TableName: CHALLENGES_TABLE, Key: { challenge_id: challengeId } }))

  // Extract signing metadata from the verified attestation
  const { credentialPublicKey, aaguid, userVerified } = verification.registrationInfo
  const keyFingerprint = createHash('sha256')
    .update(Buffer.from(credentialPublicKey))
    .digest('base64')
    .replace(/=+$/, '')  // match SSH fingerprint format (no padding)
  const deviceName = resolveDevice(aaguid, transports)

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
            Item: {
              id, ip, timestamp, title, description,
              s3_key: s3Key, cube_id: claim.cubeId, color: claim.color,
              key_fingerprint: keyFingerprint,
              device_name:     deviceName,
              user_verified:   userVerified,
              aaguid,
            },
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
