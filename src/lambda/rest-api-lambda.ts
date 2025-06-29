import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { BaseLambda } from "./base-lambda";

export interface ApiResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

export abstract class RestApiLambda extends BaseLambda<APIGatewayProxyEvent, APIGatewayProxyResult> {
  protected abstract processApi(event: APIGatewayProxyEvent): Promise<ApiResponse>;

  protected async process(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
      const response = await this.processApi(event);

      return {
          statusCode: response.statusCode,
          body: JSON.stringify(response.body),
          headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...response.headers
          }
      };
  }

  protected async handleError(error: Error | unknown): Promise<APIGatewayProxyResult> {
      console.error("Error in REST API Lambda:", error);

      return {
          statusCode: 500,
          body: JSON.stringify({
              message: "Internal Server Error"
          }),
          headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true"
          }
      };
  }

  protected getPathParameter(event: APIGatewayProxyEvent, name: string): string | undefined {
      return event.pathParameters?.[name];
  }

  protected getQueryParameter(event: APIGatewayProxyEvent, name: string): string | undefined {
      return event.queryStringParameters?.[name];
  }

  protected getBody<T>(event: APIGatewayProxyEvent): T | undefined {
      if (!event.body) return undefined;
      try {
          return JSON.parse(event.body) as T;
      } catch (error) {
          return undefined;
      }
  }
}
