import { WebSocketLambda, WebSocketResponse } from "./websocket-lambda";
import { APIGatewayProxyEvent } from "aws-lambda";

// Alias for better naming consistency
export class WebSocketApiLambda extends WebSocketLambda {
  // This class provides the same functionality as WebSocketLambda
  // but with a more descriptive name for API Gateway WebSocket APIs
}
