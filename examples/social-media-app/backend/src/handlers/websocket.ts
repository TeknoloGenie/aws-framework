import { WebSocketApiLambda } from 'aws-framework';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { WebSocketMessage, WebSocketMessageType, AuthUser, UserRole } from '../types';
import { PermissionManager } from '../utils/permissions';

interface ConnectionInfo {
  connectionId: string;
  userId: string;
  username: string;
  role: UserRole;
  connectedAt: string;
  lastSeen: string;
  subscriptions: string[]; // Chat IDs or other entity subscriptions
}

export class WebSocketLambda extends WebSocketApiLambda {
  private dynamoClient: DynamoDBDocumentClient;
  private apiGatewayClient: ApiGatewayManagementApiClient;
  private tableName: string;
  private connectionsTableName: string;

  constructor() {
    super();
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.DYNAMODB_TABLE_NAME!;
    this.connectionsTableName = process.env.CONNECTIONS_TABLE_NAME!;
    
    this.apiGatewayClient = new ApiGatewayManagementApiClient({
      region: process.env.AWS_REGION,
      endpoint: process.env.WEBSOCKET_API_ENDPOINT
    });
  }

  protected async handleConnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId!;
    
    try {
      // Extract user info from query parameters or headers
      const token = event.queryStringParameters?.token;
      if (!token) {
        return { statusCode: 401, body: 'Authentication token required' };
      }

      const user = await this.validateToken(token);
      if (!user) {
        return { statusCode: 401, body: 'Invalid authentication token' };
      }

      // Check if user can connect to WebSocket
      if (!PermissionManager.canConnectToWebSocket(user)) {
        return { statusCode: 403, body: 'Insufficient permissions' };
      }

      const now = new Date().toISOString();
      const connectionInfo: ConnectionInfo = {
        connectionId,
        userId: user.id,
        username: user.username,
        role: user.role,
        connectedAt: now,
        lastSeen: now,
        subscriptions: []
      };

      // Store connection info
      await this.dynamoClient.send(new PutCommand({
        TableName: this.connectionsTableName,
        Item: {
          PK: `CONNECTION#${connectionId}`,
          SK: `CONNECTION#${connectionId}`,
          GSI1PK: `USER#${user.id}`,
          GSI1SK: now,
          entityType: 'CONNECTION',
          ...connectionInfo
        }
      }));

      // Update user online status
      await this.updateUserOnlineStatus(user.id, true);

      // Notify other users that this user is online
      await this.broadcastUserStatusChange(user.id, user.username, true);

      this.logger.info('WebSocket connection established', { connectionId, userId: user.id });
      return { statusCode: 200, body: 'Connected' };

    } catch (error) {
      this.logger.error('Error handling WebSocket connect', { error, connectionId });
      return { statusCode: 500, body: 'Internal server error' };
    }
  }

  protected async handleDisconnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId!;

    try {
      // Get connection info
      const connectionInfo = await this.getConnectionInfo(connectionId);
      
      if (connectionInfo) {
        // Remove connection
        await this.dynamoClient.send(new DeleteCommand({
          TableName: this.connectionsTableName,
          Key: {
            PK: `CONNECTION#${connectionId}`,
            SK: `CONNECTION#${connectionId}`
          }
        }));

        // Update user online status (check if user has other connections)
        const hasOtherConnections = await this.userHasOtherConnections(connectionInfo.userId, connectionId);
        if (!hasOtherConnections) {
          await this.updateUserOnlineStatus(connectionInfo.userId, false);
          await this.broadcastUserStatusChange(connectionInfo.userId, connectionInfo.username, false);
        }

        this.logger.info('WebSocket connection closed', { connectionId, userId: connectionInfo.userId });
      }

      return { statusCode: 200, body: 'Disconnected' };

    } catch (error) {
      this.logger.error('Error handling WebSocket disconnect', { error, connectionId });
      return { statusCode: 500, body: 'Internal server error' };
    }
  }

  protected async handleMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId!;

    try {
      const connectionInfo = await this.getConnectionInfo(connectionId);
      if (!connectionInfo) {
        return { statusCode: 404, body: 'Connection not found' };
      }

      const message = JSON.parse(event.body || '{}') as WebSocketMessage;
      
      // Update last seen
      await this.updateConnectionLastSeen(connectionId);

      // Handle different message types
      switch (message.type) {
        case WebSocketMessageType.USER_TYPING:
          return await this.handleTypingMessage(connectionInfo, message);
          
        case WebSocketMessageType.MESSAGE_READ:
          return await this.handleMessageRead(connectionInfo, message);
          
        default:
          this.logger.warn('Unknown WebSocket message type', { type: message.type, connectionId });
          return { statusCode: 400, body: 'Unknown message type' };
      }

    } catch (error) {
      this.logger.error('Error handling WebSocket message', { error, connectionId });
      return { statusCode: 500, body: 'Internal server error' };
    }
  }

  private async handleTypingMessage(connectionInfo: ConnectionInfo, message: WebSocketMessage): Promise<APIGatewayProxyResult> {
    const { chatId, isTyping } = message.data;

    if (!chatId) {
      return { statusCode: 400, body: 'Chat ID required for typing message' };
    }

    // Verify user has access to the chat
    const hasAccess = await this.verifyUserChatAccess(chatId, connectionInfo.userId);
    if (!hasAccess) {
      return { statusCode: 403, body: 'Access denied' };
    }

    // Get chat participants
    const chat = await this.getChatById(chatId);
    if (!chat) {
      return { statusCode: 404, body: 'Chat not found' };
    }

    // Broadcast typing status to other participants
    const typingMessage: WebSocketMessage = {
      type: WebSocketMessageType.USER_TYPING,
      data: {
        chatId,
        userId: connectionInfo.userId,
        username: connectionInfo.username,
        isTyping
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToChatParticipants(chat.participants, typingMessage, connectionInfo.userId);

    return { statusCode: 200, body: 'Typing status sent' };
  }

  private async handleMessageRead(connectionInfo: ConnectionInfo, message: WebSocketMessage): Promise<APIGatewayProxyResult> {
    const { messageId, chatId } = message.data;

    if (!messageId || !chatId) {
      return { statusCode: 400, body: 'Message ID and Chat ID required' };
    }

    // Verify user has access to the chat
    const hasAccess = await this.verifyUserChatAccess(chatId, connectionInfo.userId);
    if (!hasAccess) {
      return { statusCode: 403, body: 'Access denied' };
    }

    try {
      // Update message read status
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `CHAT#${chatId}`,
          SK: `MESSAGE#${messageId}`
        },
        UpdateExpression: 'ADD readBy :userId',
        ExpressionAttributeValues: {
          ':userId': new Set([connectionInfo.userId])
        }
      }));

      // Get chat participants
      const chat = await this.getChatById(chatId);
      if (chat) {
        // Broadcast read receipt to other participants
        const readMessage: WebSocketMessage = {
          type: WebSocketMessageType.MESSAGE_READ,
          data: {
            messageId,
            chatId,
            userId: connectionInfo.userId,
            username: connectionInfo.username
          },
          timestamp: new Date().toISOString()
        };

        await this.broadcastToChatParticipants(chat.participants, readMessage, connectionInfo.userId);
      }

      return { statusCode: 200, body: 'Message read status updated' };

    } catch (error) {
      this.logger.error('Error updating message read status', { error, messageId, chatId });
      return { statusCode: 500, body: 'Failed to update read status' };
    }
  }

  // Public method to send messages from other Lambda functions
  public async sendMessageToConnection(connectionId: string, message: WebSocketMessage): Promise<void> {
    try {
      await this.apiGatewayClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(message)
      }));
    } catch (error: any) {
      if (error.statusCode === 410) {
        // Connection is stale, remove it
        await this.removeStaleConnection(connectionId);
      } else {
        this.logger.error('Error sending WebSocket message', { error, connectionId });
        throw error;
      }
    }
  }

  public async broadcastToUser(userId: string, message: WebSocketMessage): Promise<void> {
    const connections = await this.getUserConnections(userId);
    
    const promises = connections.map(connection => 
      this.sendMessageToConnection(connection.connectionId, message)
    );

    await Promise.allSettled(promises);
  }

  public async broadcastToChatParticipants(
    participants: string[], 
    message: WebSocketMessage, 
    excludeUserId?: string
  ): Promise<void> {
    const targetParticipants = excludeUserId 
      ? participants.filter(id => id !== excludeUserId)
      : participants;

    const promises = targetParticipants.map(userId => 
      this.broadcastToUser(userId, message)
    );

    await Promise.allSettled(promises);
  }

  private async getConnectionInfo(connectionId: string): Promise<ConnectionInfo | null> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.connectionsTableName,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `CONNECTION#${connectionId}`,
          ':sk': `CONNECTION#${connectionId}`
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return result.Items[0] as ConnectionInfo;
    } catch (error) {
      this.logger.error('Error getting connection info', { error, connectionId });
      return null;
    }
  }

  private async getUserConnections(userId: string): Promise<ConnectionInfo[]> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.connectionsTableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`
        }
      }));

      return (result.Items || []) as ConnectionInfo[];
    } catch (error) {
      this.logger.error('Error getting user connections', { error, userId });
      return [];
    }
  }

  private async userHasOtherConnections(userId: string, excludeConnectionId: string): Promise<boolean> {
    const connections = await this.getUserConnections(userId);
    return connections.some(conn => conn.connectionId !== excludeConnectionId);
  }

  private async updateConnectionLastSeen(connectionId: string): Promise<void> {
    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.connectionsTableName,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: `CONNECTION#${connectionId}`
        },
        UpdateExpression: 'SET lastSeen = :lastSeen',
        ExpressionAttributeValues: {
          ':lastSeen': new Date().toISOString()
        }
      }));
    } catch (error) {
      this.logger.error('Error updating connection last seen', { error, connectionId });
    }
  }

  private async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `USER#${userId}`
        },
        UpdateExpression: 'SET isOnline = :isOnline, lastSeen = :lastSeen',
        ExpressionAttributeValues: {
          ':isOnline': isOnline,
          ':lastSeen': new Date().toISOString()
        }
      }));
    } catch (error) {
      this.logger.error('Error updating user online status', { error, userId, isOnline });
    }
  }

  private async broadcastUserStatusChange(userId: string, username: string, isOnline: boolean): Promise<void> {
    const statusMessage: WebSocketMessage = {
      type: isOnline ? WebSocketMessageType.USER_ONLINE : WebSocketMessageType.USER_OFFLINE,
      data: {
        userId,
        username,
        isOnline,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connected users (you might want to optimize this)
    // In a real implementation, you'd maintain friend/contact lists
    this.logger.info('Broadcasting user status change', { userId, username, isOnline });
  }

  private async removeStaleConnection(connectionId: string): Promise<void> {
    try {
      await this.dynamoClient.send(new DeleteCommand({
        TableName: this.connectionsTableName,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: `CONNECTION#${connectionId}`
        }
      }));
    } catch (error) {
      this.logger.error('Error removing stale connection', { error, connectionId });
    }
  }

  private async verifyUserChatAccess(chatId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `CHAT#${chatId}`
        }
      }));

      return result.Items && result.Items.length > 0;
    } catch (error) {
      this.logger.error('Error verifying user chat access', { error, chatId, userId });
      return false;
    }
  }

  private async getChatById(chatId: string): Promise<any> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `CHAT#${chatId}`,
          ':sk': `CHAT#${chatId}`
        }
      }));

      return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
      this.logger.error('Error getting chat by ID', { error, chatId });
      return null;
    }
  }

  private async validateToken(token: string): Promise<AuthUser | null> {
    // Implementation would validate JWT token and return user info
    // This is a placeholder - implement actual JWT validation
    try {
      // Decode and validate JWT token
      // Return user information
      return null; // Placeholder
    } catch (error) {
      this.logger.error('Error validating token', { error });
      return null;
    }
  }
}

export const handler = new WebSocketLambda().handler.bind(new WebSocketLambda());
