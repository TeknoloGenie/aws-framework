import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const fileId = event.pathParameters?.fileId;
    if (!fileId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'fileId is required' }),
      };
    }

    // Validate fileId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileId)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid fileId format' }),
      };
    }

    // Try both buckets to find the file
    const buckets = [
      { name: process.env.PUBLIC_BUCKET_NAME, isPrivate: false },
      { name: process.env.PRIVATE_BUCKET_NAME, isPrivate: true }
    ];
    
    let foundBucket = null;
    let objectKey = null;

    for (const bucket of buckets) {
      try {
        // List objects with the fileId prefix
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket.name,
          Prefix: `${fileId}/`,
          MaxKeys: 1,
        });
        
        const listResponse = await s3Client.send(listCommand);
        if (listResponse.Contents && listResponse.Contents.length > 0) {
          foundBucket = bucket;
          objectKey = listResponse.Contents[0].Key;
          break;
        }
      } catch (error) {
        // Continue to next bucket
        console.log(`File not found in bucket ${bucket.name}`);
      }
    }

    if (!foundBucket || !objectKey) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'File not found' }),
      };
    }

    // For private files, ensure user has access (implement your authorization logic here)
    if (foundBucket.isPrivate) {
      const userId = event.requestContext.identity?.cognitoIdentityId;
      if (!userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Access denied to private file' }),
        };
      }
    }

    // Generate presigned URL for download
    const command = new GetObjectCommand({
      Bucket: foundBucket.name,
      Key: objectKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 300, // 5 minutes for downloads
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        downloadUrl,
        expiresIn: 300,
      }),
    };
  } catch (error) {
    console.error('Download handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
