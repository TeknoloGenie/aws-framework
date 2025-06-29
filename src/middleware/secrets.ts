import {
    SecretsManagerClient,
    GetSecretValueCommand
} from "@aws-sdk/client-secrets-manager";
import {
    SSMClient,
    GetParametersCommand,
    GetParametersByPathCommand
} from "@aws-sdk/client-ssm";
import middy from "middy";

export interface SecretsManagerOptions {
  cache?: boolean;
  cacheExpiryInMs?: number;
  secretsPath?: string;
  setToContext?: boolean;
}

interface SecretCache {
  [key: string]: {
    value: any;
    expiry: number;
  };
}

const secretsCache: SecretCache = {};

export const secretsManager = (options: SecretsManagerOptions = {}): middy.MiddlewareObject<any, any> => {
    const {
        cache = true,
        cacheExpiryInMs = 60 * 60 * 1000, // 1 hour
        secretsPath,
        setToContext = true,
    } = options;

    const client = new SecretsManagerClient({});

    const getSecret = async (secretId: string): Promise<any> => {
        const now = Date.now();

        // Check cache first if enabled
        if (cache && secretsCache[secretId] && secretsCache[secretId].expiry > now) {
            return secretsCache[secretId].value;
        }

        try {
            const command = new GetSecretValueCommand({ SecretId: secretId });
            const data = await client.send(command);
            let secretValue: any;

            if (data.SecretString) {
                try {
                    secretValue = JSON.parse(data.SecretString);
                } catch (e) {
                    secretValue = data.SecretString;
                }
            } else if (data.SecretBinary) {
                secretValue = Buffer.from(data.SecretBinary as Uint8Array).toString("ascii");
            }

            // Store in cache if enabled
            if (cache) {
                secretsCache[secretId] = {
                    value: secretValue,
                    expiry: now + cacheExpiryInMs,
                };
            }

            return secretValue;
        } catch (error) {
            console.error(`Error retrieving secret ${secretId}:`, error);
            throw error;
        }
    };

    return {
        before: async (request) => {
            if (!secretsPath) return;

            try {
                const secret = await getSecret(secretsPath);

                if (setToContext) {
                    request.context.secrets = secret;
                }
            } catch (error) {
                console.error("Error in secrets middleware:", error);
                throw error;
            }
        },
    };
};

export interface ParameterStoreOptions {
  cache?: boolean;
  cacheExpiryInMs?: number;
  parameterNames?: string[];
  path?: string;
  recursive?: boolean;
  setToContext?: boolean;
}

interface ParameterCache {
  [key: string]: {
    value: string;
    expiry: number;
  };
}

const parameterCache: ParameterCache = {};

export const parameterStore = (options: ParameterStoreOptions = {}): middy.MiddlewareObject<any, any> => {
    const {
        cache = true,
        cacheExpiryInMs = 60 * 60 * 1000, // 1 hour
        parameterNames,
        path,
        recursive = true,
        setToContext = true,
    } = options;

    const client = new SSMClient({});

    const getParameters = async (names: string[]): Promise<Record<string, string>> => {
        const now = Date.now();
        const result: Record<string, string> = {};
        const namesToFetch: string[] = [];

        // Check cache first if enabled
        if (cache) {
            for (const name of names) {
                if (parameterCache[name] && parameterCache[name].expiry > now) {
                    result[name] = parameterCache[name].value;
                } else {
                    namesToFetch.push(name);
                }
            }
        } else {
            namesToFetch.push(...names);
        }

        if (namesToFetch.length === 0) {
            return result;
        }

        try {
            // SSM GetParameters can only handle 10 parameters at a time
            for (let i = 0; i < namesToFetch.length; i += 10) {
                const batch = namesToFetch.slice(i, i + 10);
                const command = new GetParametersCommand({
                    Names: batch,
                    WithDecryption: true,
                });
                const response = await client.send(command);

                response.Parameters?.forEach(param => {
                    if (param.Name && param.Value) {
                        result[param.Name] = param.Value;

                        // Store in cache if enabled
                        if (cache) {
                            parameterCache[param.Name] = {
                                value: param.Value,
                                expiry: now + cacheExpiryInMs,
                            };
                        }
                    }
                });
            }

            return result;
        } catch (error) {
            console.error("Error retrieving parameters:", error);
            throw error;
        }
    };

    const getParametersByPath = async (paramPath: string): Promise<Record<string, string>> => {
        const now = Date.now();
        const result: Record<string, string> = {};

        try {
            let nextToken: string | undefined;

            do {
                const command = new GetParametersByPathCommand({
                    Path: paramPath,
                    Recursive: recursive,
                    WithDecryption: true,
                    NextToken: nextToken,
                });
                const response = await client.send(command);

                response.Parameters?.forEach(param => {
                    if (param.Name && param.Value) {
                        result[param.Name] = param.Value;

                        // Store in cache if enabled
                        if (cache) {
                            parameterCache[param.Name] = {
                                value: param.Value,
                                expiry: now + cacheExpiryInMs,
                            };
                        }
                    }
                });

                nextToken = response.NextToken;
            } while (nextToken);

            return result;
        } catch (error) {
            console.error(`Error retrieving parameters by path ${paramPath}:`, error);
            throw error;
        }
    };

    return {
        before: async (request) => {
            try {
                let parameters: Record<string, string> = {};

                if (parameterNames && parameterNames.length > 0) {
                    parameters = await getParameters(parameterNames);
                }

                if (path) {
                    const pathParameters = await getParametersByPath(path);
                    parameters = { ...parameters, ...pathParameters };
                }

                if (setToContext) {
                    request.context.parameters = parameters;
                }
            } catch (error) {
                console.error("Error in parameter store middleware:", error);
                throw error;
            }
        },
    };
};
