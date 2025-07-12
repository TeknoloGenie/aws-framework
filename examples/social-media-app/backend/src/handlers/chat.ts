import { RestApiLambda, ApiResponse } from "aws-framework";
import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Chat, Message, CreateChatRequest, SendMessageRequest, AuthUser, Permission, ChatType, MessageType, PaginatedResponse } from "../types";
import { PermissionManager } from "../utils/permissions";

export class ChatLambda extends RestApiLambda {
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
        const path = event.path;

        try {
            // Chat management endpoints
            if (path.includes("/chats") && !path.includes("/messages")) {
                switch (method) {
                case "GET":
                    if (pathParameters.id) {
                        return await this.getChat(pathParameters.id, user);
                    }
                    return await this.getUserChats(event, user);

                case "POST":
                    return await this.createChat(event, user);

                case "PUT":
                    if (!pathParameters.id) {
                        return this.badRequestResponse("Chat ID is required");
                    }
                    return await this.updateChat(pathParameters.id, event, user);

                case "DELETE":
                    if (!pathParameters.id) {
                        return this.badRequestResponse("Chat ID is required");
                    }
                    return await this.deleteChat(pathParameters.id, user);

                default:
                    return this.methodNotAllowedResponse();
                }
            }

            // Message endpoints
            if (path.includes("/messages")) {
                switch (method) {
                case "GET":
                    if (!pathParameters.chatId) {
                        return this.badRequestResponse("Chat ID is required");
                    }
                    return await this.getMessages(pathParameters.chatId, event, user);

                case "POST":
                    if (!pathParameters.chatId) {
                        return this.badRequestResponse("Chat ID is required");
                    }
                    return await this.sendMessage(pathParameters.chatId, event, user);

                case "PUT":
                    if (!pathParameters.id) {
                        return this.badRequestResponse("Message ID is required");
                    }
                    return await this.updateMessage(pathParameters.id, event, user);

                case "DELETE":
                    if (!pathParameters.id) {
                        return this.badRequestResponse("Message ID is required");
                    }
                    return await this.deleteMessage(pathParameters.id, user);

                default:
                    return this.methodNotAllowedResponse();
                }
            }

            return this.badRequestResponse("Invalid endpoint");
        } catch (error) {
            this.logger.error("Error processing chat request", { error, event });
            return this.internalServerErrorResponse("Failed to process request");
        }
    }

    private async getUserChats(event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        const limit = parseInt(this.getQueryParameter(event, "limit") || "20");
        const nextToken = this.getQueryParameter(event, "nextToken");

        try {
            const queryParams: any = {
                TableName: this.tableName,
                IndexName: "GSI1",
                KeyConditionExpression: "GSI1PK = :pk",
                ExpressionAttributeValues: {
                    ":pk": `USER#${user.id}#CHATS`,
                    ":entityType": "CHAT"
                },
                FilterExpression: "entityType = :entityType",
                Limit: limit,
                ScanIndexForward: false // Most recent activity first
            };

            if (nextToken) {
                queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString());
            }

            const result = await this.dynamoClient.send(new QueryCommand(queryParams));

            const chats = (result.Items || []).map(item => this.mapDynamoItemToChat(item));

            const response: PaginatedResponse<Chat> = {
                items: chats,
                hasMore: !!result.LastEvaluatedKey,
                nextToken: result.LastEvaluatedKey ?
                    Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") :
                    undefined
            };

            return this.successResponse(response);
        } catch (error) {
            this.logger.error("Error getting user chats", { error, userId: user.id });
            throw error;
        }
    }

    private async getChat(chatId: string, user: AuthUser): Promise<ApiResponse> {
        try {
            const result = await this.dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: "PK = :pk AND SK = :sk",
                ExpressionAttributeValues: {
                    ":pk": `CHAT#${chatId}`,
                    ":sk": `CHAT#${chatId}`
                }
            }));

            if (!result.Items || result.Items.length === 0) {
                return this.notFoundResponse("Chat not found");
            }

            const chat = this.mapDynamoItemToChat(result.Items[0]);

            // Check if user is participant
            if (!chat.participants.includes(user.id)) {
                return this.forbiddenResponse("Access denied");
            }

            return this.successResponse(chat);
        } catch (error) {
            this.logger.error("Error getting chat", { error, chatId });
            throw error;
        }
    }

    private async createChat(event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        if (!PermissionManager.hasPermission(user, Permission.CREATE_CHAT)) {
            return this.forbiddenResponse("Insufficient permissions to create chats");
        }

        const body = this.parseJsonBody<CreateChatRequest>(event);
        if (!body || !body.participants || body.participants.length === 0) {
            return this.badRequestResponse("Participants are required");
        }

        // Validate chat type and participants
        if (body.type === ChatType.DIRECT && body.participants.length !== 1) {
            return this.badRequestResponse("Direct chats must have exactly one other participant");
        }

        if (body.type === ChatType.GROUP && body.participants.length < 2) {
            return this.badRequestResponse("Group chats must have at least 2 participants");
        }

        const chatId = uuidv4();
        const now = new Date().toISOString();

        // Add the creator to participants if not already included
        const allParticipants = Array.from(new Set([user.id, ...body.participants]));

        const chat: Chat = {
            id: chatId,
            type: body.type,
            name: body.name,
            description: body.description,
            participants: allParticipants,
            admins: body.type === ChatType.GROUP ? [user.id] : [],
            lastActivity: now,
            createdAt: now,
            updatedAt: now
        };

        try {
            // Store chat in DynamoDB
            await this.dynamoClient.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    PK: `CHAT#${chatId}`,
                    SK: `CHAT#${chatId}`,
                    GSI1PK: `CHAT#${chatId}`,
                    GSI1SK: now,
                    entityType: "CHAT",
                    ...chat
                }
            }));

            // Create participant entries for each user
            const participantPromises = allParticipants.map(participantId =>
                this.dynamoClient.send(new PutCommand({
                    TableName: this.tableName,
                    Item: {
                        PK: `USER#${participantId}`,
                        SK: `CHAT#${chatId}`,
                        GSI1PK: `USER#${participantId}#CHATS`,
                        GSI1SK: now,
                        entityType: "USER_CHAT",
                        chatId,
                        userId: participantId,
                        joinedAt: now
                    }
                }))
            );

            await Promise.all(participantPromises);

            // Send system message for group chat creation
            if (body.type === ChatType.GROUP) {
                await this.createSystemMessage(chatId, `${user.username} created the group`, user.id);
            }

            return this.successResponse(chat, "Chat created successfully");
        } catch (error) {
            this.logger.error("Error creating chat", { error, chat });
            throw error;
        }
    }

    private async getMessages(chatId: string, event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
    // Verify user is participant
        const hasAccess = await this.verifyUserChatAccess(chatId, user.id);
        if (!hasAccess) {
            return this.forbiddenResponse("Access denied");
        }

        const limit = parseInt(this.getQueryParameter(event, "limit") || "50");
        const nextToken = this.getQueryParameter(event, "nextToken");

        try {
            const queryParams: any = {
                TableName: this.tableName,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
                ExpressionAttributeValues: {
                    ":pk": `CHAT#${chatId}`,
                    ":sk": "MESSAGE#",
                    ":entityType": "MESSAGE"
                },
                FilterExpression: "entityType = :entityType",
                Limit: limit,
                ScanIndexForward: false // Most recent first
            };

            if (nextToken) {
                queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString());
            }

            const result = await this.dynamoClient.send(new QueryCommand(queryParams));

            const messages = (result.Items || []).map(item => this.mapDynamoItemToMessage(item));

            const response: PaginatedResponse<Message> = {
                items: messages,
                hasMore: !!result.LastEvaluatedKey,
                nextToken: result.LastEvaluatedKey ?
                    Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") :
                    undefined
            };

            return this.successResponse(response);
        } catch (error) {
            this.logger.error("Error getting messages", { error, chatId });
            throw error;
        }
    }

    private async sendMessage(chatId: string, event: APIGatewayProxyEvent, user: AuthUser): Promise<ApiResponse> {
        if (!PermissionManager.hasPermission(user, Permission.SEND_MESSAGE)) {
            return this.forbiddenResponse("Insufficient permissions to send messages");
        }

        // Verify user is participant
        const hasAccess = await this.verifyUserChatAccess(chatId, user.id);
        if (!hasAccess) {
            return this.forbiddenResponse("Access denied");
        }

        const body = this.parseJsonBody<SendMessageRequest>(event);
        if (!body || !body.content?.trim()) {
            return this.badRequestResponse("Message content is required");
        }

        const messageId = uuidv4();
        const now = new Date().toISOString();

        const message: Message = {
            id: messageId,
            chatId,
            userId: user.id,
            content: body.content.trim(),
            messageType: body.messageType || MessageType.TEXT,
            mediaUrl: body.mediaUrl,
            replyToId: body.replyToId,
            readBy: [user.id], // Sender has read the message
            createdAt: now,
            updatedAt: now
        };

        try {
            // Store message in DynamoDB
            await this.dynamoClient.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    PK: `CHAT#${chatId}`,
                    SK: `MESSAGE#${messageId}`,
                    GSI1PK: `USER#${user.id}`,
                    GSI1SK: now,
                    GSI2PK: `CHAT#${chatId}#MESSAGES`,
                    GSI2SK: now,
                    entityType: "MESSAGE",
                    ...message
                }
            }));

            // Update chat's last activity and last message
            await this.updateChatLastActivity(chatId, message);

            // Send WebSocket notification to all participants
            const chat = await this.getChatById(chatId);
            if (chat) {
                await this.sendWebSocketMessage("message.sent", {
                    message: { ...message, user: { id: user.id, username: user.username } },
                    chatId
                }, chat.participants);
            }

            return this.successResponse(message, "Message sent successfully");
        } catch (error) {
            this.logger.error("Error sending message", { error, message });
            throw error;
        }
    }

    private async deleteMessage(messageId: string, user: AuthUser): Promise<ApiResponse> {
        try {
            // Get existing message
            const existingMessage = await this.getMessageById(messageId);
            if (!existingMessage) {
                return this.notFoundResponse("Message not found");
            }

            // Check permissions
            if (!PermissionManager.canDeleteMessage(user, existingMessage.userId)) {
                return this.forbiddenResponse("Insufficient permissions to delete this message");
            }

            // Verify user has access to the chat
            const hasAccess = await this.verifyUserChatAccess(existingMessage.chatId, user.id);
            if (!hasAccess) {
                return this.forbiddenResponse("Access denied");
            }

            // Delete message
            await this.dynamoClient.send(new DeleteCommand({
                TableName: this.tableName,
                Key: {
                    PK: `CHAT#${existingMessage.chatId}`,
                    SK: `MESSAGE#${messageId}`
                }
            }));

            // Send WebSocket notification
            const chat = await this.getChatById(existingMessage.chatId);
            if (chat) {
                await this.sendWebSocketMessage("message.deleted", {
                    messageId,
                    chatId: existingMessage.chatId,
                    userId: existingMessage.userId
                }, chat.participants);
            }

            return this.successResponse(null, "Message deleted successfully");
        } catch (error) {
            this.logger.error("Error deleting message", { error, messageId });
            throw error;
        }
    }

    private async verifyUserChatAccess(chatId: string, userId: string): Promise<boolean> {
        try {
            const result = await this.dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: "PK = :pk AND SK = :sk",
                ExpressionAttributeValues: {
                    ":pk": `USER#${userId}`,
                    ":sk": `CHAT#${chatId}`
                }
            }));

            return result.Items && result.Items.length > 0;
        } catch (error) {
            this.logger.error("Error verifying user chat access", { error, chatId, userId });
            return false;
        }
    }

    private async getChatById(chatId: string): Promise<Chat | null> {
        try {
            const result = await this.dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: "PK = :pk AND SK = :sk",
                ExpressionAttributeValues: {
                    ":pk": `CHAT#${chatId}`,
                    ":sk": `CHAT#${chatId}`
                }
            }));

            if (!result.Items || result.Items.length === 0) {
                return null;
            }

            return this.mapDynamoItemToChat(result.Items[0]);
        } catch (error) {
            this.logger.error("Error getting chat by ID", { error, chatId });
            return null;
        }
    }

    private async getMessageById(messageId: string): Promise<Message | null> {
        try {
            // We need to scan since we don't know the chatId
            const result = await this.dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: "GSI1",
                KeyConditionExpression: "GSI1PK = :pk",
                FilterExpression: "id = :messageId AND entityType = :entityType",
                ExpressionAttributeValues: {
                    ":pk": "MESSAGE#ALL", // You might need to adjust this based on your GSI design
                    ":messageId": messageId,
                    ":entityType": "MESSAGE"
                }
            }));

            if (!result.Items || result.Items.length === 0) {
                return null;
            }

            return this.mapDynamoItemToMessage(result.Items[0]);
        } catch (error) {
            this.logger.error("Error getting message by ID", { error, messageId });
            return null;
        }
    }

    private async updateChatLastActivity(chatId: string, lastMessage: Message): Promise<void> {
        try {
            await this.dynamoClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: {
                    PK: `CHAT#${chatId}`,
                    SK: `CHAT#${chatId}`
                },
                UpdateExpression: "SET lastActivity = :lastActivity, lastMessage = :lastMessage",
                ExpressionAttributeValues: {
                    ":lastActivity": lastMessage.createdAt,
                    ":lastMessage": lastMessage
                }
            }));
        } catch (error) {
            this.logger.error("Error updating chat last activity", { error, chatId });
        }
    }

    private async createSystemMessage(chatId: string, content: string, userId: string): Promise<void> {
        const messageId = uuidv4();
        const now = new Date().toISOString();

        const systemMessage: Message = {
            id: messageId,
            chatId,
            userId,
            content,
            messageType: MessageType.SYSTEM,
            readBy: [],
            createdAt: now,
            updatedAt: now
        };

        try {
            await this.dynamoClient.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    PK: `CHAT#${chatId}`,
                    SK: `MESSAGE#${messageId}`,
                    GSI1PK: `SYSTEM#${userId}`,
                    GSI1SK: now,
                    GSI2PK: `CHAT#${chatId}#MESSAGES`,
                    GSI2SK: now,
                    entityType: "MESSAGE",
                    ...systemMessage
                }
            }));
        } catch (error) {
            this.logger.error("Error creating system message", { error, systemMessage });
        }
    }

    private mapDynamoItemToChat(item: any): Chat {
        return {
            id: item.id,
            type: item.type,
            name: item.name,
            description: item.description,
            participants: item.participants || [],
            admins: item.admins || [],
            lastMessage: item.lastMessage,
            lastActivity: item.lastActivity,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        };
    }

    private mapDynamoItemToMessage(item: any): Message {
        return {
            id: item.id,
            chatId: item.chatId,
            userId: item.userId,
            content: item.content,
            messageType: item.messageType,
            mediaUrl: item.mediaUrl,
            replyToId: item.replyToId,
            readBy: item.readBy || [],
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        };
    }

    private async sendWebSocketMessage(type: string, data: any, participants?: string[]): Promise<void> {
    // Implementation would send message to WebSocket API for specific participants
        this.logger.info("WebSocket message sent", { type, data, participants });
    }
}

export const handler = new ChatLambda().handler.bind(new ChatLambda());
