import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface LzNetworkingArgs {
  orgName: string;
  platformFolderId: pulumi.Input<string>;
  billingAccount: pulumi.Input<string>;
  sharedServicesProjectId: pulumi.Input<string>;
  sharedServicesProjectNumber: pulumi.Input<string>;
  environmentProjects?: EnvironmentSpec[];
}

export interface EnvironmentSpec {
  name: string;
  projectId: pulumi.Output<string>;
  projectNumber: pulumi.Output<string>;
}

export class LzNetworking extends pulumi.ComponentResource {
  public readonly projectId: pulumi.Output<string>;
  public readonly projectName: pulumi.Output<string>;
  public readonly projectNumber: pulumi.Output<string>;
  public readonly folderId: pulumi.Output<string>;

  constructor(
    name: string,
    args: LzNetworkingArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:gcp:LzNetworking", name, {}, opts);


    // Create networking folder
    const networkingFolder = new gcp.organizations.Folder(
      "networking-folder",
      {
        displayName: "Networking",
        parent: args.platformFolderId,
        deletionProtection: false,
      },
      { parent: this }
    );

    // Create networking project
    const networkingProject = new gcp.organizations.Project(
      "networking",
      {
        name: `${args.orgName.toLowerCase()}-networking`,
        folderId: networkingFolder.id,
        deletionPolicy: "DELETE",
        billingAccount: args.billingAccount,
        labels: {
          purpose: "platform-networking",
        },
      },
      { parent: networkingFolder }
    );

    // Enable necessary APIs
    const computeApiNetworking = new gcp.projects.Service(
      "compute-api-networking",
      {
        project: networkingProject.projectId,
        service: "compute.googleapis.com",
      },
      { parent: this }
    );

    // Create VPC Networks (Shared VPC model)
    const hostVpc = new gcp.compute.Network(
      "host-vpc",
      {
        name: `${args.orgName.toLowerCase()}-host-vpc`,
        project: networkingProject.projectId,
        autoCreateSubnetworks: false,
        description: "Shared VPC for hosting subnets",
      },
      { parent: networkingProject, dependsOn: [computeApiNetworking] }
    );

    // Enable Shared VPC - Set networking project as host project
    const sharedVpcHost = new gcp.compute.SharedVPCHostProject(
      "shared-vpc-host",
      {
        project: networkingProject.projectId,
      },
      { parent: networkingProject, dependsOn: [hostVpc, computeApiNetworking] }
    );

    let i = 2;
    for (const env of args.environmentProjects || []) {
      // Subnets in different regions
      const envSubnet = new gcp.compute.Subnetwork(
        `${env.name}-subnet`,
        {
          name: `${args.orgName.toLowerCase()}-subnet-${env.name}`,
          project: networkingProject.projectId,
          network: hostVpc.id,
          ipCidrRange: `10.0.${i}.0/24`,
          region: "us-central1",
          description: "Production workloads subnet",
          secondaryIpRanges: [
            {
              rangeName: "pods",
              ipCidrRange: `10.${i}.0.0/16`,
            },
            {
              rangeName: "services",
              ipCidrRange: `10.${i + 1}.0.0/16`,
            },
          ],
        },
        { parent: hostVpc }
      );

      // Attach shared services as SharedVPC service project
      const envdServicesServiceProject =
        new gcp.compute.SharedVPCServiceProject(
          `${env.name}-service-project`,
          {
            hostProject: networkingProject.projectId,
            serviceProject: env.projectNumber,
          },
          {
            parent: sharedVpcHost,
          }
        );

      const envProjectIam = new gcp.projects.IAMBinding(
        `${env.name}-subnet-iam`,
        {
          project: networkingProject.id,
          role: "roles/compute.networkUser",
          members: [
            pulumi.interpolate`serviceAccount:${env.projectNumber}-compute@developer.gserviceaccount.com`,
          ],
        },
        { parent: sharedVpcHost }
      );

    
      // Grant subnet-specific permissions for shared services subnet
      const envSubnetSpecificIAM =
        new gcp.compute.SubnetworkIAMBinding(
          `${env.name}-subnet-specific-iam`,
          {
            project: networkingProject.id.apply(id => id.split("/")[1]),
            region: envSubnet.region,
            subnetwork: envSubnet.name,
            role: "roles/compute.networkUser",
            members: [
              pulumi.interpolate`serviceAccount:${env.projectNumber}-compute@developer.gserviceaccount.com`,
            ],
          },
          { parent: sharedVpcHost }
        );

      i += 2;
    }

    // Shared Services Networking
    const sharedSericesSubnet = new gcp.compute.Subnetwork(
      "shared-services-subnet",
      {
        name: `${args.orgName.toLowerCase()}-subnet-shared`,
        project: networkingProject.projectId,
        network: hostVpc.id,
        ipCidrRange: "10.0.1.0/24",
        region: "us-central1",
        description: "Shared services subnet",
      },
      { parent: hostVpc }
    );

    // Grant subnet usage permissions to service projects - Shared Services Project
    const sharedServicesSubnetIAM = new gcp.projects.IAMBinding(
      "shared-services-subnet-iam",
      {
        project: networkingProject.projectId,
        role: "roles/compute.networkUser",
        members: [
          pulumi.interpolate`serviceAccount:${args.sharedServicesProjectNumber}-compute@developer.gserviceaccount.com`,
        ],
      },
      { parent: sharedVpcHost }
    );

    // Attach shared services as SharedVPC service project
    const sharedServicesServiceProject = new gcp.compute.SharedVPCServiceProject(
        "shared-services-service-project",
        {
          hostProject: networkingProject.projectId,
          serviceProject: args.sharedServicesProjectNumber,
        },
        {
          parent: sharedVpcHost,
        }
      );

    // Grant subnet-specific permissions for shared services subnet
    const sharedServicesSubnetSpecificIAM =
      new gcp.compute.SubnetworkIAMBinding(
        "shared-services-subnet-specific-iam",
        {
          project: networkingProject.id.apply(id => id.split("/")[1]),
          region: sharedSericesSubnet.region,
          subnetwork: sharedSericesSubnet.name,
          role: "roles/compute.networkUser",
          members: [
            pulumi.interpolate`serviceAccount:${args.sharedServicesProjectNumber}-compute@developer.gserviceaccount.com`,
          ],
        },
        { parent: sharedVpcHost }
      );


    // Firewall rules to allow traffic between projects
    const sharedVpcFirewallRule = new gcp.compute.Firewall(
      "shared-vpc-internal",
      {
        name: `${args.orgName.toLowerCase()}-shared-vpc-internal`,
        project: networkingProject.projectId,
        network: hostVpc.id,
        description: "Allow internal communication across shared VPC projects",
        allows: [
          {
            protocol: "tcp",
            ports: ["0-65535"],
          },
          {
            protocol: "udp",
            ports: ["0-65535"],
          },
          {
            protocol: "icmp",
          },
        ],
        sourceRanges: ["10.0.0.0/16"],
        targetTags: ["shared-vpc-internal"],
      },
      { parent: hostVpc, dependsOn: [sharedVpcHost] }
    );

    // Cloud Router and NAT for internet access
    const router = new gcp.compute.Router(
      "router",
      {
        name: `${args.orgName.toLowerCase()}-router`,
        project: networkingProject.projectId,
        region: "us-central1",
        network: hostVpc.id,
        description: "Router for NAT gateway",
      },
      { parent: hostVpc }
    );

    const nat = new gcp.compute.RouterNat(
      "nat",
      {
        name: `${args.orgName.toLowerCase()}-nat`,
        project: networkingProject.projectId,
        router: router.name,
        region: router.region,
        natIpAllocateOption: "AUTO_ONLY",
        sourceSubnetworkIpRangesToNat: "ALL_SUBNETWORKS_ALL_IP_RANGES",
      },
      { parent: router }
    );

    // Firewall rules
    const allowInternalFirewall = new gcp.compute.Firewall(
      "allow-internal",
      {
        name: `${args.orgName.toLowerCase()}-allow-internal`,
        project: networkingProject.projectId,
        network: hostVpc.id,
        description: "Allow internal communication",
        allows: [
          {
            protocol: "tcp",
            ports: ["0-65535"],
          },
          {
            protocol: "udp",
            ports: ["0-65535"],
          },
          {
            protocol: "icmp",
          },
        ],
        sourceRanges: ["10.0.0.0/8"],
      },
      { parent: hostVpc }
    );

    const allowSshFirewall = new gcp.compute.Firewall(
      "allow-ssh",
      {
        name: `${args.orgName.toLowerCase()}-allow-ssh`,
        project: networkingProject.projectId,
        network: hostVpc.id,
        description: "Allow SSH from IAP",
        allows: [
          {
            protocol: "tcp",
            ports: ["22"],
          },
        ],
        sourceRanges: ["35.235.240.0/20"], // Identity-Aware Proxy
        targetTags: ["ssh-allowed"],
      },
      { parent: hostVpc }
    );

    // Set outputs
    this.projectId = networkingProject.projectId;
    this.projectName = networkingProject.name;
    this.projectNumber = networkingProject.number;
    this.folderId = networkingFolder.id;

    this.registerOutputs({
      projectId: this.projectId,
      projectName: this.projectName,
      projectNumber: this.projectNumber,
      folderId: this.folderId,
    });
  }
}
