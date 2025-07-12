import { Context } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Extend the AWS Lambda Context interface
declare module "aws-lambda" {
    interface Context {
        user?: any;
        dynamoDB?: {
            client: DynamoDBClient;
            docClient: DynamoDBDocumentClient;
        };
        secrets?: Record<string, string>;
        parameters?: Record<string, string>;
    }
}
