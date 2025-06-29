import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface NetworkingStackProps extends cdk.StackProps {
  cidr?: string;
  maxAzs?: number;
  natGateways?: number;
}

export class NetworkingStack extends cdk.Stack {
    public readonly vpc: ec2.Vpc;

    constructor(scope: Construct, id: string, props: NetworkingStackProps = {}) {
        super(scope, id, props);

        this.vpc = new ec2.Vpc(this, "VPC", {
            cidr: props.cidr || "10.0.0.0/16",
            maxAzs: props.maxAzs || 2,
            natGateways: props.natGateways || 1,
            subnetConfiguration: [
                {
                    name: "public",
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: "private",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
                {
                    name: "isolated",
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
            ],
        });

        // Export VPC and subnet IDs
        new cdk.CfnOutput(this, "VpcId", {
            value: this.vpc.vpcId,
            exportName: `${id}-VpcId`,
        });

        new cdk.CfnOutput(this, "PublicSubnets", {
            value: JSON.stringify(this.vpc.publicSubnets.map(subnet => subnet.subnetId)),
            exportName: `${id}-PublicSubnets`,
        });

        new cdk.CfnOutput(this, "PrivateSubnets", {
            value: JSON.stringify(this.vpc.privateSubnets.map(subnet => subnet.subnetId)),
            exportName: `${id}-PrivateSubnets`,
        });

        new cdk.CfnOutput(this, "IsolatedSubnets", {
            value: JSON.stringify(this.vpc.isolatedSubnets.map(subnet => subnet.subnetId)),
            exportName: `${id}-IsolatedSubnets`,
        });
    }
}
