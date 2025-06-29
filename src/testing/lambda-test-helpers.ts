import { Context } from "aws-lambda";

/**
 * Creates a mock Lambda context for testing
 */
export function createMockContext(overrides: Partial<Context> = {}): Context {
    const context: Context = {
        callbackWaitsForEmptyEventLoop: true,
        functionName: "test-function",
        functionVersion: "1",
        invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test-function",
        memoryLimitInMB: "128",
        awsRequestId: "00000000-0000-0000-0000-000000000000",
        logGroupName: "/aws/lambda/test-function",
        logStreamName: "2021/01/01/[$LATEST]00000000000000000000000000000000",
        getRemainingTimeInMillis: () => 3000,
        done: () => {},
        fail: () => {},
        succeed: () => {},
        ...overrides,
    };

    return context;
}

/**
 * Creates a mock Lambda handler for testing
 */
export function createMockHandler<TEvent, TResult>(
    handler: (event: TEvent, context: Context) => Promise<TResult>,
    mockContext: Partial<Context> = {}
): (event: TEvent) => Promise<TResult> {
    return async (event: TEvent): Promise<TResult> => {
        const context = createMockContext(mockContext);
        return await handler(event, context);
    };
}

/**
 * Utility to mock AWS SDK v3 services
 */
export function mockAwsService<T>(
    service: any,
    commandName: string,
    mockImplementation: (...args: any[]) => any
): jest.SpyInstance {
    const mockMethod = jest.spyOn(service.prototype, "send");

    mockMethod.mockImplementation(function(this: any, command: any) {
        if (command.constructor.name === commandName) {
            return Promise.resolve(mockImplementation(command.input));
        }
        return jest.requireActual(service.prototype.send).apply(this, [command]);
    });

    return mockMethod;
}

/**
 * Utility to wait for a specified time
 */
export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Utility to capture console logs during tests
 */
export function captureConsoleOutput(): { logs: string[], restore: () => void } {
    const logs: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = (...args) => logs.push(["log", ...args].join(" "));
    console.info = (...args) => logs.push(["info", ...args].join(" "));
    console.warn = (...args) => logs.push(["warn", ...args].join(" "));
    console.error = (...args) => logs.push(["error", ...args].join(" "));

    const restore = () => {
        console.log = originalConsoleLog;
        console.info = originalConsoleInfo;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
    };

    return { logs, restore };
}
