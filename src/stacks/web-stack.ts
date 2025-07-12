import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";

export interface WebStackProps extends cdk.StackProps {
  /**
   * The name of the web application
   */
  appName: string;

  /**
   * Path to the built web application files
   */
  buildPath: string;

  /**
   * Custom domain configuration (optional)
   */
  domain?: {
    domainName: string;
    hostedZoneId?: string;
    certificateArn?: string;
  };

  /**
   * CloudFront distribution settings
   */
  cloudFrontSettings?: {
    priceClass?: cloudfront.PriceClass;
    geoRestriction?: cloudfront.GeoRestriction;
    enableLogging?: boolean;
    logBucket?: s3.IBucket;
  };

  /**
   * S3 bucket settings
   */
  bucketSettings?: {
    versioned?: boolean;
    encryption?: s3.BucketEncryption;
    lifecycleRules?: s3.LifecycleRule[];
  };

  /**
   * Single Page Application mode (for React, Vue, Angular apps)
   */
  spaMode?: boolean;

  /**
   * Additional CloudFront behaviors for API integration
   */
  apiBehaviors?: Array<{
    pathPattern: string;
    origin: cloudfront.IOrigin;
    allowedMethods?: cloudfront.AllowedMethods;
    cachePolicy?: cloudfront.ICachePolicy;
  }>;
}

export class WebStack extends cdk.Stack {
    public readonly bucket: s3.Bucket;
    public readonly distribution: cloudfront.Distribution;
    public readonly domainName: string;

    constructor(scope: Construct, id: string, props: WebStackProps) {
        super(scope, id, props);

        // Create S3 bucket for hosting
        this.bucket = new s3.Bucket(this, "WebBucket", {
            bucketName: `${props.appName.toLowerCase()}-web-${this.account}-${this.region}`,
            websiteIndexDocument: "index.html",
            websiteErrorDocument: props.spaMode ? "index.html" : "error.html",
            publicReadAccess: false, // We'll use CloudFront OAC
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: props.bucketSettings?.versioned ?? false,
            encryption: props.bucketSettings?.encryption ?? s3.BucketEncryption.S3_MANAGED,
            lifecycleRules: props.bucketSettings?.lifecycleRules,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // Create Origin Access Control for CloudFront
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: `OAC for ${props.appName}`,
        });

        // Create CloudFront distribution
        const behaviors: Record<string, cloudfront.BehaviorOptions> = {
            "/": {
                origin: new origins.S3Origin(this.bucket, {
                    originAccessControlId: oac.originAccessControlId,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                compress: true,
            },
        };

        // Add API behaviors if provided
        if (props.apiBehaviors) {
            props.apiBehaviors.forEach((behavior, index) => {
                behaviors[behavior.pathPattern] = {
                    origin: behavior.origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: behavior.allowedMethods ?? cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: behavior.cachePolicy ?? cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
                };
            });
        }

        // Handle custom domain and certificate
        let certificate: certificatemanager.ICertificate | undefined;
        if (props.domain) {
            if (props.domain.certificateArn) {
                certificate = certificatemanager.Certificate.fromCertificateArn(
                    this,
                    "Certificate",
                    props.domain.certificateArn
                );
            } else {
                certificate = new certificatemanager.Certificate(this, "Certificate", {
                    domainName: props.domain.domainName,
                    validation: certificatemanager.CertificateValidation.fromDns(),
                });
            }
        }

        this.distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: behaviors["/"],
            additionalBehaviors: Object.fromEntries(
                Object.entries(behaviors).filter(([key]) => key !== "/")
            ),
            domainNames: props.domain ? [props.domain.domainName] : undefined,
            certificate,
            priceClass: props.cloudFrontSettings?.priceClass ?? cloudfront.PriceClass.PRICE_CLASS_100,
            geoRestriction: props.cloudFrontSettings?.geoRestriction,
            enableLogging: props.cloudFrontSettings?.enableLogging ?? false,
            logBucket: props.cloudFrontSettings?.logBucket,
            errorResponses: props.spaMode ? [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                },
            ] : undefined,
        });

        // Grant CloudFront access to S3 bucket
        this.bucket.addToResourcePolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: ["s3:GetObject"],
                resources: [this.bucket.arnForObjects("*")],
                principals: [new cdk.aws_iam.ServicePrincipal("cloudfront.amazonaws.com")],
                conditions: {
                    StringEquals: {
                        "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
                    },
                },
            })
        );

        // Deploy website files
        new s3deploy.BucketDeployment(this, "DeployWebsite", {
            sources: [s3deploy.Source.asset(props.buildPath)],
            destinationBucket: this.bucket,
            distribution: this.distribution,
            distributionPaths: ["/*"],
        });

        // Create Route53 record if domain is provided
        if (props.domain) {
            const hostedZone = props.domain.hostedZoneId
                ? route53.HostedZone.fromHostedZoneId(this, "HostedZone", props.domain.hostedZoneId)
                : route53.HostedZone.fromLookup(this, "HostedZone", {
                    domainName: props.domain.domainName,
                });

            new route53.ARecord(this, "AliasRecord", {
                zone: hostedZone,
                recordName: props.domain.domainName,
                target: route53.RecordTarget.fromAlias(
                    new targets.CloudFrontTarget(this.distribution)
                ),
            });

            this.domainName = props.domain.domainName;
        } else {
            this.domainName = this.distribution.distributionDomainName;
        }

        // Outputs
        new cdk.CfnOutput(this, "WebsiteURL", {
            value: `https://${this.domainName}`,
            description: "Website URL",
        });

        new cdk.CfnOutput(this, "DistributionId", {
            value: this.distribution.distributionId,
            description: "CloudFront Distribution ID",
        });

        new cdk.CfnOutput(this, "BucketName", {
            value: this.bucket.bucketName,
            description: "S3 Bucket Name",
        });
    }

    /**
   * Add API integration to the CloudFront distribution
   */
    public addApiIntegration(pathPattern: string, apiOrigin: cloudfront.IOrigin): void {
    // This would require recreating the distribution, so it's better to provide this during construction
        throw new Error("API integrations should be provided during stack construction via apiBehaviors prop");
    }
}
