import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { BaseLambda } from "./base-lambda";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export interface WebSocketResponse {
  statusCode: number;
  body?: any;
}

export abstract class WebSocketLambda extends BaseLambda<APIGatewayProxyEvent, APIGatewayProxyResult> {
  protected abstract processWebSocket(event: APIGatewayProxyEvent): Promise<WebSocketResponse>;

  protected async process(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
      const response = await this.processWebSocket(event);

      return {
          statusCode: response.statusCode,
          body: response.body ? JSON.stringify(response.body) : ""
      };
  }

  protected async handleError(error: Error | unknown): Promise<APIGatewayProxyResult> {
      console.error("Error in WebSocket Lambda:", error);

      return {
          statusCode: 500,
          body: JSON.stringify({
              message: "Internal Server Error"
          })
      };
  }

  protected getConnectionId(event: APIGatewayProxyEvent): string | undefined {
      return event.requestContext.connectionId;
  }

  protected getRouteKey(event: APIGatewayProxyEvent): string | undefined {
      return event.requestContext.routeKey;
  }

  protected async sendMessage(connectionId: string, data: any): Promise<void> {
      const apiGateway = new ApiGatewayManagementApiClient({
          endpoint: `https://${this.context.domainName}/${this.context.stage}`
      });

      const command = new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(data))
      });

      await apiGateway.send(command);
  }
}
