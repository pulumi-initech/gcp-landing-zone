import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface LzEnvironmentArgs {
  orgName: string;
  environment: string;
  workloadsFolderId: pulumi.Input<string>;
  billingAccount: string;
}

export class LzEnvironment extends pulumi.ComponentResource {
  public readonly folderId: pulumi.Output<string>;
  public readonly project: gcp.organizations.Project;
  public readonly projectId: pulumi.Output<string>;
  public readonly projectName: pulumi.Output<string>;
  public readonly projectNumber: pulumi.Output<string>;

  constructor(
    name: string,
    args: LzEnvironmentArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:gcp:Environment", name, {}, opts);

    // Create environment folder
    const envFolder = new gcp.organizations.Folder(
      `${args.environment}-folder`,
      {
        displayName:
          args.environment.charAt(0).toUpperCase() + args.environment.slice(1),
        parent: args.workloadsFolderId,
        deletionProtection: false,
      },
      { parent: this }
    );

    // Create environment project
    const envProject = new gcp.organizations.Project(
      `${args.environment}`,
      {
        name: `${args.orgName.toLowerCase()}-${args.environment}`,
        folderId: envFolder.name,
        billingAccount: args.billingAccount,
        deletionPolicy: "DELETE",
        labels: {
          environment: args.environment,
          purpose: "workloads",
        },
      },
      { parent: this }
    );

    // Enable Compute API
    const computeApi = new gcp.projects.Service(
      `compute-api-${args.environment}`,
      {
        project: envProject.projectId,
        service: "compute.googleapis.com",
        disableOnDestroy: false,
        disableDependentServices: true,
      },
      { parent: this }
    );

    // Set outputs
    this.folderId = envFolder.id;
    this.project = envProject;
    this.projectId = envProject.projectId;
    this.projectName = envProject.name;
    this.projectNumber = envProject.number;

    this.registerOutputs({
      folderId: this.folderId,
      projectId: this.projectId,
      projectName: this.projectName,
      project: this.project,
      projectNumber: this.projectNumber,
    });
  }
}
