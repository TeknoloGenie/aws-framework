import { CognitoJwtVerifier } from "aws-jwt-verify";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import middy from "middy";
import "../types/context";
import { UnauthorizedError } from "./error-handler";

export interface JwtAuthOptions {
  userPoolId: string;
  clientId: string;
  tokenUse?: "access" | "id";
  extractToken?: (event: APIGatewayProxyEvent) => string | undefined;
}

export const jwtAuth = (options: JwtAuthOptions): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    const {
        userPoolId,
        clientId,
        tokenUse = "access",
        extractToken = defaultExtractToken,
    } = options;

    const verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse,
        clientId,
    });

    return {
        before: async (request) => {
            const { event } = request;

            try {
                const token = extractToken(event);

                if (!token) {
                    throw new UnauthorizedError("No authorization token provided");
                }

                const payload = await verifier.verify(token);

                // Add the claims to the request context
                request.context.user = payload;

            } catch (error) {
                console.error("JWT verification failed:", error);
                throw new UnauthorizedError("Invalid or expired token");
            }
        },
    };
};

export interface RoleAuthOptions {
  allowedRoles: string[];
  rolesPath?: string;
}

export const roleAuth = (options: RoleAuthOptions): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    const {
        allowedRoles,
        rolesPath = "cognito:groups",
    } = options;

    return {
        before: async (request) => {
            const { context } = request;

            if (!context.user) {
                throw new UnauthorizedError("User not authenticated");
            }

            const userRoles = getUserRoles(context.user, rolesPath);

            if (!hasAllowedRole(userRoles, allowedRoles)) {
                throw new UnauthorizedError("Insufficient permissions");
            }
        },
    };
};

// Helper functions
function defaultExtractToken(event: APIGatewayProxyEvent): string | undefined {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader) {
        return undefined;
    }

    const match = authHeader.match(/^Bearer\s+(.*)$/);
    return match ? match[1] : undefined;
}

function getUserRoles(user: any, rolesPath: string): string[] {
    const paths = rolesPath.split(".");
    let value = user;

    for (const path of paths) {
        if (!value || typeof value !== "object") {
            return [];
        }
        value = value[path];
    }

    if (Array.isArray(value)) {
        return value;
    }

    return [];
}

function hasAllowedRole(userRoles: string[], allowedRoles: string[]): boolean {
    return userRoles.some(role => allowedRoles.includes(role));
}
