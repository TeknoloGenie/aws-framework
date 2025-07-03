import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BaseLambda } from "./base-lambda";

export interface WebSocketResponse {
  statusCode: number;
  body?: any;
}

export abstract class WebSocketLambda extends BaseLambda<APIGatewayProxyEvent, APIGatewayProxyResult> {
    protected apiGatewayClient?: ApiGatewayManagementApiClient;
    protected logger: logger;
    constructor() {
        super();

        // Initialize API Gateway Management client if endpoint is available
        if (process.env.WEBSOCKET_API_ENDPOINT) {
            this.apiGatewayClient = new ApiGatewayManagementApiClient({
                region: process.env.AWS_REGION,
                endpoint: process.env.WEBSOCKET_API_ENDPOINT
            });
        }
    }

    protected async process(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
        const routeKey = this.getRouteKey(event);

        try {
            let response: WebSocketResponse;

            switch (routeKey) {
            case "$connect":
                response = await this.handleConnect(event);
                break;
            case "$disconnect":
                response = await this.handleDisconnect(event);
                break;
            case "$default":
                response = await this.handleMessage(event);
                break;
            default:
                response = await this.handleCustomRoute(event, routeKey);
                break;
            }

            return {
                statusCode: response.statusCode,
                body: response.body ? JSON.stringify(response.body) : ""
            };
        } catch (error) {
            return await this.handleError(error);
        }
    }

  // Abstract methods for route handling
  protected abstract handleConnect(event: APIGatewayProxyEvent): Promise<WebSocketResponse>;
  protected abstract handleDisconnect(event: APIGatewayProxyEvent): Promise<WebSocketResponse>;
  protected abstract handleMessage(event: APIGatewayProxyEvent): Promise<WebSocketResponse>;

  // Optional custom route handler
  protected async handleCustomRoute(_event: APIGatewayProxyEvent, routeKey: string | undefined): Promise<WebSocketResponse> {
      return {
          statusCode: 404,
          body: { error: `Route ${routeKey} not found` }
      };
  }

  protected async handleError(error: Error | unknown): Promise<APIGatewayProxyResult> {
      this.logger.error("Error in WebSocket Lambda:", error);

      return {
          statusCode: 500,
          body: JSON.stringify({
              message: "Internal Server Error"
          })
      };
  }

  // Utility methods
  protected getConnectionId(event: APIGatewayProxyEvent): string | undefined {
      return event.requestContext.connectionId;
  }

  protected getRouteKey(event: APIGatewayProxyEvent): string | undefined {
      return event.requestContext.routeKey;
  }

  protected getDomainName(event: APIGatewayProxyEvent): string {
      return event.requestContext.domainName;
  }

  protected getStage(event: APIGatewayProxyEvent): string {
      return event.requestContext.stage;
  }

  protected parseBody<T>(event: APIGatewayProxyEvent): T | null {
      if (!event.body) return null;
      try {
          return JSON.parse(event.body) as T;
      } catch (error) {
          return null;
      }
  }

  // Message sending methods
  protected async sendMessage(connectionId: string, data: any): Promise<void> {
      if (!this.apiGatewayClient) {
          throw new Error("WebSocket API client not initialized");
      }

      const command = new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify(data)
      });

      try {
          await this.apiGatewayClient.send(command);
      } catch (error: any) {
          if (error.statusCode === 410) {
              // Connection is stale, handle cleanup
              await this.handleStaleConnection(connectionId);
          } else {
              throw error;
          }
      }
  }

  protected async broadcastMessage(connectionIds: string[], data: any): Promise<void> {
      const promises = connectionIds.map(connectionId =>
          this.sendMessage(connectionId, data).catch(error => {
              this.logger.warn("Failed to send message to connection", { connectionId, error });
          })
      );

      await Promise.allSettled(promises);
  }

  // Override this method to handle stale connections
  protected async handleStaleConnection(connectionId: string): Promise<void> {
      this.logger.info("Stale connection detected", { connectionId });
  }

  // Response helpers
  protected successResponse(data?: any): WebSocketResponse {
      return {
          statusCode: 200,
          body: data
      };
  }

  protected badRequestResponse(message: string): WebSocketResponse {
      return {
          statusCode: 400,
          body: { error: message }
      };
  }

  protected unauthorizedResponse(message: string = "Unauthorized"): WebSocketResponse {
      return {
          statusCode: 401,
          body: { error: message }
      };
  }

  protected forbiddenResponse(message: string = "Forbidden"): WebSocketResponse {
      return {
          statusCode: 403,
          body: { error: message }
      };
  }

  protected internalServerErrorResponse(message: string = "Internal server error"): WebSocketResponse {
      return {
          statusCode: 500,
          body: { error: message }
      };
  }
}
