import { Context, SQSEvent, SNSEvent, EventBridgeEvent } from "aws-lambda";
import { BaseLambda } from "./base-lambda";

export type EventType = SQSEvent | SNSEvent | EventBridgeEvent<string, any>;

export abstract class EventLambda<TEvent extends EventType, TResult = void> extends BaseLambda<TEvent, TResult> {
  protected abstract processEvent(event: TEvent): Promise<TResult>;

  protected async process(event: TEvent): Promise<TResult> {
      return await this.processEvent(event);
  }

  protected async handleError(error: Error | unknown): Promise<TResult> {
      console.error("Error in Event Lambda:", error);
      throw error; // Re-throw to let AWS handle the error based on event source
  }

  protected getEventSource(event: TEvent): string {
      if ("Records" in event && event.Records?.[0]?.eventSource === "aws:sqs") {
          return "SQS";
      } else if ("Records" in event && event.Records?.[0]?.EventSource === "aws:sns") {
          return "SNS";
      } else if ("source" in event) {
          return "EventBridge";
      }
      return "Unknown";
  }
}
