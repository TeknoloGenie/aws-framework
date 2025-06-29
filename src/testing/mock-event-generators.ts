import {
    APIGatewayProxyEvent,
    APIGatewayProxyEventV2,
    SQSEvent,
    SNSEvent,
    DynamoDBStreamEvent,
    S3Event,
    EventBridgeEvent
} from "aws-lambda";
import { v4 as uuidv4 } from "uuid";

/**
 * Creates a mock API Gateway REST API event
 */
export function createApiGatewayEvent(options: {
  path?: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  body?: any;
  isBase64Encoded?: boolean;
} = {}): APIGatewayProxyEvent {
    const {
        path = "/",
        httpMethod = "GET",
        headers = {},
        queryStringParameters = null,
        pathParameters = null,
        body = null,
        isBase64Encoded = false,
    } = options;

    return {
        resource: path,
        path,
        httpMethod,
        headers,
        multiValueHeaders: {},
        queryStringParameters,
        multiValueQueryStringParameters: null,
        pathParameters,
        stageVariables: null,
        requestContext: {
            accountId: "123456789012",
            apiId: "api-id",
            authorizer: null,
            protocol: "HTTP/1.1",
            httpMethod,
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                clientCert: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
                sourceIp: "127.0.0.1",
                user: null,
                userAgent: "Custom User Agent String",
                userArn: null,
            },
            path,
            stage: "test",
            requestId: uuidv4(),
            requestTimeEpoch: Date.now(),
            resourceId: "resource-id",
            resourcePath: path,
        },
        body: body ? JSON.stringify(body) : null,
        isBase64Encoded,
    };
}

/**
 * Creates a mock API Gateway HTTP API event
 */
export function createHttpApiEvent(options: {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  body?: any;
  isBase64Encoded?: boolean;
} = {}): APIGatewayProxyEventV2 {
    const {
        path = "/",
        method = "GET",
        headers = {},
        queryStringParameters = {},
        pathParameters = {},
        body = null,
        isBase64Encoded = false,
    } = options;

    return {
        version: "2.0",
        routeKey: `${method} ${path}`,
        rawPath: path,
        rawQueryString: "",
        headers,
        queryStringParameters,
        pathParameters,
        requestContext: {
            accountId: "123456789012",
            apiId: "api-id",
            domainName: "test.execute-api.us-east-1.amazonaws.com",
            domainPrefix: "test",
            http: {
                method,
                path,
                protocol: "HTTP/1.1",
                sourceIp: "127.0.0.1",
                userAgent: "Custom User Agent String",
            },
            requestId: uuidv4(),
            routeKey: `${method} ${path}`,
            stage: "test",
            time: new Date().toISOString(),
            timeEpoch: Date.now(),
        },
        body: body ? JSON.stringify(body) : null,
        isBase64Encoded,
        cookies: [],
    };
}

/**
 * Creates a mock SQS event
 */
export function createSqsEvent(messages: any[]): SQSEvent {
    return {
        Records: messages.map(message => ({
            messageId: uuidv4(),
            receiptHandle: "receipt-handle",
            body: typeof message === "string" ? message : JSON.stringify(message),
            attributes: {
                ApproximateReceiveCount: "1",
                SentTimestamp: Date.now().toString(),
                SenderId: "SENDER_ID",
                ApproximateFirstReceiveTimestamp: Date.now().toString(),
            },
            messageAttributes: {},
            md5OfBody: "md5-of-body",
            eventSource: "aws:sqs",
            eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:my-queue",
            awsRegion: "us-east-1",
        })),
    };
}

/**
 * Creates a mock SNS event
 */
export function createSnsEvent(messages: any[]): SNSEvent {
    return {
        Records: messages.map(message => ({
            EventVersion: "1.0",
            EventSubscriptionArn: "arn:aws:sns:us-east-1:123456789012:my-topic:subscription-id",
            EventSource: "aws:sns",
            Sns: {
                SignatureVersion: "1",
                Timestamp: new Date().toISOString(),
                Signature: "signature",
                SigningCertUrl: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-cert.pem",
                MessageId: uuidv4(),
                Message: typeof message === "string" ? message : JSON.stringify(message),
                MessageAttributes: {},
                Type: "Notification",
                UnsubscribeUrl: "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=subscription-arn",
                TopicArn: "arn:aws:sns:us-east-1:123456789012:my-topic",
                Subject: "Test Subject",
            },
        })),
    };
}

/**
 * Creates a mock DynamoDB Stream event
 */
export function createDynamoDBStreamEvent(
    records: {
    eventName: "INSERT" | "MODIFY" | "REMOVE";
    oldImage?: Record<string, any>;
    newImage?: Record<string, any>;
  }[]
): DynamoDBStreamEvent {
    return {
        Records: records.map(record => ({
            eventID: uuidv4(),
            eventName: record.eventName,
            eventVersion: "1.1",
            eventSource: "aws:dynamodb",
            awsRegion: "us-east-1",
            dynamodb: {
                ApproximateCreationDateTime: Date.now(),
                Keys: {},
                NewImage: record.newImage ? convertToDynamoDBFormat(record.newImage) : undefined,
                OldImage: record.oldImage ? convertToDynamoDBFormat(record.oldImage) : undefined,
                SequenceNumber: "000000000000000000000",
                SizeBytes: 100,
                StreamViewType: "NEW_AND_OLD_IMAGES",
            },
            eventSourceARN: "arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/timestamp",
        })),
    };
}

/**
 * Creates a mock S3 event
 */
export function createS3Event(
    records: {
    bucket: string;
    key: string;
    eventName?: string;
    size?: number;
  }[]
): S3Event {
    return {
        Records: records.map(record => ({
            eventVersion: "2.1",
            eventSource: "aws:s3",
            awsRegion: "us-east-1",
            eventTime: new Date().toISOString(),
            eventName: record.eventName || "ObjectCreated:Put",
            userIdentity: {
                principalId: "AWS:PRINCIPAL_ID",
            },
            requestParameters: {
                sourceIPAddress: "127.0.0.1",
            },
            responseElements: {
                "x-amz-request-id": uuidv4(),
                "x-amz-id-2": "request-id",
            },
            s3: {
                s3SchemaVersion: "1.0",
                configurationId: "config-id",
                bucket: {
                    name: record.bucket,
                    ownerIdentity: {
                        principalId: "PRINCIPAL_ID",
                    },
                    arn: `arn:aws:s3:::${record.bucket}`,
                },
                object: {
                    key: record.key,
                    size: record.size || 1024,
                    eTag: "etag",
                    versionId: "version-id",
                    sequencer: "sequencer",
                },
            },
        })),
    };
}

/**
 * Creates a mock EventBridge event
 */
export function createEventBridgeEvent<T>(
    source: string,
    detailType: string,
    detail: T
): EventBridgeEvent<string, T> {
    return {
        id: uuidv4(),
        version: "0",
        account: "123456789012",
        time: new Date().toISOString(),
        region: "us-east-1",
        source,
        "detail-type": detailType,
        detail,
        resources: [],
    };
}

/**
 * Helper function to convert JavaScript objects to DynamoDB format
 */
function convertToDynamoDBFormat(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            result[key] = { S: value };
        } else if (typeof value === "number") {
            result[key] = { N: value.toString() };
        } else if (typeof value === "boolean") {
            result[key] = { BOOL: value };
        } else if (value === null) {
            result[key] = { NULL: true };
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                result[key] = { L: [] };
            } else if (typeof value[0] === "string") {
                result[key] = { SS: value };
            } else if (typeof value[0] === "number") {
                result[key] = { NS: value.map(n => n.toString()) };
            } else {
                result[key] = { L: value.map(item => convertToDynamoDBFormat({ item }).item) };
            }
        } else if (typeof value === "object") {
            result[key] = { M: convertToDynamoDBFormat(value) };
        }
    }

    return result;
}
