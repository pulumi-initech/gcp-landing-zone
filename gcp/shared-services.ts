import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { GcpMonitoring } from "./gcp-monitoring";

export interface SharedServicesArgs {
  orgName: string;
  parentFolder: pulumi.Input<string>;
  billingAccount: string;
}

export class SharedServices extends pulumi.ComponentResource {
  public readonly projectId: pulumi.Output<string>;
  public readonly projectNumber: pulumi.Output<string>;
  public readonly projectName: pulumi.Output<string>;
  public readonly folderId: pulumi.Output<string>;

  constructor(
    name: string,
    args: SharedServicesArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:gcp:SharedServices", name, {}, opts);

    const sharedServicesFolder = new gcp.organizations.Folder(
      "shared-services-folder",
      {
        displayName: "Shared Services",
        parent: args.parentFolder,
        deletionProtection: false,
      },
      { parent: this }
    );

    // Create shared services project
    const sharedServicesProject = new gcp.organizations.Project(
      "shared-services",
      {
        name: `${args.orgName.toLowerCase()}-shared-services`,
        folderId: sharedServicesFolder.name,
        billingAccount: args.billingAccount,
        deletionPolicy: "DELETE",
        labels: {
          purpose: "platform-shared-services",
        },
      },
      { parent: sharedServicesFolder }
    );

    // Enable Compute API for shared services
    const computeApiShared = new gcp.projects.Service(
      "compute-api-shared",
      {
        project: sharedServicesProject.projectId,
        service: "compute.googleapis.com",
      },
      { parent: sharedServicesProject }
    );

    // Setup monitoring in the shared services project
    const monitoring = new GcpMonitoring(
      "gcp-monitoring",
      {
        orgName: args.orgName,
        monitoringProjectId: sharedServicesProject.projectId,
      },
      { parent: sharedServicesProject }
    );

    // Set outputs
    this.projectId = sharedServicesProject.projectId;
    this.projectNumber = sharedServicesProject.number;
    this.projectName = sharedServicesProject.name;
    this.folderId = sharedServicesFolder.id;

    this.registerOutputs({
      projectId: sharedServicesProject.id,
      projectNumber: sharedServicesProject.number,
      projectName: sharedServicesProject.name,
      folderId: this.folderId,
    });
  }
}
