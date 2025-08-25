import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface SecurityArgs {
  orgName: string;
  platformFolderId: pulumi.Input<string>;
  billingAccount: string;
}

export class Security extends pulumi.ComponentResource {
  public readonly projectId: pulumi.Output<string>;
  public readonly projectName: pulumi.Output<string>;
  public readonly projectNumber: pulumi.Output<string>;
  public readonly folderId: pulumi.Output<string>;

  constructor(
    name: string,
    args: SecurityArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:gcp:Security", name, {}, opts);

    // Create security folder
    const securityFolder = new gcp.organizations.Folder(
      "security-folder",
      {
        displayName: "Security",
        deletionProtection: false,
        parent: args.platformFolderId,
      },
      { parent: this }
    );

    // Create security project
    const securityProject = new gcp.organizations.Project(
      "security",
      {
        name: `${args.orgName.toLowerCase()}-security`,
        folderId: securityFolder.name,
        billingAccount: args.billingAccount,
        deletionPolicy: "DELETE",
        labels: {
          purpose: "platform-security",
        },
      },
      { parent: securityFolder }
    );

    // Enable Cloud KMS API for encryption services
    const kmsApiSecurity = new gcp.projects.Service(
      "kms-api-security",
      {
        project: securityProject.projectId,
        service: "cloudkms.googleapis.com",
      },
      { parent: securityProject }
    );

    // Cloud KMS for encryption
    const keyRing = new gcp.kms.KeyRing(
      "keyring",
      {
        name: `${args.orgName.toLowerCase()}-keyring`,
        project: securityProject.projectId,
        location: "us-central1",
      },
      { parent: securityProject, dependsOn: [kmsApiSecurity] }
    );

    // Set outputs
    this.projectId = securityProject.projectId;
    this.projectName = securityProject.name;
    this.projectNumber = securityProject.number;
    this.folderId = securityFolder.id;

    this.registerOutputs({
      projectId: this.projectId,
      folderId: this.folderId,
      projectName: this.projectName,
      projectNumber: this.projectNumber,
    });
  }
}