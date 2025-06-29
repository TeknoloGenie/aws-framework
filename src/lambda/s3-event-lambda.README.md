# S3EventLambda

The `S3EventLambda` class extends the base Lambda functionality to handle events triggered by S3 bucket operations.

## Overview

This class provides a structured approach to building Lambda functions that respond to S3 events such as object creation, deletion, or modification. It includes utilities for accessing S3 objects and processing S3 event records.

## Class Definition

```typescript
export abstract class S3EventLambda extends BaseLambda<S3Event, void>
```

## Key Methods

### `processS3Event(event: S3Event): Promise<void>`

Abstract method that must be implemented by subclasses to define the S3 event processing logic.

### `process(event: S3Event): Promise<void>`

Implements the abstract `process` method from `BaseLambda`. Calls `processS3Event` to handle the S3 event.

### `handleError(error: Error | unknown): Promise<void>`

Implements the abstract `handleError` method from `BaseLambda`. Logs the error and re-throws it.

### Utility Methods

- `getS3Records(event: S3Event): S3EventRecord[]`
  Returns the S3 event records from the event, or an empty array if none exist.

- `getObject(bucket: string, key: string): Promise<GetObjectCommandOutput>`
  Retrieves an object from S3 using the provided bucket and key.

## Properties

- `s3: S3Client`
  An instance of the AWS SDK v3 S3 client for interacting with S3 buckets and objects.

## Usage Example

```typescript
import { S3EventLambda } from 'aws-framework';
import { S3Event } from 'aws-lambda';
import { Readable } from 'stream';

export class ImageProcessorLambda extends S3EventLambda {
  protected async processS3Event(event: S3Event): Promise<void> {
    const records = this.getS3Records(event);
    
    for (const record of records) {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key;
      
      // Only process image files
      if (!key.match(/\.(jpg|jpeg|png|gif)$/i)) {
        console.log(`Skipping non-image file: ${key}`);
        continue;
      }
      
      // Get the image from S3
      const s3Object = await this.getObject(bucket, key);
      
      // Convert the readable stream to a buffer
      const imageBuffer = await streamToBuffer(s3Object.Body as Readable);
      
      // Process the image
      await this.processImage(bucket, key, imageBuffer);
    }
  }
  
  private async processImage(bucket: string, key: string, imageBuffer: Buffer): Promise<void> {
    // Implementation to process the image
    // For example: resize, compress, or extract metadata
    
    // Save the processed image back to S3 using the S3 client
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: `processed/${key}`,
      Body: imageBuffer, // Processed image
      ContentType: 'image/jpeg'
    });
    
    await this.s3.send(command);
  }
}

// Helper function to convert a readable stream to a buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export const handler = new ImageProcessorLambda().handler.bind(new ImageProcessorLambda());
```

## Common S3 Event Types

- `s3:ObjectCreated:*` - Any object creation event
- `s3:ObjectCreated:Put` - Object created using PUT
- `s3:ObjectCreated:Post` - Object created using POST
- `s3:ObjectCreated:Copy` - Object created using COPY
- `s3:ObjectRemoved:*` - Any object removal event
- `s3:ObjectRemoved:Delete` - Object deleted
- `s3:ObjectRestore:*` - Any object restore event

## Best Practices

- Process S3 events in batches when possible for better efficiency
- Implement proper error handling for S3 operations
- Use the `getObject` method to retrieve objects from S3
- Consider using S3 event filtering to only trigger on specific events or object prefixes
- Be mindful of S3 object sizes when processing large files
- Use the AWS SDK v3's modular approach for better tree-shaking and smaller bundle sizes