# NetworkingStack

The `NetworkingStack` class provides a CDK construct for creating and configuring a VPC with public, private, and isolated subnets.

## Overview

This class simplifies the creation of a well-structured VPC with sensible defaults for subnet configuration, NAT gateways, and availability zones. It also exports the VPC and subnet IDs for use in other stacks.

## Class Definition

```typescript
export class NetworkingStack extends cdk.Stack
```

## Constructor

```typescript
constructor(scope: Construct, id: string, props: NetworkingStackProps = {})
```

### NetworkingStackProps Interface

```typescript
export interface NetworkingStackProps extends cdk.StackProps {
  cidr?: string;       // Default: '10.0.0.0/16'
  maxAzs?: number;     // Default: 2
  natGateways?: number; // Default: 1
}
```

## Properties

- `vpc: ec2.Vpc`
  The VPC instance.

## Subnet Configuration

The VPC is created with three types of subnets:

1. **Public Subnets**: Accessible from the internet, with a route to an Internet Gateway
2. **Private Subnets**: Not directly accessible from the internet, but with outbound internet access via NAT Gateway
3. **Isolated Subnets**: No internet access (inbound or outbound), typically used for databases

## Usage Example

```typescript
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack } from 'aws-framework';

const app = new cdk.App();

// Create networking stack with default settings
const networkingStack = new NetworkingStack(app, 'NetworkingStack');

// Create networking stack with custom settings
const customNetworkingStack = new NetworkingStack(app, 'CustomNetworkingStack', {
  cidr: '172.16.0.0/16',
  maxAzs: 3,
  natGateways: 2
});
```

## Using the VPC in Other Stacks

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { NetworkingStack } from 'aws-framework';

const app = new cdk.App();

// Create networking stack
const networkingStack = new NetworkingStack(app, 'NetworkingStack');

// Create a database stack that uses the VPC
class DatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a database in the isolated subnets
    const dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MEDIUM
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      }
    });
  }
}

const dbStack = new DatabaseStack(app, 'DatabaseStack', networkingStack.vpc);
```

## CloudFormation Outputs

The stack exports the following CloudFormation outputs:

- `VpcId`: The ID of the created VPC
- `PublicSubnets`: JSON array of public subnet IDs
- `PrivateSubnets`: JSON array of private subnet IDs
- `IsolatedSubnets`: JSON array of isolated subnet IDs

## Best Practices

- Use the default settings for simple applications
- Increase `maxAzs` for higher availability
- Increase `natGateways` for higher availability but be aware of the cost implications
- Use the isolated subnets for databases and other resources that don't need internet access
- Use the private subnets for application servers that need outbound internet access
- Use the public subnets only for resources that need to be directly accessible from the internet