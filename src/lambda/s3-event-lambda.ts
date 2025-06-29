import { S3Event, Context } from "aws-lambda";
import { BaseLambda } from "./base-lambda";
import { S3Client, GetObjectCommand, GetObjectCommandOutput } from "@aws-sdk/client-s3";

export abstract class S3EventLambda extends BaseLambda<S3Event, void> {
    protected s3: S3Client;

    constructor() {
        super();
        this.s3 = new S3Client({});
    }

  protected abstract processS3Event(event: S3Event): Promise<void>;

  protected async process(event: S3Event): Promise<void> {
      return await this.processS3Event(event);
  }

  protected async handleError(error: Error | unknown): Promise<void> {
      console.error("Error in S3 Event Lambda:", error);
      throw error;
  }

  protected getS3Records(event: S3Event) {
      return event.Records || [];
  }

  protected async getObject(bucket: string, key: string): Promise<GetObjectCommandOutput> {
      const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key
      });
      return await this.s3.send(command);
  }
}
