import middy from "middy";

export interface LoggerOptions {
  level?: "debug" | "info" | "warn" | "error";
  logEvent?: boolean;
  logContext?: boolean;
  logResponse?: boolean;
  sensitiveKeys?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const logger = (options: LoggerOptions = {}): middy.MiddlewareObject<any, any> => {
    const {
        level = "info",
        logEvent = true,
        logContext = false,
        logResponse = true,
        sensitiveKeys = ["password", "token", "authorization", "secret", "credential"],
    } = options;

    const logLevel = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const log = (message: string, obj?: any, lvl: "debug" | "info" | "warn" | "error" = "info") => {
        if (logLevel[lvl] < logLevel[level]) return;

        let logObj = obj;
        if (obj && typeof obj === "object") {
            logObj = JSON.parse(JSON.stringify(obj));

            // Redact sensitive information
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const redact = (obj: any, keys: string[]) => {
                if (!obj || typeof obj !== "object") return;

                Object.keys(obj).forEach(key => {
                    if (keys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
                        obj[key] = "[REDACTED]";
                    } else if (typeof obj[key] === "object") {
                        redact(obj[key], keys);
                    }
                });
            };

            redact(logObj, sensitiveKeys);
        }

        switch (lvl) {
        case "debug":
            console.debug(message, logObj);
            break;
        case "info":
            console.info(message, logObj);
            break;
        case "warn":
            console.warn(message, logObj);
            break;
        case "error":
            console.error(message, logObj);
            break;
        }
    };

    return {
        before: async (request) => {
            const { event, context } = request;

            log(`Lambda invocation started: ${context.functionName}`, {
                requestId: context.awsRequestId,
                remainingTime: context.getRemainingTimeInMillis(),
            });

            if (logEvent) {
                log("Event:", event, "debug");
            }

            if (logContext) {
                log("Context:", context, "debug");
            }
        },
        after: async (request) => {
            const { response, context } = request;

            if (logResponse) {
                log("Response:", response, "debug");
            }

            log(`Lambda invocation completed: ${context.functionName}`, {
                requestId: context.awsRequestId,
                executionTime: context.getRemainingTimeInMillis()
            });
        },
        onError: async (request) => {
            const { error, context } = request;

            log(`Lambda invocation failed: ${context.functionName}`, {
                error: error.toString(),
                stack: error.stack,
                requestId: context.awsRequestId,
            }, "error");
        },
    };
};
