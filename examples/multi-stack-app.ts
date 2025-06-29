#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApplicationStack } from "../src/stacks/application-stack";

const app = new cdk.App();

// Development Environment
new ApplicationStack(app, "MyApp-Dev", {
    appName: "MyApp",
    environment: "dev",
    alarmEmail: "dev-alerts@example.com",
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});

// Production Environment
new ApplicationStack(app, "MyApp-Prod", {
    appName: "MyApp",
    environment: "prod",
    alarmEmail: "prod-alerts@example.com",
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: "us-east-1",
    },
});
