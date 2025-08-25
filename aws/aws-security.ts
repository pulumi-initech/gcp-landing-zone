import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface AwsSecurityArgs {
    orgName: string;
    environment: string;
}

export class AwsSecurity extends pulumi.ComponentResource {
    public readonly guardDutyId: pulumi.Output<string>;
    public readonly securityHubId: pulumi.Output<string>;
    public readonly configRuleIds: pulumi.Output<string[]>;

    constructor(name: string, args: AwsSecurityArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:aws:Security", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

        // AWS GuardDuty
        const guardDuty = new aws.guardduty.Detector("guardduty", {
            enable: true,
            findingPublishingFrequency: "FIFTEEN_MINUTES",
        }, defaultResourceOptions);

        // AWS Security Hub
        const securityHub = new aws.securityhub.Account("security-hub", {
            enableDefaultStandards: true,
        }, defaultResourceOptions);
                            
        // AWS Config for compliance monitoring
        const configBucket = new aws.s3.Bucket("config-bucket", {
            bucket: pulumi.interpolate`${args.orgName.toLowerCase()}-aws-config-${args.environment}`,
            versioning: { enabled: true },
            serverSideEncryptionConfiguration: {
                rule: {
                    applyServerSideEncryptionByDefault: {
                        sseAlgorithm: "AES256",
                    },
                },
            },
        }, defaultResourceOptions);

        const configRole = new aws.iam.Role("config-role", {
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    Principal: {
                        Service: "config.amazonaws.com"
                    }
                }]
            }),
        }, defaultResourceOptions);


        new aws.iam.RolePolicyAttachment("config-role-policy", {
            role: configRole.name,
            policyArn: "arn:aws:iam::aws:policy/service-role/ConfigRole",
        }, defaultResourceOptions);

        const configurationRecorder = new aws.cfg.Recorder("recorder", {
            name: "main-recorder",
            roleArn: configRole.arn,
            recordingGroup: {
                allSupported: true,
                includeGlobalResourceTypes: true,
            },
        }, defaultResourceOptions);

        const deliveryChannel = new aws.cfg.DeliveryChannel("delivery-channel", {
            name: "main-delivery-channel",
            s3BucketName: configBucket.bucket,
        }, defaultResourceOptions);
        

        // AWS Config Rules for CIS benchmarks
        const s3PublicAccessRule = new aws.cfg.Rule("s3-bucket-public-access-prohibited", {
            name: "s3-bucket-public-access-prohibited",
            source: {
                owner: "AWS",
                sourceIdentifier: "S3_BUCKET_PUBLIC_ACCESS_PROHIBITED",
            },
        }, defaultResourceOptions);

        const rootAccessKeyRule = new aws.cfg.Rule("root-access-key-check", {
            name: "root-access-key-check",
            source: {
                owner: "AWS",
                sourceIdentifier: "ROOT_ACCESS_KEY_CHECK",
            },
        }, defaultResourceOptions);

        const mfaEnabledRule = new aws.cfg.Rule("mfa-enabled-for-iam-console-access", {
            name: "mfa-enabled-for-iam-console-access",
            source: {
                owner: "AWS",
                sourceIdentifier: "MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS",
            },
        }, defaultResourceOptions);

        this.guardDutyId = guardDuty.id;
        this.securityHubId = securityHub.id;
        this.configRuleIds = pulumi.all([
            s3PublicAccessRule.id,
            rootAccessKeyRule.id,
            mfaEnabledRule.id
        ]);

        this.registerOutputs({
            guardDutyId: this.guardDutyId,
            securityHubId: this.securityHubId,
            configRuleIds: this.configRuleIds,
        });
    }
}