import { NextRequest, NextResponse } from 'next/server'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo, CUBES_TABLE } from '@/lib/aws'
import { randomColor, makeClaim } from '@/lib/claim'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const cube_id = body?.cube_id as string | undefined
  if (!cube_id) return NextResponse.json({ error: 'Missing cube_id' }, { status: 400 })

  const existing = await dynamo.send(new GetCommand({ TableName: CUBES_TABLE, Key: { cube_id } }))
  if (existing.Item) return NextResponse.json({ error: 'already_claimed' }, { status: 409 })

  const color = randomColor()
  const token = makeClaim(cube_id, color)
  return NextResponse.json({ token, color })
}
