import { WebSocketLambda, WebSocketResponse } from "./websocket-lambda";
import { APIGatewayProxyEvent } from "aws-lambda";

// Alias for better naming consistency
export abstract class WebSocketApiLambda extends WebSocketLambda {
    // This class provides the same functionality as WebSocketLambda
    // but with a more descriptive name for API Gateway WebSocket APIs

    // Abstract methods that must be implemented by subclasses
    protected abstract handleConnect(event: APIGatewayProxyEvent): Promise<WebSocketResponse>;
    protected abstract handleDisconnect(event: APIGatewayProxyEvent): Promise<WebSocketResponse>;
    protected abstract handleMessage(event: APIGatewayProxyEvent): Promise<WebSocketResponse>;
}
