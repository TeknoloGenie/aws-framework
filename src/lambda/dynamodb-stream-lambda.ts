import { DynamoDBStreamEvent, Context } from "aws-lambda";
import { BaseLambda } from "./base-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export abstract class DynamoDBStreamLambda extends BaseLambda<DynamoDBStreamEvent, void> {
    protected dynamoDB: DynamoDBDocumentClient;

    constructor() {
        super();
        const client = new DynamoDBClient({});
        this.dynamoDB = DynamoDBDocumentClient.from(client);
    }

  protected abstract processDynamoDBStream(event: DynamoDBStreamEvent): Promise<void>;

  protected async process(event: DynamoDBStreamEvent): Promise<void> {
      return await this.processDynamoDBStream(event);
  }

  protected async handleError(error: Error | unknown): Promise<void> {
      console.error("Error in DynamoDB Stream Lambda:", error);
      throw error;
  }

  protected getInsertRecords(event: DynamoDBStreamEvent) {
      return event.Records.filter(record => record.eventName === "INSERT");
  }

  protected getModifyRecords(event: DynamoDBStreamEvent) {
      return event.Records.filter(record => record.eventName === "MODIFY");
  }

  protected getRemoveRecords(event: DynamoDBStreamEvent) {
      return event.Records.filter(record => record.eventName === "REMOVE");
  }
}
