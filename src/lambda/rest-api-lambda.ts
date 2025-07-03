import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { BaseLambda } from "./base-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

export interface ApiResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  permissions: string[];
}

export abstract class RestApiLambda extends BaseLambda<APIGatewayProxyEvent, APIGatewayProxyResult> {
  protected jwtVerifier?: CognitoJwtVerifier;

  constructor() {
    super();
    
    // Initialize JWT verifier if User Pool is configured
    if (process.env.USER_POOL_ID && process.env.USER_POOL_CLIENT_ID) {
      this.jwtVerifier = CognitoJwtVerifier.create({
        userPoolId: process.env.USER_POOL_ID,
        tokenUse: "access",
        clientId: process.env.USER_POOL_CLIENT_ID,
      });
    }
  }

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
      this.logger.error("Error in REST API Lambda:", error);

      return {
          statusCode: 500,
          body: JSON.stringify({
              success: false,
              message: "Internal Server Error"
          }),
          headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true"
          }
      };
  }

  // Authentication methods
  protected async getAuthenticatedUser(event: APIGatewayProxyEvent): Promise<AuthUser | null> {
    try {
      const token = this.extractToken(event);
      if (!token || !this.jwtVerifier) {
        return null;
      }

      const payload = await this.jwtVerifier.verify(token);
      
      return {
        id: payload.sub,
        email: payload.email || '',
        username: payload['custom:username'] || payload.email || '',
        role: payload['custom:role'] || 'user',
        permissions: payload['custom:permissions'] ? JSON.parse(payload['custom:permissions']) : []
      };
    } catch (error) {
      this.logger.warn('Token verification failed', { error });
      return null;
    }
  }

  private extractToken(event: APIGatewayProxyEvent): string | null {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

    return parts[1];
  }

  // Helper methods for common responses
  protected successResponse(data: any, message?: string): ApiResponse {
    return {
      statusCode: 200,
      body: {
        success: true,
        data,
        message
      }
    };
  }

  protected createdResponse(data: any, message?: string): ApiResponse {
    return {
      statusCode: 201,
      body: {
        success: true,
        data,
        message
      }
    };
  }

  protected badRequestResponse(message: string): ApiResponse {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: message
      }
    };
  }

  protected unauthorizedResponse(message: string = 'Unauthorized'): ApiResponse {
    return {
      statusCode: 401,
      body: {
        success: false,
        error: message
      }
    };
  }

  protected forbiddenResponse(message: string = 'Forbidden'): ApiResponse {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: message
      }
    };
  }

  protected notFoundResponse(message: string = 'Not found'): ApiResponse {
    return {
      statusCode: 404,
      body: {
        success: false,
        error: message
      }
    };
  }

  protected methodNotAllowedResponse(): ApiResponse {
    return {
      statusCode: 405,
      body: {
        success: false,
        error: 'Method not allowed'
      }
    };
  }

  protected conflictResponse(message: string): ApiResponse {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: message
      }
    };
  }

  protected internalServerErrorResponse(message: string = 'Internal server error'): ApiResponse {
    return {
      statusCode: 500,
      body: {
        success: false,
        error: message
      }
    };
  }

  // Utility methods
  protected getPathParameter(event: APIGatewayProxyEvent, name: string): string | undefined {
      return event.pathParameters?.[name];
  }

  protected getQueryParameter(event: APIGatewayProxyEvent, name: string): string | undefined {
      return event.queryStringParameters?.[name];
  }

  protected parseJsonBody<T>(event: APIGatewayProxyEvent): T | null {
      if (!event.body) return null;
      try {
          return JSON.parse(event.body) as T;
      } catch (error) {
          return null;
      }
  }

  // Deprecated - use parseJsonBody instead
  protected getBody<T>(event: APIGatewayProxyEvent): T | undefined {
      if (!event.body) return undefined;
      try {
          return JSON.parse(event.body) as T;
      } catch (error) {
          return undefined;
      }
  }
}
