import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const region   = process.env.AWS_REGION       ?? 'us-east-1'
const endpoint = process.env.AWS_ENDPOINT_URL  // undefined → use real AWS

const credentials = {
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? 'test',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
}

export const s3 = new S3Client({
  region,
  endpoint,
  credentials,
  forcePathStyle: !!endpoint, // required for LocalStack path-style S3 URLs
})

export const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, endpoint, credentials })
)

export const BUCKET       = process.env.S3_BUCKET            ?? 'cryptosouvenir-uploads'
export const TABLE        = process.env.DYNAMODB_TABLE       ?? 'cryptosouvenir-submissions'
export const CUBES_TABLE  = process.env.DYNAMODB_CUBES_TABLE ?? 'cryptosouvenir-cubes'
