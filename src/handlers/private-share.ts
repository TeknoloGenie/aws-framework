import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const fileId = event.pathParameters?.fileId;
        if (!fileId) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ error: "fileId is required" }),
            };
        }

        // Validate fileId format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(fileId)) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ error: "Invalid fileId format" }),
            };
        }

        // Verify this is an internal request (check source IP or VPC endpoint)
        const sourceIp = event.requestContext.identity?.sourceIp;
        if (!isInternalRequest(sourceIp)) {
            return {
                statusCode: 403,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ error: "Access denied - external requests not allowed" }),
            };
        }

        // Find the file in private bucket
        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.PRIVATE_BUCKET_NAME,
            Prefix: `${fileId}/`,
            MaxKeys: 1,
        });

        const listResponse = await s3Client.send(listCommand);
        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ error: "File not found" }),
            };
        }

        const objectKey = listResponse.Contents[0].Key!;

        // Get the file directly (no presigned URL for internal access)
        const command = new GetObjectCommand({
            Bucket: process.env.PRIVATE_BUCKET_NAME,
            Key: objectKey,
        });

        const response = await s3Client.send(command);

        // For large files, you might want to stream instead
        const body = await response.Body?.transformToByteArray();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": response.ContentType || "application/octet-stream",
                "Content-Length": response.ContentLength?.toString() || "0",
                "Cache-Control": "private, max-age=3600",
            },
            body: Buffer.from(body || []).toString("base64"),
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error("Private share handler error:", error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};

function isInternalRequest(sourceIp?: string): boolean {
    if (!sourceIp) return false;

    // Check if request is from private IP ranges (VPC)
    const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
    ];

    return privateRanges.some(range => range.test(sourceIp));
}
