import { Context } from "aws-lambda";
import { logger } from "../middleware/logger";
export abstract class BaseLambda<TEvent, TResult> {
    protected context: Context;
    protected logger: typeof logger;
    constructor() {
        this.context = {} as Context;
        this.logger = logger;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async initialize(_event: TEvent): Promise<void> {
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
