import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent } from "aws-lambda";
import { ApiResponse, RestApiLambda } from "./rest-api-lambda";

export interface FileUploadRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadType?: string;
}

export interface FileUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export abstract class FileUploadLambda extends RestApiLambda {
    protected s3Client: S3Client;
    protected bucketName: string;

    constructor() {
        super();
        this.s3Client = new S3Client({ region: process.env.AWS_REGION });
        this.bucketName = process.env.S3_BUCKET_NAME || "";
    }

    protected async processApi(event: APIGatewayProxyEvent): Promise<ApiResponse> {
        const method = event.httpMethod;

        switch (method) {
        case "POST":
            return await this.handleUploadRequest(event);
        default:
            return this.methodNotAllowedResponse();
        }
    }

    private async handleUploadRequest(event: APIGatewayProxyEvent): Promise<ApiResponse> {
        try {
            // Check authorization
            const authorized = await this.authorizeUpload(event);
            if (!authorized) {
                return this.forbiddenResponse("Upload not authorized");
            }

            const body = this.parseJsonBody<FileUploadRequest>(event);
            if (!body) {
                return this.badRequestResponse("Invalid request body");
            }

            // Validate file
            const isValid = await this.validateFile(body.fileName, body.contentType, body.fileSize);
            if (!isValid) {
                return this.badRequestResponse("File validation failed");
            }

            // Generate file key
            const fileKey = await this.generateFileKey(event, body.fileName);

            // Generate presigned URL
            const uploadUrl = await this.generatePresignedUrl(fileKey, body.contentType);

            // Generate public URL
            const publicUrl = await this.generatePublicUrl(fileKey);

            const response: FileUploadResponse = {
                uploadUrl,
                fileKey,
                publicUrl
            };

            // Call completion hook
            await this.onUploadComplete(event, fileKey);

            return this.successResponse(response, "Upload URL generated successfully");

        } catch (error) {
            this.logger.error("Error handling upload request", { error });
            return this.internalServerErrorResponse("Failed to generate upload URL");
        }
    }

    private async generatePresignedUrl(fileKey: string, contentType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            ContentType: contentType,
            ServerSideEncryption: "AES256"
        });

        return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }

    private async generatePublicUrl(fileKey: string): Promise<string> {
        const region = process.env.AWS_REGION || "us-east-1";
        return `https://${this.bucketName}.s3.${region}.amazonaws.com/${fileKey}`;
    }

  // Abstract methods to be implemented by subclasses
  protected abstract validateFile(fileName: string, contentType: string, fileSize: number): Promise<boolean>;
  protected abstract authorizeUpload(event: APIGatewayProxyEvent): Promise<boolean>;
  protected abstract generateFileKey(event: APIGatewayProxyEvent, fileName: string): Promise<string>;
  protected abstract onUploadComplete(event: APIGatewayProxyEvent, fileKey: string): Promise<void>;

  // Helper methods
  protected parseJsonBody<T>(event: APIGatewayProxyEvent): T | null {
      if (!event.body) return null;
      try {
          return JSON.parse(event.body) as T;
      } catch (error) {
          return null;
      }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected successResponse(data: any, message?: string): ApiResponse {
      return {
          statusCode: 200,
          body: {
              success: true,
              data,
              message
          }
      };
  }

  protected badRequestResponse(message: string): ApiResponse {
      return {
          statusCode: 400,
          body: {
              success: false,
              error: message
          }
      };
  }

  protected forbiddenResponse(message: string): ApiResponse {
      return {
          statusCode: 403,
          body: {
              success: false,
              error: message
          }
      };
  }

  protected internalServerErrorResponse(message: string): ApiResponse {
      return {
          statusCode: 500,
          body: {
              success: false,
              error: message
          }
      };
  }

  protected methodNotAllowedResponse(): ApiResponse {
      return {
          statusCode: 405,
          body: {
              success: false,
              error: "Method not allowed"
          }
      };
  }
}
