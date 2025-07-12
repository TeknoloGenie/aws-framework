import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface AuthStackProps extends cdk.StackProps {
  userPoolName: string;
  clientName: string;
  domainPrefix?: string;
  selfSignUpEnabled?: boolean;
  standardAttributes?: {
    email?: {
      required?: boolean;
      mutable?: boolean;
    };
    phoneNumber?: {
      required?: boolean;
      mutable?: boolean;
    };
    givenName?: {
      required?: boolean;
      mutable?: boolean;
    };
    familyName?: {
      required?: boolean;
      mutable?: boolean;
    };
  };
  mfa?: cognito.Mfa;
  passwordPolicy?: {
    minLength?: number;
    requireLowercase?: boolean;
    requireUppercase?: boolean;
    requireDigits?: boolean;
    requireSymbols?: boolean;
  };
}

export class AuthStack extends cdk.Stack {
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;
    public identityPool?: cognito.CfnIdentityPool;

    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id, props);

        // Create Cognito User Pool
        this.userPool = new cognito.UserPool(this, "UserPool", {
            userPoolName: props.userPoolName,
            selfSignUpEnabled: props.selfSignUpEnabled || false,
            autoVerify: {
                email: true,
            },
            standardAttributes: props.standardAttributes || {
                email: {
                    required: true,
                    mutable: true,
                },
            },
            mfa: props.mfa || cognito.Mfa.OPTIONAL,
            passwordPolicy: {
                minLength: props.passwordPolicy?.minLength || 8,
                requireLowercase: props.passwordPolicy?.requireLowercase ?? true,
                requireUppercase: props.passwordPolicy?.requireUppercase ?? true,
                requireDigits: props.passwordPolicy?.requireDigits ?? true,
                requireSymbols: props.passwordPolicy?.requireSymbols ?? true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        // Create User Pool Client
        this.userPoolClient = this.userPool.addClient("UserPoolClient", {
            userPoolClientName: props.clientName,
            authFlows: {
                userPassword: true,
                userSrp: true,
                adminUserPassword: true,
            },
            preventUserExistenceErrors: true,
        });

        // Add domain if specified
        if (props.domainPrefix) {
            this.userPool.addDomain("CognitoDomain", {
                cognitoDomain: {
                    domainPrefix: props.domainPrefix,
                },
            });
        }

        // Export User Pool and Client IDs
        new cdk.CfnOutput(this, "UserPoolId", {
            value: this.userPool.userPoolId,
            exportName: `${id}-UserPoolId`,
        });

        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: this.userPoolClient.userPoolClientId,
            exportName: `${id}-UserPoolClientId`,
        });
    }

    public addIdentityPool(
        identityPoolName: string,
        allowUnauthenticatedIdentities: boolean = false
    ): cognito.CfnIdentityPool {
        this.identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
            identityPoolName,
            allowUnauthenticatedIdentities,
            cognitoIdentityProviders: [
                {
                    clientId: this.userPoolClient.userPoolClientId,
                    providerName: this.userPool.userPoolProviderName,
                },
            ],
        });

        // Create authenticated and unauthenticated roles
        const authenticatedRole = new iam.Role(this, "AuthenticatedRole", {
            assumedBy: new iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                {
                    StringEquals: {
                        "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                    },
                },
                "sts:AssumeRoleWithWebIdentity"
            ),
        });

        const unauthenticatedRole = new iam.Role(this, "UnauthenticatedRole", {
            assumedBy: new iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                {
                    StringEquals: {
                        "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "unauthenticated",
                    },
                },
                "sts:AssumeRoleWithWebIdentity"
            ),
        });

        // Attach roles to Identity Pool
        new cognito.CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
            identityPoolId: this.identityPool.ref,
            roles: {
                authenticated: authenticatedRole.roleArn,
                unauthenticated: unauthenticatedRole.roleArn,
            },
        });

        // Export Identity Pool ID
        new cdk.CfnOutput(this, "IdentityPoolId", {
            value: this.identityPool.ref,
            exportName: `${this.stackName}-IdentityPoolId`,
        });

        return this.identityPool;
    }
}
