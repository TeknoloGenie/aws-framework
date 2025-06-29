import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { BaseLambda } from "./base-lambda";

export interface HttpApiResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
  cookies?: string[];
}

export abstract class HttpApiLambda extends BaseLambda<APIGatewayProxyEventV2, APIGatewayProxyResultV2> {
  protected abstract processHttpApi(event: APIGatewayProxyEventV2): Promise<HttpApiResponse>;

  protected async process(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
      const response = await this.processHttpApi(event);

      return {
          statusCode: response.statusCode,
          body: JSON.stringify(response.body),
          headers: {
              "Content-Type": "application/json",
              ...response.headers
          },
          cookies: response.cookies
      };
  }

  protected async handleError(error: Error | unknown): Promise<APIGatewayProxyResultV2> {
      console.error("Error in HTTP API Lambda:", error);

      return {
          statusCode: 500,
          body: JSON.stringify({
              message: "Internal Server Error"
          }),
          headers: {
              "Content-Type": "application/json"
          }
      };
  }

  protected getPathParameter(event: APIGatewayProxyEventV2, name: string): string | undefined {
      return event.pathParameters?.[name];
  }

  protected getQueryParameter(event: APIGatewayProxyEventV2, name: string): string | undefined {
      return event.queryStringParameters?.[name];
  }

  protected getBody<T>(event: APIGatewayProxyEventV2): T | undefined {
      if (!event.body) return undefined;
      try {
          return JSON.parse(event.body) as T;
      } catch (error) {
          return undefined;
      }
  }
}
