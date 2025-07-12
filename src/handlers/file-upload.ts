import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = JSON.parse(event.body || "{}");
        const { fileName, fileType, isPrivate = false } = body;

        if (!fileName || !fileType) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({ error: "fileName and fileType are required" }),
            };
        }

        // Validate file type if restrictions are set
        const allowedTypes = JSON.parse(process.env.ALLOWED_FILE_TYPES || "[]");
        if (allowedTypes.length > 0 && !allowedTypes.includes(fileType)) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({ error: "File type not allowed" }),
            };
        }

        // Validate file size
        const maxSize = parseInt(process.env.MAX_FILE_SIZE || "0");
        const contentLength = parseInt(event.headers["content-length"] || "0");
        if (maxSize > 0 && contentLength > maxSize) {
            return {
                statusCode: 413,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({ error: "File too large" }),
            };
        }

        const fileId = uuidv4();
        const bucketName = isPrivate ? process.env.PRIVATE_BUCKET_NAME : process.env.PUBLIC_BUCKET_NAME;
        const key = `${fileId}/${fileName}`;

        // Generate presigned URL for upload with security constraints
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: fileType,
            ServerSideEncryption: "AES256",
            Metadata: {
                "uploaded-by": event.requestContext.identity?.cognitoIdentityId || "anonymous",
                "upload-timestamp": new Date().toISOString(),
            },
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 900, // 15 minutes instead of 1 hour
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
            body: JSON.stringify({
                fileId,
                uploadUrl,
                expiresIn: 900,
            }),
        };
    } catch (error) {
        console.error("Upload handler error:", error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};
