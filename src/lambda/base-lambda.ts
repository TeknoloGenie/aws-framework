import { Context } from "aws-lambda";

export abstract class BaseLambda<TEvent, TResult> {
    protected context: Context;

    constructor() {
        this.context = {} as Context;
    }

    /**
   * Main handler method to be called by AWS Lambda
   */
    public async handler(event: TEvent, context: Context): Promise<TResult> {
        this.context = context;

        try {
            await this.initialize(event);
            return await this.process(event);
        } catch (error) {
            return await this.handleError(error);
        } finally {
            await this.cleanup();
        }
    }

    /**
   * Initialize resources before processing
   */
    protected async initialize(event: TEvent): Promise<void> {
    // Override in subclasses if needed
    }

  /**
   * Main processing logic
   */
  protected abstract process(event: TEvent): Promise<TResult>;

  /**
   * Error handling logic
   */
  protected abstract handleError(error: Error | unknown): Promise<TResult>;

  /**
   * Cleanup resources after processing
   */
  protected async cleanup(): Promise<void> {
      // Override in subclasses if needed
  }
}
