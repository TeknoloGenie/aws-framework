import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand,
    ScanCommand,
    BatchGetCommand,
    BatchWriteCommand,
    TransactGetCommand,
    TransactWriteCommand,
    GetCommandInput,
    PutCommandInput,
    UpdateCommandInput,
    DeleteCommandInput,
    QueryCommandInput,
    ScanCommandInput,
    BatchGetCommandInput,
    BatchWriteCommandInput,
    TransactGetCommandInput,
    TransactWriteCommandInput,
    GetCommandOutput,
    PutCommandOutput,
    UpdateCommandOutput,
    DeleteCommandOutput,
    QueryCommandOutput,
    ScanCommandOutput,
    BatchGetCommandOutput,
    BatchWriteCommandOutput,
    TransactGetCommandOutput,
    TransactWriteCommandOutput
} from "@aws-sdk/lib-dynamodb";
import middy from "middy";

export interface DynamoDBOptions {
  instance?: DynamoDBDocumentClient;
  setToContext?: boolean;
}

export const dynamoDb = (options: DynamoDBOptions = {}): middy.MiddlewareObject<any, any> => {
    const {
        instance,
        setToContext = true,
    } = options;

    let documentClient: DynamoDBDocumentClient;

    return {
        before: async (request) => {
            // Create or use the provided DynamoDB document client
            if (instance) {
                documentClient = instance;
            } else {
                const client = new DynamoDBClient({});
                documentClient = DynamoDBDocumentClient.from(client);
            }

            if (setToContext) {
                request.context.dynamoDB = documentClient;
            }
        },
    };
};

export class DynamoDBService {
    private documentClient: DynamoDBDocumentClient;

    constructor(options: { region?: string } = {}) {
        const client = new DynamoDBClient({
            region: options.region,
        });
        this.documentClient = DynamoDBDocumentClient.from(client);
    }

    async get<T>(params: GetCommandInput): Promise<T | null> {
        const command = new GetCommand(params);
        const result = await this.documentClient.send(command);
        return (result.Item as T) || null;
    }

    async put(params: PutCommandInput): Promise<PutCommandOutput> {
        const command = new PutCommand(params);
        return await this.documentClient.send(command);
    }

    async update(params: UpdateCommandInput): Promise<UpdateCommandOutput> {
        const command = new UpdateCommand(params);
        return await this.documentClient.send(command);
    }

    async delete(params: DeleteCommandInput): Promise<DeleteCommandOutput> {
        const command = new DeleteCommand(params);
        return await this.documentClient.send(command);
    }

    async query<T>(params: QueryCommandInput): Promise<T[]> {
        const command = new QueryCommand(params);
        const result = await this.documentClient.send(command);
        return (result.Items as T[]) || [];
    }

    async scan<T>(params: ScanCommandInput): Promise<T[]> {
        const command = new ScanCommand(params);
        const result = await this.documentClient.send(command);
        return (result.Items as T[]) || [];
    }

    async batchGet<T>(params: BatchGetCommandInput): Promise<Record<string, T[]>> {
        const command = new BatchGetCommand(params);
        const result = await this.documentClient.send(command);

        const response: Record<string, T[]> = {};

        if (result.Responses) {
            Object.keys(result.Responses).forEach(tableName => {
                response[tableName] = result.Responses![tableName] as T[];
            });
        }

        return response;
    }

    async batchWrite(params: BatchWriteCommandInput): Promise<BatchWriteCommandOutput> {
        const command = new BatchWriteCommand(params);
        return await this.documentClient.send(command);
    }

    async transactWrite(params: TransactWriteCommandInput): Promise<TransactWriteCommandOutput> {
        const command = new TransactWriteCommand(params);
        return await this.documentClient.send(command);
    }

    async transactGet<T>(params: TransactGetCommandInput): Promise<T[]> {
        const command = new TransactGetCommand(params);
        const result = await this.documentClient.send(command);

        if (!result.Responses) {
            return [];
        }

        return result.Responses.map(response => response.Item as T);
    }
}
