import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { LzNetworking } from "./networking";
import { Environment } from "./environment";
import { SharedServices } from "./shared-services";
import { Security } from "./security";
import { EnvironmentSpec } from "./networking";

export interface GcpLandingZoneArgs {
  orgName: string;
  landingZoneFolder: string;
}

export class GcpLandingZone extends pulumi.ComponentResource {
  public readonly folderIds: pulumi.Output<{ [key: string]: string }>;
  public readonly projectNumbers: pulumi.Output<{ [key: string]: string }>;

  constructor(
    name: string,
    args: GcpLandingZoneArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:gcp:LandingZone", name, {}, opts);

    const config = new pulumi.Config();
    const billingAccount = config.require("billingAccount");
    const environments = config.requireObject<string[]>("environments");

    // Get organization details
    const organization = gcp.organizations.getOrganization({
      domain: `${args.orgName.toLowerCase()}.com`,
    });

    const lz = new gcp.organizations.Folder(
      "landing-zone-folder",
      {
        displayName: "Landing Zone Root",
        parent: args.landingZoneFolder,
        deletionProtection: false,
      },
      { parent: this }
    );

    // Create Folder structure
    const platformFolder = new gcp.organizations.Folder(
      "platform-folder",
      {
        displayName: "Platform",
        parent: lz.name,
        deletionProtection: false,
      },
      { parent: lz }
    );

    const sharedServices = new SharedServices(
      "lz-shared-services",
      {
        orgName: args.orgName,
        parentFolder: platformFolder.name,
        billingAccount: billingAccount,
      },
      { parent: platformFolder }
    );
  
    const security = new Security(
      "lz-security",
      {
        orgName: args.orgName,
        platformFolderId: platformFolder.name,
        billingAccount: billingAccount,
      },
      { parent: platformFolder }
    );


    // LZ Workloads for each environment
    const workloadsFolder = new gcp.organizations.Folder(
      "lz-workloads-folder",
      {
        displayName: "Workloads",
        parent: lz.name,
        deletionProtection: false,
      },
      { parent: lz }
    );

    const environmentProjects: EnvironmentSpec[] = [];
    for (const env of environments) {
      const envInstance = new Environment(
        `${env}`,
        {
          orgName: args.orgName,
          billingAccount: billingAccount,
          environment: env,
          workloadsFolderId: workloadsFolder.name,
        },
        { parent: workloadsFolder }
      );
      environmentProjects.push({
        name: env,
        projectId: envInstance.projectId,
        projectNumber: envInstance.projectNumber,
      });
    }
  
    const networking = new LzNetworking(
      "lz-networking",
      {
        orgName: args.orgName,
        billingAccount: billingAccount,
        platformFolderId: platformFolder.name,
        sharedServicesProjectId: sharedServices.projectId,
        sharedServicesProjectNumber: sharedServices.projectNumber,
        environmentProjects: environmentProjects,
      },
      { parent: platformFolder }
    );

    // Set outputs
    this.folderIds = pulumi
      .all([
        platformFolder.name,
        workloadsFolder.name,
        networking.folderId,
        sharedServices.folderId,
        security.folderId,
      ])
      .apply(
        ([
          platform,
          workloads,
          networkingFolder,
          sharedServicesFolder,
          securityFolder,
        ]) => {
          return {
            platform: platform,
            workloads: workloads,
            networking: networkingFolder,
            "shared-services": sharedServicesFolder,
            security: securityFolder,
          } as { [key: string]: string };
        }
      );

    // Build project ID to project number mapping
    this.projectNumbers = pulumi
      .all({
        networking: pulumi.all([networking.projectId, networking.projectNumber]),
        sharedServices: pulumi.all([sharedServices.projectId, sharedServices.projectNumber]),
        security: pulumi.all([security.projectId, security.projectNumber]),
        ...Object.fromEntries(
          environmentProjects.map(env => [
            env.name, 
            pulumi.all([env.projectId, env.projectNumber])
          ])
        ),
      })
      .apply(results => {
        const projectMap: { [projectId: string]: string } = {};
        Object.values(results).forEach(([projectId, projectNumber]) => {
          projectMap[projectId] = projectNumber;
        });
        return projectMap;
      });

    this.registerOutputs({
      folderIds: this.folderIds,
      projectNumbers: this.projectNumbers,
    });
  }
}
