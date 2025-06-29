import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface DeploymentWorkflowProps extends cdk.StackProps {
  repositoryName: string;
  branchName: string;
  connectionArn: string;
  environments: {
    name: string;
    deploymentRole: string;
    requiresApproval?: boolean;
  }[];
}

export class DeploymentWorkflowStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DeploymentWorkflowProps) {
        super(scope, id, props);

        // Artifact bucket for the pipeline
        const artifactBucket = new s3.Bucket(this, "ArtifactBucket", {
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // Pipeline
        const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
            pipelineName: `${props.repositoryName}-pipeline`,
            artifactBucket,
        });

        // Source stage
        const sourceOutput = new codepipeline.Artifact("SourceCode");
        const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
            actionName: "Source",
            owner: props.repositoryName.split("/")[0],
            repo: props.repositoryName.split("/")[1],
            branch: props.branchName,
            connectionArn: props.connectionArn,
            output: sourceOutput,
        });

        pipeline.addStage({
            stageName: "Source",
            actions: [sourceAction],
        });

        // Build stage
        const buildOutput = new codepipeline.Artifact("BuildOutput");
        const buildProject = new codebuild.PipelineProject(this, "BuildProject", {
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                privileged: true,
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    install: {
                        "runtime-versions": {
                            nodejs: "14.x",
                        },
                        commands: [
                            "npm install -g aws-cdk",
                            "npm ci",
                        ],
                    },
                    build: {
                        commands: [
                            "npm run build",
                            "npm test",
                            "npm run cdk -- synth",
                        ],
                    },
                },
                artifacts: {
                    "base-directory": "cdk.out",
                    files: ["**/*"],
                },
            }),
        });

        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: "Build",
            project: buildProject,
            input: sourceOutput,
            outputs: [buildOutput],
        });

        pipeline.addStage({
            stageName: "Build",
            actions: [buildAction],
        });

        // Deployment stages for each environment
        for (const env of props.environments) {
            const deploymentRole = iam.Role.fromRoleArn(
                this,
                `${env.name}DeploymentRole`,
                env.deploymentRole,
                { mutable: false }
            );

            const deployActions: codepipeline_actions.Action[] = [];

            // Add approval action if required
            if (env.requiresApproval) {
                deployActions.push(
                    new codepipeline_actions.ManualApprovalAction({
                        actionName: `Approve${env.name}Deployment`,
                        runOrder: 1,
                    })
                );
            }

            // Add deployment action
            deployActions.push(
                new codepipeline_actions.CloudFormationCreateUpdateStackAction({
                    actionName: `Deploy${env.name}`,
                    stackName: `${props.repositoryName.split("/")[1]}-${env.name}`,
                    templatePath: buildOutput.atPath("*.template.json"),
                    adminPermissions: false,
                    role: deploymentRole,
                    deploymentRole,
                    runOrder: env.requiresApproval ? 2 : 1,
                })
            );

            pipeline.addStage({
                stageName: `Deploy${env.name}`,
                actions: deployActions,
            });
        }
    }
}
