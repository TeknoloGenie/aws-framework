import { RestApiLambda, ApiResponse } from "aws-framework";
import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Post, CreatePostRequest, AuthUser, Permission, PaginatedResponse } from "../types";
import { PermissionManager } from "../utils/permissions";

export class PostsLambda extends RestApiLambda {
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
                if (pathParameters.id) {
                    return await this.getPost(pathParameters.id, user);
                }
                return await this.getPosts(event, user);

            case "POST":
                return await this.createPost(event, user);

            case "PUT":
                if (!pathParameters.id) {
                    return this.badRequestResponse("Post ID is required");
                }
                return await this.updatePost(pathParameters.id, event, user);

            case "DELETE":
                if (!pathParameters.id) {
                    return this.badRequestResponse("Post ID is required");
                }
                return await this.deletePost(pathParameters.id, user);

            default:
                return this.methodNotAllowedResponse();
            }
        } catch (error) {
            this.logger.error("Error processing posts request", { error, event });
            return this.internalServerErrorResponse("Failed to process request");
        }
    }

    private async getPosts(event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        const limit = parseInt(this.getQueryParameter(event, "limit") || "20");
        const nextToken = this.getQueryParameter(event, "nextToken");
        const userId = this.getQueryParameter(event, "userId"); // Filter by specific user

        try {
            const queryParams: any = {
                TableName: this.tableName,
                IndexName: "GSI1",
                KeyConditionExpression: "GSI1PK = :pk",
                ExpressionAttributeValues: {
                    ":pk": userId ? `USER#${userId}` : "POST#FEED",
                    ":entityType": "POST"
                },
                FilterExpression: "entityType = :entityType",
                Limit: limit,
                ScanIndexForward: false // Most recent first
            };

            if (nextToken) {
                queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString());
            }

            const result = await this.dynamoClient.send(new QueryCommand(queryParams));

            const posts = await Promise.all(
                (result.Items || []).map(item => this.mapDynamoItemToPost(item))
            );

            // Filter posts based on privacy settings and user permissions
            const filteredPosts = posts.filter(post =>
                post.isPublic ||
        post.userId === user.id ||
        PermissionManager.hasPermission(user, Permission.MODERATE_CONTENT)
            );

            const response: PaginatedResponse<Post> = {
                items: filteredPosts,
                hasMore: !!result.LastEvaluatedKey,
                nextToken: result.LastEvaluatedKey ?
                    Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") :
                    undefined
            };

            return this.successResponse(response);
        } catch (error) {
            this.logger.error("Error getting posts", { error, userId });
            throw error;
        }
    }

    private async getPost(postId: string, user: AuthUser): Promise<ApiResponse> {
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
                return this.notFoundResponse("Post not found");
            }

            const post = this.mapDynamoItemToPost(result.Items[0]);

            // Check if user can view this post
            if (!post.isPublic && post.userId !== user.id &&
          !PermissionManager.hasPermission(user, Permission.MODERATE_CONTENT)) {
                return this.forbiddenResponse("Access denied");
            }

            return this.successResponse(post);
        } catch (error) {
            this.logger.error("Error getting post", { error, postId });
            throw error;
        }
    }

    private async createPost(event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        if (!PermissionManager.hasPermission(user, Permission.CREATE_POST)) {
            return this.forbiddenResponse("Insufficient permissions to create posts");
        }

        const body = this.parseJsonBody<CreatePostRequest>(event);
        if (!body || !body.content?.trim()) {
            return this.badRequestResponse("Post content is required");
        }

        const postId = uuidv4();
        const now = new Date().toISOString();

        const post: Post = {
            id: postId,
            userId: user.id,
            content: body.content.trim(),
            mediaUrls: body.mediaUrls || [],
            mediaType: body.mediaType,
            likes: 0,
            likedBy: [],
            commentCount: 0,
            isPublic: body.isPublic !== false, // Default to public
            createdAt: now,
            updatedAt: now
        };

        try {
            // Store post in DynamoDB
            await this.dynamoClient.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    PK: `POST#${postId}`,
                    SK: `POST#${postId}`,
                    GSI1PK: `USER#${user.id}`,
                    GSI1SK: now,
                    GSI2PK: "POST#FEED",
                    GSI2SK: now,
                    entityType: "POST",
                    ...post
                }
            }));

            // Send WebSocket notification for new post
            await this.sendWebSocketMessage("post.created", {
                post: { ...post, user: { id: user.id, username: user.username } }
            });

            return this.successResponse(post, "Post created successfully");
        } catch (error) {
            this.logger.error("Error creating post", { error, post });
            throw error;
        }
    }

    private async updatePost(postId: string, event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        const body = this.parseJsonBody<Partial<CreatePostRequest>>(event);
        if (!body) {
            return this.badRequestResponse("Invalid request body");
        }

        try {
            // Get existing post
            const existingPost = await this.getPostById(postId);
            if (!existingPost) {
                return this.notFoundResponse("Post not found");
            }

            // Check permissions
            if (!PermissionManager.canUpdatePost(user, existingPost.userId)) {
                return this.forbiddenResponse("Insufficient permissions to update this post");
            }

            const now = new Date().toISOString();
            const updateExpression: string[] = [];
            const expressionAttributeValues: any = {};
            const expressionAttributeNames: any = {};

            if (body.content !== undefined) {
                updateExpression.push("#content = :content");
                expressionAttributeNames["#content"] = "content";
                expressionAttributeValues[":content"] = body.content.trim();
            }

            if (body.mediaUrls !== undefined) {
                updateExpression.push("mediaUrls = :mediaUrls");
                expressionAttributeValues[":mediaUrls"] = body.mediaUrls;
            }

            if (body.mediaType !== undefined) {
                updateExpression.push("mediaType = :mediaType");
                expressionAttributeValues[":mediaType"] = body.mediaType;
            }

            if (body.isPublic !== undefined) {
                updateExpression.push("isPublic = :isPublic");
                expressionAttributeValues[":isPublic"] = body.isPublic;
            }

            updateExpression.push("updatedAt = :updatedAt");
            expressionAttributeValues[":updatedAt"] = now;

            await this.dynamoClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: {
                    PK: `POST#${postId}`,
                    SK: `POST#${postId}`
                },
                UpdateExpression: `SET ${updateExpression.join(", ")}`,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
            }));

            // Get updated post
            const updatedPost = await this.getPostById(postId);

            // Send WebSocket notification
            await this.sendWebSocketMessage("post.updated", {
                post: { ...updatedPost, user: { id: user.id, username: user.username } }
            });

            return this.successResponse(updatedPost, "Post updated successfully");
        } catch (error) {
            this.logger.error("Error updating post", { error, postId });
            throw error;
        }
    }

    private async deletePost(postId: string, user: AuthUser): Promise<ApiResponse> {
        try {
            // Get existing post
            const existingPost = await this.getPostById(postId);
            if (!existingPost) {
                return this.notFoundResponse("Post not found");
            }

            // Check permissions
            if (!PermissionManager.canDeletePost(user, existingPost.userId)) {
                return this.forbiddenResponse("Insufficient permissions to delete this post");
            }

            // Delete post
            await this.dynamoClient.send(new DeleteCommand({
                TableName: this.tableName,
                Key: {
                    PK: `POST#${postId}`,
                    SK: `POST#${postId}`
                }
            }));

            // Send WebSocket notification
            await this.sendWebSocketMessage("post.deleted", {
                postId,
                userId: existingPost.userId
            });

            return this.successResponse(null, "Post deleted successfully");
        } catch (error) {
            this.logger.error("Error deleting post", { error, postId });
            throw error;
        }
    }

    private async getPostById(postId: string): Promise<Post | null> {
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
                return null;
            }

            return this.mapDynamoItemToPost(result.Items[0]);
        } catch (error) {
            this.logger.error("Error getting post by ID", { error, postId });
            throw error;
        }
    }

    private mapDynamoItemToPost(item: any): Post {
        return {
            id: item.id,
            userId: item.userId,
            content: item.content,
            mediaUrls: item.mediaUrls || [],
            mediaType: item.mediaType,
            likes: item.likes || 0,
            likedBy: item.likedBy || [],
            commentCount: item.commentCount || 0,
            isPublic: item.isPublic !== false,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        };
    }

    private async sendWebSocketMessage(type: string, data: any): Promise<void> {
    // Implementation would send message to WebSocket API
    // This would integrate with your WebSocket Lambda handler
        this.logger.info("WebSocket message sent", { type, data });
    }
}

export const handler = new PostsLambda().handler.bind(new PostsLambda());
