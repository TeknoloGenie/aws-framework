import { FileUploadLambda } from "aws-framework";
import { APIGatewayProxyEvent } from "aws-lambda";
import { AuthUser, Permission, FileUploadRequest, FileUploadResponse } from "../types";
import { PermissionManager } from "../utils/permissions";

export class SocialMediaFileUploadLambda extends FileUploadLambda {
    protected async validateFile(fileName: string, contentType: string, fileSize: number): Promise<boolean> {
    // Define allowed file types for social media
        const allowedImageTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/webp"
        ];

        const allowedVideoTypes = [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo" // .avi
        ];

        const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

        // Check content type
        if (!allowedTypes.includes(contentType.toLowerCase())) {
            this.logger.warn("Invalid file type", { fileName, contentType });
            return false;
        }

        // Check file size limits
        const maxImageSize = 10 * 1024 * 1024; // 10MB for images
        const maxVideoSize = 100 * 1024 * 1024; // 100MB for videos

        if (allowedImageTypes.includes(contentType.toLowerCase()) && fileSize > maxImageSize) {
            this.logger.warn("Image file too large", { fileName, fileSize, maxImageSize });
            return false;
        }

        if (allowedVideoTypes.includes(contentType.toLowerCase()) && fileSize > maxVideoSize) {
            this.logger.warn("Video file too large", { fileName, fileSize, maxVideoSize });
            return false;
        }

        // Check file name for security
        if (this.containsUnsafeCharacters(fileName)) {
            this.logger.warn("Unsafe characters in filename", { fileName });
            return false;
        }

        return true;
    }

    protected async authorizeUpload(event: APIGatewayProxyEvent): Promise<boolean> {
        const user = this.getAuthenticatedUser(event);
        if (!user) {
            return false;
        }

        const body = this.parseJsonBody<FileUploadRequest>(event);
        if (!body) {
            return false;
        }

        // Check permissions based on upload type
        switch (body.uploadType) {
        case "profile":
        // Users can upload their own profile pictures
            return true;

        case "post":
        // Check if user can create posts
            return PermissionManager.hasPermission(user, Permission.CREATE_POST);

        case "message":
        // Check if user can send messages
            return PermissionManager.hasPermission(user, Permission.SEND_MESSAGE);

        default:
            return false;
        }
    }

    protected async generateFileKey(event: APIGatewayProxyEvent, fileName: string): Promise<string> {
        const user = this.getAuthenticatedUser(event);
        const body = this.parseJsonBody<FileUploadRequest>(event);

        if (!user || !body) {
            throw new Error("Invalid request");
        }

        const timestamp = Date.now();
        const fileExtension = fileName.split(".").pop();
        const sanitizedFileName = this.sanitizeFileName(fileName);

        // Generate file key based on upload type
        switch (body.uploadType) {
        case "profile":
            return `users/${user.id}/profile/${timestamp}-${sanitizedFileName}`;

        case "post":
            return `users/${user.id}/posts/${timestamp}-${sanitizedFileName}`;

        case "message":
            return `users/${user.id}/messages/${timestamp}-${sanitizedFileName}`;

        default:
            return `users/${user.id}/misc/${timestamp}-${sanitizedFileName}`;
        }
    }

    protected async onUploadComplete(event: APIGatewayProxyEvent, fileKey: string): Promise<void> {
        const user = this.getAuthenticatedUser(event);
        const body = this.parseJsonBody<FileUploadRequest>(event);

        if (!user || !body) {
            return;
        }

        // Log the upload for audit purposes
        this.logger.info("File upload completed", {
            userId: user.id,
            username: user.username,
            fileKey,
            uploadType: body.uploadType,
            fileName: body.fileName,
            contentType: body.contentType,
            fileSize: body.fileSize
        });

        // You could also:
        // - Store file metadata in DynamoDB
        // - Trigger image processing (thumbnails, compression)
        // - Send notifications
        // - Update user profile if it's a profile picture

        if (body.uploadType === "profile") {
            await this.updateUserProfilePicture(user.id, fileKey);
        }
    }

    private async updateUserProfilePicture(userId: string, fileKey: string): Promise<void> {
        try {
            // This would update the user's profile picture in your database
            // Implementation depends on your user management system
            this.logger.info("Updated user profile picture", { userId, fileKey });
        } catch (error) {
            this.logger.error("Error updating user profile picture", { error, userId, fileKey });
        }
    }

    private containsUnsafeCharacters(fileName: string): boolean {
    // Check for potentially unsafe characters
        const unsafePattern = /[<>:"/\\|?*\x00-\x1f]/;
        return unsafePattern.test(fileName);
    }

    private sanitizeFileName(fileName: string): string {
    // Remove unsafe characters and normalize
        return fileName
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
            .replace(/\s+/g, "-")
            .toLowerCase();
    }

    protected getUploadConfiguration() {
        return {
            maxFileSize: 100 * 1024 * 1024, // 100MB max
            allowedContentTypes: [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/gif",
                "image/webp",
                "video/mp4",
                "video/webm",
                "video/quicktime",
                "video/x-msvideo"
            ],
            expirationTime: 3600 // 1 hour for presigned URL
        };
    }
}

export const handler = new SocialMediaFileUploadLambda().handler.bind(new SocialMediaFileUploadLambda());
