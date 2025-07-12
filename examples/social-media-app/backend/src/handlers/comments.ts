import { RestApiLambda, ApiResponse } from "aws-framework";
import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Comment, CreateCommentRequest, AuthUser, Permission, PaginatedResponse } from "../types";
import { PermissionManager } from "../utils/permissions";

export class CommentsLambda extends RestApiLambda {
    private dynamoClient: DynamoDBDocumentClient;
    private tableName: string;

    constructor() {
        super();
        const client = new DynamoDBClient({ region: process.env.AWS_REGION });
        this.dynamoClient = DynamoDBDocumentClient.from(client);
        this.tableName = process.env.DYNAMODB_TABLE_NAME!;
    }

    protected async processApi(event: APIGatewayProxyEvent): Promise<ApiResponse> {
        const user = this.getAuthenticatedUser(event);
        if (!user) {
            return this.unauthorizedResponse("Authentication required");
        }

        const method = event.httpMethod;
        const pathParameters = event.pathParameters || {};

        try {
            switch (method) {
            case "GET":
                if (pathParameters.postId) {
                    return await this.getComments(pathParameters.postId, event, user);
                }
                return this.badRequestResponse("Post ID is required");

            case "POST":
                if (!pathParameters.postId) {
                    return this.badRequestResponse("Post ID is required");
                }
                return await this.createComment(pathParameters.postId, event, user);

            case "PUT":
                if (!pathParameters.id) {
                    return this.badRequestResponse("Comment ID is required");
                }
                return await this.updateComment(pathParameters.id, event, user);

            case "DELETE":
                if (!pathParameters.id) {
                    return this.badRequestResponse("Comment ID is required");
                }
                return await this.deleteComment(pathParameters.id, user);

            default:
                return this.methodNotAllowedResponse();
            }
        } catch (error) {
            this.logger.error("Error processing comments request", { error, event });
            return this.internalServerErrorResponse("Failed to process request");
        }
    }

    private async getComments(postId: string, event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        const limit = parseInt(this.getQueryParameter(event, "limit") || "50");
        const nextToken = this.getQueryParameter(event, "nextToken");
        const includeReplies = this.getQueryParameter(event, "includeReplies") === "true";

        try {
            // First, verify the post exists and user can access it
            const postExists = await this.verifyPostAccess(postId, user);
            if (!postExists) {
                return this.notFoundResponse("Post not found or access denied");
            }

            const queryParams: any = {
                TableName: this.tableName,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
                ExpressionAttributeValues: {
                    ":pk": `POST#${postId}`,
                    ":sk": "COMMENT#",
                    ":entityType": "COMMENT"
                },
                FilterExpression: "entityType = :entityType",
                Limit: limit,
                ScanIndexForward: true // Oldest first for comments
            };

            if (nextToken) {
                queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString());
            }

            const result = await this.dynamoClient.send(new QueryCommand(queryParams));

            let comments = (result.Items || []).map(item => this.mapDynamoItemToComment(item));

            // If including replies, fetch nested comments
            if (includeReplies) {
                comments = await this.populateReplies(comments);
            } else {
                // Filter out replies (comments with parentId) for top-level view
                comments = comments.filter(comment => !comment.parentId);
            }

            const response: PaginatedResponse<Comment> = {
                items: comments,
                hasMore: !!result.LastEvaluatedKey,
                nextToken: result.LastEvaluatedKey ?
                    Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") :
                    undefined
            };

            return this.successResponse(response);
        } catch (error) {
            this.logger.error("Error getting comments", { error, postId });
            throw error;
        }
    }

    private async createComment(postId: string, event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        if (!PermissionManager.hasPermission(user, Permission.CREATE_COMMENT)) {
            return this.forbiddenResponse("Insufficient permissions to create comments");
        }

        const body = this.parseJsonBody<CreateCommentRequest>(event);
        if (!body || !body.content?.trim()) {
            return this.badRequestResponse("Comment content is required");
        }

        // Verify the post exists and user can access it
        const postExists = await this.verifyPostAccess(postId, user);
        if (!postExists) {
            return this.notFoundResponse("Post not found or access denied");
        }

        // If this is a reply, verify the parent comment exists
        if (body.parentId) {
            const parentExists = await this.verifyCommentExists(postId, body.parentId);
            if (!parentExists) {
                return this.badRequestResponse("Parent comment not found");
            }
        }

        const commentId = uuidv4();
        const now = new Date().toISOString();

        const comment: Comment = {
            id: commentId,
            postId,
            userId: user.id,
            parentId: body.parentId,
            content: body.content.trim(),
            likes: 0,
            likedBy: [],
            replyCount: 0,
            createdAt: now,
            updatedAt: now
        };

        try {
            // Store comment in DynamoDB
            await this.dynamoClient.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    PK: `POST#${postId}`,
                    SK: `COMMENT#${commentId}`,
                    GSI1PK: `USER#${user.id}`,
                    GSI1SK: now,
                    GSI2PK: body.parentId ? `COMMENT#${body.parentId}` : `POST#${postId}`,
                    GSI2SK: now,
                    entityType: "COMMENT",
                    ...comment
                }
            }));

            // Update post comment count
            await this.updatePostCommentCount(postId, 1);

            // If this is a reply, update parent comment reply count
            if (body.parentId) {
                await this.updateCommentReplyCount(postId, body.parentId, 1);
            }

            // Send WebSocket notification
            await this.sendWebSocketMessage("comment.added", {
                comment: { ...comment, user: { id: user.id, username: user.username } },
                postId
            });

            return this.successResponse(comment, "Comment created successfully");
        } catch (error) {
            this.logger.error("Error creating comment", { error, comment });
            throw error;
        }
    }

    private async updateComment(commentId: string, event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        const body = this.parseJsonBody<{ content: string }>(event);
        if (!body || !body.content?.trim()) {
            return this.badRequestResponse("Comment content is required");
        }

        try {
            // Get existing comment
            const existingComment = await this.getCommentById(commentId);
            if (!existingComment) {
                return this.notFoundResponse("Comment not found");
            }

            // Check permissions
            if (!PermissionManager.canUpdateComment(user, existingComment.userId)) {
                return this.forbiddenResponse("Insufficient permissions to update this comment");
            }

            const now = new Date().toISOString();

            await this.dynamoClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: {
                    PK: `POST#${existingComment.postId}`,
                    SK: `COMMENT#${commentId}`
                },
                UpdateExpression: "SET #content = :content, updatedAt = :updatedAt",
                ExpressionAttributeNames: {
                    "#content": "content"
                },
                ExpressionAttributeValues: {
                    ":content": body.content.trim(),
                    ":updatedAt": now
                }
            }));

            // Get updated comment
            const updatedComment = await this.getCommentById(commentId);

            // Send WebSocket notification
            await this.sendWebSocketMessage("comment.updated", {
                comment: { ...updatedComment, user: { id: user.id, username: user.username } }
            });

            return this.successResponse(updatedComment, "Comment updated successfully");
        } catch (error) {
            this.logger.error("Error updating comment", { error, commentId });
            throw error;
        }
    }

    private async deleteComment(commentId: string, user: AuthUser): Promise<ApiResponse> {
        try {
            // Get existing comment
            const existingComment = await this.getCommentById(commentId);
            if (!existingComment) {
                return this.notFoundResponse("Comment not found");
            }

            // Check permissions
            if (!PermissionManager.canDeleteComment(user, existingComment.userId)) {
                return this.forbiddenResponse("Insufficient permissions to delete this comment");
            }

            // Delete comment
            await this.dynamoClient.send(new DeleteCommand({
                TableName: this.tableName,
                Key: {
                    PK: `POST#${existingComment.postId}`,
                    SK: `COMMENT#${commentId}`
                }
            }));

            // Update post comment count
            await this.updatePostCommentCount(existingComment.postId, -1);

            // If this was a reply, update parent comment reply count
            if (existingComment.parentId) {
                await this.updateCommentReplyCount(existingComment.postId, existingComment.parentId, -1);
            }

            // Send WebSocket notification
            await this.sendWebSocketMessage("comment.deleted", {
                commentId,
                postId: existingComment.postId,
                userId: existingComment.userId
            });

            return this.successResponse(null, "Comment deleted successfully");
        } catch (error) {
            this.logger.error("Error deleting comment", { error, commentId });
            throw error;
        }
    }

    private async getCommentById(commentId: string): Promise<Comment | null> {
        try {
            // We need to scan since we don't know the postId
            const result = await this.dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: "GSI1",
                KeyConditionExpression: "GSI1PK = :pk",
                FilterExpression: "id = :commentId AND entityType = :entityType",
                ExpressionAttributeValues: {
                    ":pk": "COMMENT#ALL", // You might need to adjust this based on your GSI design
                    ":commentId": commentId,
                    ":entityType": "COMMENT"
                }
            }));

            if (!result.Items || result.Items.length === 0) {
                return null;
            }

            return this.mapDynamoItemToComment(result.Items[0]);
        } catch (error) {
            this.logger.error("Error getting comment by ID", { error, commentId });
            throw error;
        }
    }

    private async verifyPostAccess(postId: string, user: AuthUser): Promise<boolean> {
        try {
            const result = await this.dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: "PK = :pk AND SK = :sk",
                ExpressionAttributeValues: {
                    ":pk": `POST#${postId}`,
                    ":sk": `POST#${postId}`
                }
            }));

            if (!result.Items || result.Items.length === 0) {
                return false;
            }

            const post = result.Items[0];

            // Check if user can access this post
            return post.isPublic ||
             post.userId === user.id ||
             PermissionManager.hasPermission(user, Permission.MODERATE_CONTENT);
        } catch (error) {
            this.logger.error("Error verifying post access", { error, postId });
            return false;
        }
    }

    private async verifyCommentExists(postId: string, commentId: string): Promise<boolean> {
        try {
            const result = await this.dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: "PK = :pk AND SK = :sk",
                ExpressionAttributeValues: {
                    ":pk": `POST#${postId}`,
                    ":sk": `COMMENT#${commentId}`
                }
            }));

            return result.Items && result.Items.length > 0;
        } catch (error) {
            this.logger.error("Error verifying comment exists", { error, postId, commentId });
            return false;
        }
    }

    private async populateReplies(comments: Comment[]): Promise<Comment[]> {
    // Group comments by parentId
        const commentMap = new Map<string, Comment>();
        const topLevelComments: Comment[] = [];
        const replies: Comment[] = [];

        comments.forEach(comment => {
            commentMap.set(comment.id, { ...comment, replies: [] });
            if (comment.parentId) {
                replies.push(comment);
            } else {
                topLevelComments.push(comment);
            }
        });

        // Attach replies to their parent comments
        replies.forEach(reply => {
            const parent = commentMap.get(reply.parentId!);
            if (parent) {
                parent.replies = parent.replies || [];
                parent.replies.push(reply);
            }
        });

        return topLevelComments.map(comment => commentMap.get(comment.id)!);
    }

    private async updatePostCommentCount(postId: string, increment: number): Promise<void> {
        try {
            await this.dynamoClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: {
                    PK: `POST#${postId}`,
                    SK: `POST#${postId}`
                },
                UpdateExpression: "ADD commentCount :increment",
                ExpressionAttributeValues: {
                    ":increment": increment
                }
            }));
        } catch (error) {
            this.logger.error("Error updating post comment count", { error, postId, increment });
        }
    }

    private async updateCommentReplyCount(postId: string, commentId: string, increment: number): Promise<void> {
        try {
            await this.dynamoClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: {
                    PK: `POST#${postId}`,
                    SK: `COMMENT#${commentId}`
                },
                UpdateExpression: "ADD replyCount :increment",
                ExpressionAttributeValues: {
                    ":increment": increment
                }
            }));
        } catch (error) {
            this.logger.error("Error updating comment reply count", { error, postId, commentId, increment });
        }
    }

    private mapDynamoItemToComment(item: any): Comment {
        return {
            id: item.id,
            postId: item.postId,
            userId: item.userId,
            parentId: item.parentId,
            content: item.content,
            likes: item.likes || 0,
            likedBy: item.likedBy || [],
            replyCount: item.replyCount || 0,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        };
    }

    private async sendWebSocketMessage(type: string, data: any): Promise<void> {
    // Implementation would send message to WebSocket API
        this.logger.info("WebSocket message sent", { type, data });
    }
}

export const handler = new CommentsLambda().handler.bind(new CommentsLambda());
