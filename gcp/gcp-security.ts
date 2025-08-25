import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface GcpSecurityArgs {
    orgName: string;
    securityProjectId: string;
    landingZoneProjects: string[];
    environment: string;
}

export class GcpSecurity extends pulumi.ComponentResource {
    public readonly securityProjectId: pulumi.Output<string>;
    public readonly notificationTopicId: pulumi.Output<string>;
    public readonly securityScannerIds: pulumi.Output<string[]>;

    constructor(name: string, args: GcpSecurityArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:gcp:Security", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

        // Enable Security APIs in the security project
        const binaryAuthApi = new gcp.projects.Service("binary-auth-api", {
            project: args.securityProjectId,
            service: "binaryauthorization.googleapis.com",
        }, defaultResourceOptions);

        const securityScannerApi = new gcp.projects.Service("security-scanner-api", {
            project: args.securityProjectId,
            service: "websecurityscanner.googleapis.com",
        }, defaultResourceOptions);

        const cloudFunctionsApi = new gcp.projects.Service("cloud-functions-api", {
            project: args.securityProjectId,
            service: "cloudfunctions.googleapis.com",
        }, defaultResourceOptions);

        const pubsubApi = new gcp.projects.Service("pubsub-api", {
            project: args.securityProjectId,
            service: "pubsub.googleapis.com",
        }, defaultResourceOptions);


        // Pub/Sub topic for security notifications within the landing zone
        const securityNotificationTopic = new gcp.pubsub.Topic("security-notifications", {
            project: args.securityProjectId,
            name: `${args.orgName.toLowerCase()}-security-notifications`,
            labels: {
                environment: args.environment,
                purpose: "landing-zone-security"
            }
        }, { dependsOn: [pubsubApi], ...defaultResourceOptions });

        // Security Center sources for landing zone projects

        // IAM Security Policies for landing zone projects
        args.landingZoneProjects.forEach((projectId, index) => {
            // Enforce least privilege IAM bindings
            new gcp.projects.IAMBinding(`security-iam-${index}`, {
                project: projectId,
                role: "roles/securitycenter.findingsEditor",
                members: [`serviceAccount:security-scanner@${args.securityProjectId}.iam.gserviceaccount.com`],
            }, defaultResourceOptions);
        });

        // Set outputs
        this.securityProjectId = pulumi.output(args.securityProjectId);
        this.notificationTopicId = securityNotificationTopic.id;

        this.registerOutputs({
            securityProjectId: this.securityProjectId,
            notificationTopicId: this.notificationTopicId,
            securityScannerIds: this.securityScannerIds,
        });
    }
}