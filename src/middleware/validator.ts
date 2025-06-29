import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import middy from "middy";
import { BadRequestError } from "./error-handler";

export interface ValidatorOptions {
  inputSchema?: any;
  outputSchema?: any;
  ajvOptions?: any;
}

let ajv: any;

export const validator = (options: ValidatorOptions): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    const {
        inputSchema,
        outputSchema,
        ajvOptions = {
            allErrors: true,
            coerceTypes: true,
            useDefaults: true,
        },
    } = options;

    // Lazy load ajv to reduce cold start time if not needed
    if (!ajv) {
        try {
            // Try to import ajv
            const Ajv = require("ajv");
            ajv = new Ajv(ajvOptions);
            require("ajv-formats")(ajv);
        } catch (error) {
            console.warn("ajv not installed, validation will be skipped");
        }
    }

    let validateInput: any;
    let validateOutput: any;

    if (ajv) {
        if (inputSchema) {
            validateInput = ajv.compile(inputSchema);
        }

        if (outputSchema) {
            validateOutput = ajv.compile(outputSchema);
        }
    }

    return {
        before: async (request) => {
            if (!validateInput || !ajv) return;

            const { event } = request;
            let data: any;

            try {
                data = event.body ? JSON.parse(event.body) : {};
            } catch (error) {
                throw new BadRequestError("Invalid JSON in request body");
            }

            const valid = validateInput(data);

            if (!valid) {
                const errors = validateInput.errors.map((err: any) => ({
                    field: err.instancePath,
                    message: err.message,
                }));

                throw new BadRequestError(`Validation error: ${JSON.stringify(errors)}`);
            }

            // Replace the event.body with the validated data
            event.body = JSON.stringify(data);
        },
        after: async (request) => {
            if (!validateOutput || !ajv) return;

            const { response } = request;

            if (!response) return;

            let data: any;

            try {
                data = response.body ? JSON.parse(response.body) : {};
            } catch (error) {
                console.error("Error parsing response body:", error);
                return;
            }

            const valid = validateOutput(data);

            if (!valid) {
                console.error("Response validation error:", validateOutput.errors);

                // Don't throw an error, just log it
                // This prevents breaking the response to the client
            }
        },
    };
};
