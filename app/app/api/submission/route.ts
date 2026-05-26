import { NextRequest, NextResponse } from 'next/server'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo, TABLE, CUBES_TABLE } from '@/lib/aws'

export async function GET(req: NextRequest) {
  const cube_id = req.nextUrl.searchParams.get('cube_id')
  if (!cube_id) return NextResponse.json({ error: 'Missing cube_id' }, { status: 400 })

  const cube = await dynamo.send(new GetCommand({ TableName: CUBES_TABLE, Key: { cube_id } }))
  if (!cube.Item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sub = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { id: cube.Item.submission_id } }))
  if (!sub.Item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, description, s3_key, timestamp } = sub.Item
  return NextResponse.json({ title, description, s3_key, timestamp, color: cube.Item.color })
}
