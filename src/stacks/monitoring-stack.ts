import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface MonitoringStackProps extends cdk.StackProps {
  alarmEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
    public readonly alarmTopic: sns.Topic;

    constructor(scope: Construct, id: string, props: MonitoringStackProps = {}) {
        super(scope, id, props);

        // Create SNS topic for alarms
        this.alarmTopic = new sns.Topic(this, "AlarmTopic", {
            displayName: "Alarm Notifications",
        });

        // Add email subscription if provided
        if (props.alarmEmail) {
            this.alarmTopic.addSubscription(
                new subscriptions.EmailSubscription(props.alarmEmail)
            );
        }

        // Export the SNS topic ARN
        new cdk.CfnOutput(this, "AlarmTopicArn", {
            value: this.alarmTopic.topicArn,
            exportName: `${id}-AlarmTopicArn`,
        });
    }

    public createLambdaErrorAlarm(
        lambdaFunction: lambda.Function,
        threshold: number = 1
    ): cloudwatch.Alarm {
        const alarm = new cloudwatch.Alarm(this, `${lambdaFunction.node.id}ErrorAlarm`, {
            metric: lambdaFunction.metricErrors({
                period: cdk.Duration.minutes(1),
            }),
            threshold,
            evaluationPeriods: 1,
            alarmDescription: `Error alarm for ${lambdaFunction.functionName}`,
            actionsEnabled: true,
        });

        alarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

        return alarm;
    }

    public createLambdaDurationAlarm(
        lambdaFunction: lambda.Function,
        thresholdMillis: number
    ): cloudwatch.Alarm {
        const alarm = new cloudwatch.Alarm(this, `${lambdaFunction.node.id}DurationAlarm`, {
            metric: lambdaFunction.metricDuration({
                period: cdk.Duration.minutes(1),
                statistic: "p95",
            }),
            threshold: thresholdMillis,
            evaluationPeriods: 3,
            datapointsToAlarm: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: `Duration alarm for ${lambdaFunction.functionName}`,
            actionsEnabled: true,
        });

        alarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

        return alarm;
    }

    public createDashboard(
        dashboardName: string,
        lambdaFunctions: lambda.Function[]
    ): cloudwatch.Dashboard {
        const dashboard = new cloudwatch.Dashboard(this, dashboardName, {
            dashboardName,
        });

        // Add Lambda metrics to dashboard
        const widgets: cloudwatch.IWidget[] = [];

        for (const func of lambdaFunctions) {
            widgets.push(
                new cloudwatch.GraphWidget({
                    title: `${func.functionName} Invocations and Errors`,
                    left: [func.metricInvocations(), func.metricErrors()],
                    width: 12,
                })
            );

            widgets.push(
                new cloudwatch.GraphWidget({
                    title: `${func.functionName} Duration`,
                    left: [func.metricDuration()],
                    width: 12,
                })
            );
        }

        dashboard.addWidgets(...widgets);

        return dashboard;
    }
}
