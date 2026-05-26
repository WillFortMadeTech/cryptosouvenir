#!/bin/bash
set -e
awslocal s3 mb s3://cryptosouvenir-uploads --region us-east-1 || true
awslocal dynamodb create-table \
  --table-name cryptosouvenir-submissions \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 || true
awslocal dynamodb create-table \
  --table-name cryptosouvenir-cubes \
  --attribute-definitions AttributeName=cube_id,AttributeType=S \
  --key-schema AttributeName=cube_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 || true
