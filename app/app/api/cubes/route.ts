import { NextResponse } from 'next/server'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo, CUBES_TABLE } from '@/lib/aws'

export async function GET() {
  const result = await dynamo.send(new ScanCommand({
    TableName:            CUBES_TABLE,
    ProjectionExpression: 'cube_id, color',
  }))
  return NextResponse.json(result.Items ?? [])
}
