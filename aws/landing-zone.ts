import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface AwsLandingZoneArgs {
    orgName: string;
    environment: string;
}

export class AwsLandingZone extends pulumi.ComponentResource {
    public readonly organizationId: pulumi.Output<string>;
    public readonly controlTowerArn: pulumi.Output<string>;

    constructor(name: string, args: AwsLandingZoneArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:aws:LandingZone", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };
        const config = new pulumi.Config();

        // Get organization details
        const organization = aws.organizations.getOrganization({});
        
        // Get existing AWS Organization root from config
        const organizationRootId = config.require("aws.organizationRootId");

        // Create AWSControlTowerAdmin role required for Control Tower
        const controlTowerAdminRole = new aws.iam.Role("aws-control-tower-admin", {
            name: "AWSControlTowerAdmin",
            path: "/service-role/",
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Principal: {
                        Service: "controltower.amazonaws.com"
                    },
                    Action: "sts:AssumeRole"
                }]
            }),
            inlinePolicies: [{
                name: "AWSControlTowerAdminInlinePolicy",
                policy: JSON.stringify({
                    Version: "2012-10-17",
                    Statement: [{
                        Effect: "Allow",
                        Action: "ec2:DescribeAvailabilityZones",
                        Resource: "*"
                    }]
                })
            }],
            managedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AWSControlTowerServiceRolePolicy"],
            tags: {
                Name: "AWSControlTowerAdmin",
                Purpose: "Control Tower service role",
                Environment: args.environment
            }
        }, defaultResourceOptions);

        const controlTowerStackSetRole = new aws.iam.Role("aws-control-tower-stackset-role", {
            name: "AWSControlTowerStackSetRole",
            path: "/service-role/",
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Principal: {
                        Service: "cloudformation.amazonaws.com"
                    },
                    Action: "sts:AssumeRole"
                }]
            }),
            inlinePolicies: [
                {
                    name: "execution",
                    policy: `
                            {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Action": [
                                    "sts:AssumeRole"
                                ],
                                "Resource": [
                                    "arn:aws:iam::*:role/AWSControlTowerExecution"
                                ],
                                "Effect": "Allow"
                            }
                        ]
                    }`
                }
            ],
            tags: {
                Name: "AWSControlTowerAdmin",
                Purpose: "Control Tower stackset role",
                Environment: args.environment
            }
        }, defaultResourceOptions);

        const controlTowerCloudTrailRole = new aws.iam.Role("aws-control-tower-cloudtrail-role", {
            name: "AWSControlTowerCloudTrailRole",
            path: "/service-role/",
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Principal: {
                        Service: "cloudtrail.amazonaws.com"
                    },
                    Action: "sts:AssumeRole"
                }]
            }),
            inlinePolicies: [
                {
                    name: "execution",
                    policy: `
                    {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Action": "logs:CreateLogStream",
                                "Resource": "arn:aws:logs:*:*:log-group:aws-controltower/CloudTrailLogs:*",
                                "Effect": "Allow"
                            },
                            {
                                "Action": "logs:PutLogEvents",
                                "Resource": "arn:aws:logs:*:*:log-group:aws-controltower/CloudTrailLogs:*",
                                "Effect": "Allow"
                            }
                        ]
                    }`
                }
            ],
            tags: {
                Name: "AWSControlTowerAdmin",
                Purpose: "Control Tower stackset role",
                Environment: args.environment
            }
        }, defaultResourceOptions);

        const loggingAccount = new aws.organizations.Account("org-logs-account", {
            name: `${args.orgName}-logs-${args.environment}`,
            email: `jconnell+aws-logs-${args.environment}@pulumi.com`,
            roleName: "OrganizationalAccountAccessRole",
        }, defaultResourceOptions);

        const securityAccount = new aws.organizations.Account("org-security-account", {
            name: `${args.orgName}-security-${args.environment}`,
            email: `jconnell+aws-shared-services-${args.environment}@pulumi.com`,
            roleName: "OrganizationalAccountAccessRole",
        }, defaultResourceOptions);

        // Set up AWS Control Tower Landing Zone
        const controlTowerLandingZone = new aws.controltower.LandingZone("control-tower-landing-zone", {

            manifestJson: pulumi.jsonStringify({
                governedRegions: ["us-east-1", "us-west-2"],
                organizationStructure: {
                    security: {
                        name: "Security"
                    },
                    sandbox: {
                        name: "Workloads"
                    }
                },
                centralizedLogging: {
                    accountId: loggingAccount.id,
                    configurations: {
                        loggingBucket: {
                            retentionDays: 365
                        },
                        accessLoggingBucket: {
                            retentionDays: 365
                        },
                    },
                    enabled: true
                },
                securityRoles: {
                    accountId:  securityAccount.id,
                },
                accessManagement: {
                    enabled: true
                }
            }),
            version: "3.3",
            tags: {
                Name: `${args.orgName}-control-tower`,
                Environment: args.environment,
                Purpose: "landing-zone"
            }
        }, { dependsOn: [controlTowerAdminRole], ...defaultResourceOptions});

        //Get the OUs created by Control Tower
        const securityOU = controlTowerLandingZone.arn.apply(async (arn) => {
            // Control Tower automatically creates Security OU
            const orgData = await aws.organizations.getOrganization({});
            const ous = await aws.organizations.getOrganizationalUnits({
                parentId: orgData.roots[0].id
            });
            return ous.children?.find(ou => ou.name === "Security")?.id || organizationRootId;
        });

        const sandboxOU = controlTowerLandingZone.arn.apply(async (arn) => {
            // Control Tower automatically creates Sandbox OU  
            const orgData = await aws.organizations.getOrganization({});
            const ous = await aws.organizations.getOrganizationalUnits({
                parentId: orgData.roots[0].id
            });
            return ous.children?.find(ou => ou.name === "Sandbox")!;
        });

        const infrastructureOU = new aws.organizations.OrganizationalUnit("infrastructure-ou", {
            name: "Infrastructure", 
            parentId: organizationRootId,
        }, { dependsOn: [], ...defaultResourceOptions });


        const networkingAccount = new aws.organizations.Account("networking-account", {
            name: `${args.orgName}-networking-${args.environment}`,
            email: `jconnell+aws-networking-${args.environment}@pulumi.com`,
            roleName: "OrganizationalAccountAccessRole",
            parentId: infrastructureOU.id,
        }, defaultResourceOptions);

        // // Enable Control Tower Controls (Guardrails)
        const regionRestrictControl = new aws.controltower.ControlTowerControl("region-restrict-control", {
            controlIdentifier: "arn:aws:controltower:us-east-1::control/AWS-GR_REGION_DENY",
            targetIdentifier: sandboxOU.arn,
            parameters: [{
                key: "AllowedRegions", 
                value: JSON.stringify(["us-east-1", "us-west-2", "eu-west-1"])
            }]
        }, { dependsOn: [], ...defaultResourceOptions });

        const s3EncryptionControl = new aws.controltower.ControlTowerControl("s3-encryption-control", {
            controlIdentifier: "arn:aws:controltower:us-east-1::control/AWS-GR_S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED",
            targetIdentifier: sandboxOU.arn,
        }, { dependsOn: [], ...defaultResourceOptions });

        const rootAccessKeyControl = new aws.controltower.ControlTowerControl("root-access-key-control", {
            controlIdentifier: "arn:aws:controltower:us-east-1::control/AWS-GR_ROOT_ACCESS_KEY_CHECK",
            targetIdentifier: sandboxOU.arn,
        }, { dependsOn: [], ...defaultResourceOptions });

        const mfaEnabledControl = new aws.controltower.ControlTowerControl("mfa-enabled-control", {
            controlIdentifier: "arn:aws:controltower:us-east-1::control/AWS-GR_MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS",
            targetIdentifier: sandboxOU.arn,
        }, { dependsOn: [], ...defaultResourceOptions });

        // Create Core Accounts
        const sharedServicesAccount = new aws.organizations.Account("shared-services-account", {
            name: `${args.orgName}-shared-services-${args.environment}`,
            email: `jconnell+aws-shared-services-2-${args.environment}@pulumi.com`,
            roleName: "OrganizationalAccountAccessRole",
            parentId: infrastructureOU.id,
        }, { parent: infrastructureOU });

        // Create Production and Development accounts
        const prodAccount = new aws.organizations.Account("prod-account", {
            name: `${args.orgName}-prod-${args.environment}`,
            email: `jconnell+aws-prod-${args.environment}@pulumi.com`,
            parentId: sandboxOU.id,
        }, defaultResourceOptions);

        const devAccount = new aws.organizations.Account("dev-account", {
            name: `${args.orgName}-dev-${args.environment}`,
            email: `jconnell+aws-dev-${args.environment}@pulumi.com`,
            parentId: sandboxOU.id,
        }, defaultResourceOptions);

        // create a new provider instance for the networking account, assuming 
        const networkingAccountProvider = new aws.Provider("testAccountProvider", {
            allowedAccountIds: [networkingAccount.id],
            assumeRoles: [{
                roleArn: pulumi.interpolate`arn:aws:iam::${devAccount.id}:role/OrganizationalAccountAccessRole`,
            }],
        });

        // Control Tower handles governance through guardrails instead of manual SCPs

        // Shared VPC Configuration in Networking Account
        // This VPC will be owned by the networking account and shared with prod/dev accounts
        const sharedVpc = new awsx.ec2.Vpc("shared-vpc", {
            cidrBlock: "10.0.0.0/16",
            numberOfAvailabilityZones: 3,
            subnetStrategy: "Auto",
            subnetSpecs: [
                { type: "Public", cidrMask: 24 },
                { type: "Private", cidrMask: 24 },
            ],
            tags: {
                Name: `${args.orgName}-shared-vpc`,
                Environment: "shared",
                Account: "networking",
                Purpose: "shared-networking"
            }
        }, { provider: networkingAccountProvider, parent: networkingAccount, ...defaultResourceOptions});

        // // Enable VPC sharing from networking account to production account
        const vpcSharingProd = new aws.ec2.VpcEndpointServiceAllowedPrinciple("vpc-sharing-prod", {
            vpcEndpointServiceId: sharedVpc.vpcId, // This will need to be updated for actual VPC sharing
            principalArn: prodAccount.arn,
        }, { provider: networkingAccountProvider, parent: sharedVpc, dependsOn: [prodAccount]});

        // // Enable VPC sharing from networking account to development account
        const vpcSharingDev = new aws.ec2.VpcEndpointServiceAllowedPrinciple("vpc-sharing-dev", {
            vpcEndpointServiceId: sharedVpc.vpcId, // This will need to be updated for actual VPC sharing
            principalArn: devAccount.arn,
        }, { provider: networkingAccountProvider, parent: sharedVpc, dependsOn: [devAccount]});

        // // RAM (Resource Access Manager) resources for proper VPC sharing
        const vpcResourceShare = new aws.ram.ResourceShare("vpc-resource-share", {
            name: `${args.orgName}-vpc-share`,
            region: aws.config.region,
            allowExternalPrincipals: false,
            tags: {
                Name: `${args.orgName}-vpc-share`,
                Environment: args.environment,
                Purpose: "vpc-sharing"
            }
        }, { provider: networkingAccountProvider, parent: this, dependsOn: [sharedVpc]});

        // // Associate the VPC subnets with the resource share
        const vpcSubnetAssociations = sharedVpc.privateSubnetIds.apply(subnetIds => 
            subnetIds.map((subnetId, index) => 
                new aws.ram.ResourceAssociation(`vpc-subnet-association-${index}`, {
                    resourceArn: pulumi.interpolate`arn:aws:ec2:${aws.config.region}:${aws.getCallerIdentity().then(id => id.accountId)}:subnet/${subnetId}`,
                    resourceShareArn: vpcResourceShare.arn,
                }, defaultResourceOptions)
            )
        );

        // // Share with production account
        const prodAccountAssociation = new aws.ram.PrincipalAssociation("prod-account-association", {
            principal: prodAccount.id,
            resourceShareArn: vpcResourceShare.arn,
        },{ provider: networkingAccountProvider });

        // // Share with development account
        const devAccountAssociation = new aws.ram.PrincipalAssociation("dev-account-association", {
            principal: devAccount.id,
            resourceShareArn: vpcResourceShare.arn,
        }, { provider: networkingAccountProvider });

        // Create dedicated security groups for each environment in the shared VPC
        const prodSecurityGroup = new aws.ec2.SecurityGroup("prod-security-group", {
            name: `${args.orgName}-prod-sg`,
            description: "Security group for production workloads in shared VPC",
            vpcId: sharedVpc.vpcId,
            ingress: [{
                description: "HTTPS",
                fromPort: 443,
                toPort: 443,
                protocol: "tcp",
                cidrBlocks: ["10.0.0.0/16"],
            }, {
                description: "HTTP",
                fromPort: 80,
                toPort: 80,
                protocol: "tcp",
                cidrBlocks: ["10.0.0.0/16"],
            }],
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"],
            }],
            tags: {
                Name: `${args.orgName}-prod-sg`,
                Environment: "production",
                Account: "production"
            }
        }, { provider: networkingAccountProvider });

        const devSecurityGroup = new aws.ec2.SecurityGroup("dev-security-group", {
            name: `${args.orgName}-dev-sg`,
            description: "Security group for development workloads in shared VPC",
            vpcId: sharedVpc.vpcId,
            ingress: [{
                description: "All internal traffic for development",
                fromPort: 0,
                toPort: 65535,
                protocol: "tcp",
                cidrBlocks: ["10.0.0.0/16"],
            }],
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"],
            }],
            tags: {
                Name: `${args.orgName}-dev-sg`,
                Environment: "development",
                Account: "development"
            }
        }, { provider: networkingAccountProvider });

        // Set outputs
        this.organizationId = pulumi.output(organization).apply(org => org.id);
        this.controlTowerArn = controlTowerLandingZone.arn;
    }
}