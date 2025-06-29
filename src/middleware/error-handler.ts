import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import middy from "middy";

export class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = "HttpError";
    }
}

export class BadRequestError extends HttpError {
    constructor(message: string = "Bad Request") {
        super(400, message);
        this.name = "BadRequestError";
    }
}

export class UnauthorizedError extends HttpError {
    constructor(message: string = "Unauthorized") {
        super(401, message);
        this.name = "UnauthorizedError";
    }
}

export class ForbiddenError extends HttpError {
    constructor(message: string = "Forbidden") {
        super(403, message);
        this.name = "ForbiddenError";
    }
}

export class NotFoundError extends HttpError {
    constructor(message: string = "Not Found") {
        super(404, message);
        this.name = "NotFoundError";
    }
}

export class ConflictError extends HttpError {
    constructor(message: string = "Conflict") {
        super(409, message);
        this.name = "ConflictError";
    }
}

export class InternalServerError extends HttpError {
    constructor(message: string = "Internal Server Error") {
        super(500, message);
        this.name = "InternalServerError";
    }
}

export const errorHandler = (): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    return {
        onError: async (request): Promise<void> => {
            const { error } = request;

            console.error("Error caught by error handler middleware:", error);

            let statusCode = 500;
            let message = "Internal Server Error";

            if (error instanceof HttpError) {
                statusCode = error.statusCode;
                message = error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }

            request.response = {
                statusCode,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": "true",
                },
                body: JSON.stringify({
                    error: message,
                }),
            };
        },
    };
};
