import { NextRequest, NextResponse } from 'next/server'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { randomBytes } from 'crypto'
import { dynamo, CHALLENGES_TABLE } from '@/lib/aws'

export async function POST(req: NextRequest) {
  const body    = await req.json().catch(() => null)
  const cube_id = body?.cube_id as string | undefined
  if (!cube_id) return NextResponse.json({ error: 'Missing cube_id' }, { status: 400 })

  const challenge    = randomBytes(32).toString('base64url')
  const challenge_id = randomBytes(16).toString('hex')
  const ttl          = Math.floor(Date.now() / 1000) + 300 // 5-minute window

  await dynamo.send(new PutCommand({
    TableName: CHALLENGES_TABLE,
    Item:      { challenge_id, challenge, cube_id, ttl },
  }))

  return NextResponse.json({
    challenge_id,
    challenge,
    rp_id:   process.env.WEBAUTHN_RP_ID   ?? 'localhost',
    rp_name: process.env.WEBAUTHN_RP_NAME ?? 'CryptoSouvenir',
  })
}
