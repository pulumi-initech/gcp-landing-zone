import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

export interface AzureLandingZoneArgs {
    orgName: string;
    environment: string;
}

export class AzureLandingZone extends pulumi.ComponentResource {
    public readonly managementGroupId: pulumi.Output<string>;
    public readonly platformSubscriptionIds: pulumi.Output<{[key: string]: string}>;
    public readonly vnetIds: pulumi.Output<{[key: string]: string}>;

    constructor(name: string, args: AzureLandingZoneArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:azure:LandingZone", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

        // Create Management Group hierarchy
        const rootMG = new azure.management.Group("root-mg", {
            displayName: `${args.orgName} Root`,
            name: `${args.orgName.toLowerCase()}-root`,
        }, defaultResourceOptions);

        const platformMG = new azure.management.Group("platform-mg", {
            displayName: "Platform",
            name: `${args.orgName.toLowerCase()}-platform`,
            parentManagementGroupId: rootMG.id,
        }, defaultResourceOptions);

        const landingZonesMG = new azure.management.Group("landing-zones-mg", {
            displayName: "Landing Zones",
            name: `${args.orgName.toLowerCase()}-landing-zones`,
            parentManagementGroupId: rootMG.id,
        }, defaultResourceOptions);

        const corpMG = new azure.management.Group("corp-mg", {
            displayName: "Corp",
            name: `${args.orgName.toLowerCase()}-corp`,
            parentManagementGroupId: landingZonesMG.id,
        }, defaultResourceOptions);

        const onlineMG = new azure.management.Group("online-mg", {
            displayName: "Online",
            name: `${args.orgName.toLowerCase()}-online`,
            parentManagementGroupId: landingZonesMG.id,
        }, defaultResourceOptions);

        const sandboxMG = new azure.management.Group("sandbox-mg", {
            displayName: "Sandbox",
            name: `${args.orgName.toLowerCase()}-sandbox`,
            parentManagementGroupId: rootMG.id,
        }, defaultResourceOptions);

        // Create Resource Groups for different purposes
        const connectivityRG = new azure.core.ResourceGroup("connectivity-rg", {
            name: `${args.orgName}-connectivity-${args.environment}`,
            location: "East US",
            tags: {
                Environment: args.environment,
                Purpose: "Platform-Connectivity"
            }
        }, defaultResourceOptions);

        const managementRG = new azure.core.ResourceGroup("management-rg", {
            name: `${args.orgName}-management-${args.environment}`,
            location: "East US",
            tags: {
                Environment: args.environment,
                Purpose: "Platform-Management"
            }
        }, defaultResourceOptions);

        const identityRG = new azure.core.ResourceGroup("identity-rg", {
            name: `${args.orgName}-identity-${args.environment}`,
            location: "East US",
            tags: {
                Environment: args.environment,
                Purpose: "Platform-Identity"
            }
        }, defaultResourceOptions);

        const prodRG = new azure.core.ResourceGroup("prod-rg", {
            name: `${args.orgName}-prod-${args.environment}`,
            location: "East US",
            tags: {
                Environment: "production",
                Purpose: "Workloads"
            }
        }, defaultResourceOptions);

        const devRG = new azure.core.ResourceGroup("dev-rg", {
            name: `${args.orgName}-dev-${args.environment}`,
            location: "East US",
            tags: {
                Environment: "development",
                Purpose: "Workloads"
            }
        }, defaultResourceOptions);

        // Hub-Spoke Network Architecture
        const hubVNet = new azure.network.VirtualNetwork("hub-vnet", {
            name: `${args.orgName}-hub-vnet`,
            addressSpaces: ["10.0.0.0/16"],
            location: connectivityRG.location,
            resourceGroupName: connectivityRG.name,
            tags: {
                Environment: args.environment,
                NetworkType: "Hub"
            }
        }, defaultResourceOptions);

        const hubGatewaySubnet = new azure.network.Subnet("hub-gateway-subnet", {
            name: "GatewaySubnet",
            resourceGroupName: connectivityRG.name,
            virtualNetworkName: hubVNet.name,
            addressPrefixes: ["10.0.1.0/24"],
        }, defaultResourceOptions);

        const hubFirewallSubnet = new azure.network.Subnet("hub-firewall-subnet", {
            name: "AzureFirewallSubnet",
            resourceGroupName: connectivityRG.name,
            virtualNetworkName: hubVNet.name,
            addressPrefixes: ["10.0.2.0/24"],
        }, defaultResourceOptions);

        // Production Spoke VNet
        const prodVNet = new azure.network.VirtualNetwork("prod-vnet", {
            name: `${args.orgName}-prod-vnet`,
            addressSpaces: ["10.1.0.0/16"],
            location: prodRG.location,
            resourceGroupName: prodRG.name,
            tags: {
                Environment: "production",
                NetworkType: "Spoke"
            }
        }, defaultResourceOptions);

        const prodSubnet = new azure.network.Subnet("prod-subnet", {
            name: "workloads",
            resourceGroupName: prodRG.name,
            virtualNetworkName: prodVNet.name,
            addressPrefixes: ["10.1.1.0/24"],
        }, defaultResourceOptions);

        // Development Spoke VNet
        const devVNet = new azure.network.VirtualNetwork("dev-vnet", {
            name: `${args.orgName}-dev-vnet`,
            addressSpaces: ["10.2.0.0/16"],
            location: devRG.location,
            resourceGroupName: devRG.name,
            tags: {
                Environment: "development",
                NetworkType: "Spoke"
            }
        }, defaultResourceOptions);

        const devSubnet = new azure.network.Subnet("dev-subnet", {
            name: "workloads",
            resourceGroupName: devRG.name,
            virtualNetworkName: devVNet.name,
            addressPrefixes: ["10.2.1.0/24"],
        }, defaultResourceOptions);

        // VNet Peering from Spokes to Hub
        const hubToProdPeering = new azure.network.VirtualNetworkPeering("hub-to-prod-peering", {
            name: "hub-to-prod",
            resourceGroupName: connectivityRG.name,
            virtualNetworkName: hubVNet.name,
            remoteVirtualNetworkId: prodVNet.id,
            allowVirtualNetworkAccess: true,
            allowForwardedTraffic: true,
            allowGatewayTransit: true,
        }, defaultResourceOptions);

        const prodToHubPeering = new azure.network.VirtualNetworkPeering("prod-to-hub-peering", {
            name: "prod-to-hub",
            resourceGroupName: prodRG.name,
            virtualNetworkName: prodVNet.name,
            remoteVirtualNetworkId: hubVNet.id,
            allowVirtualNetworkAccess: true,
            allowForwardedTraffic: true,
            useRemoteGateways: false, // Set to true when VPN Gateway is deployed
        }, defaultResourceOptions);

        const hubToDevPeering = new azure.network.VirtualNetworkPeering("hub-to-dev-peering", {
            name: "hub-to-dev",
            resourceGroupName: connectivityRG.name,
            virtualNetworkName: hubVNet.name,
            remoteVirtualNetworkId: devVNet.id,
            allowVirtualNetworkAccess: true,
            allowForwardedTraffic: true,
            allowGatewayTransit: true,
        }, defaultResourceOptions);

        const devToHubPeering = new azure.network.VirtualNetworkPeering("dev-to-hub-peering", {
            name: "dev-to-hub",
            resourceGroupName: devRG.name,
            virtualNetworkName: devVNet.name,
            remoteVirtualNetworkId: hubVNet.id,
            allowVirtualNetworkAccess: true,
            allowForwardedTraffic: true,
            useRemoteGateways: false, // Set to true when VPN Gateway is deployed
        }, defaultResourceOptions);

        // Azure Firewall for network security
        const firewallPip = new azure.network.PublicIp("firewall-pip", {
            name: `${args.orgName}-fw-pip`,
            location: connectivityRG.location,
            resourceGroupName: connectivityRG.name,
            allocationMethod: "Static",
            sku: "Standard",
            tags: {
                Environment: args.environment,
                Purpose: "Network-Security"
            }
        }, defaultResourceOptions);

        const firewall = new azure.network.Firewall("firewall", {
            name: `${args.orgName}-fw`,
            location: connectivityRG.location,
            resourceGroupName: connectivityRG.name,
            skuName: "AZFW_VNet",
            skuTier: "Standard",
            ipConfigurations: [{
                name: "configuration",
                subnetId: hubFirewallSubnet.id,
                publicIpAddressId: firewallPip.id,
            }],
            tags: {
                Environment: args.environment,
                Purpose: "Network-Security"
            }
        }, defaultResourceOptions);

        // Log Analytics Workspace for centralized logging
        const logAnalytics = new azure.operationalinsights.AnalyticsWorkspace("log-analytics", {
            name: `${args.orgName}-logs-${args.environment}`,
            location: managementRG.location,
            resourceGroupName: managementRG.name,
            sku: "PerGB2018",
            retentionInDays: 90,
            tags: {
                Environment: args.environment,
                Purpose: "Platform-Management"
            }
        }, defaultResourceOptions);

        // // Azure Policy Assignments for governance
        // const allowedLocationsPolicy = new azure.policy.Assignment("allowed-locations-policy", {
        //     name: `${args.orgName}-allowed-locations`,
        //     scope: rootMG.id,
        //     policyDefinitionId: "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4c",
        //     displayName: "Allowed locations",
        //     parameters: JSON.stringify({
        //         listOfAllowedLocations: {
        //             value: ["East US", "West US 2", "West Europe"]
        //         }
        //     }),
        // }, defaultResourceOptions);

        // const requireTagPolicy = new azure.policy.Assignment("require-tag-policy", {
        //     name: `${args.orgName}-require-env-tag`,
        //     scope: rootMG.id,
        //     policyDefinitionId: "/providers/Microsoft.Authorization/policyDefinitions/1e30110a-5ceb-460c-a204-c1c3969c6d62",
        //     displayName: "Require Environment tag",
        //     parameters: JSON.stringify({
        //         tagName: {
        //             value: "Environment"
        //         }
        //     }),
        // }, defaultResourceOptions);

        // Azure Security Center
        const securityContact = new azure.securitycenter.Contact("security-contact", {
            email: `security@${args.orgName.toLowerCase()}.com`,
            phone: "+1-555-555-5555",
            alertNotifications: true,
            alertsToAdmins: true,
        }, defaultResourceOptions);

        // Key Vault for secrets management
        const currentClient = azure.core.getClientConfig();
        const keyVault = new azure.keyvault.KeyVault("keyvault", {
            name: `${args.orgName.toLowerCase().substr(0, 15)}-kv-${args.environment}`,
            location: managementRG.location,
            resourceGroupName: managementRG.name,
            tenantId: currentClient.then(config => config.tenantId),
            skuName: "standard",
            accessPolicies: [{
                tenantId: currentClient.then(config => config.tenantId),
                objectId: currentClient.then(config => config.objectId),
                keyPermissions: ["Get", "List", "Create", "Delete", "Update", "Recover", "Purge"],
                secretPermissions: ["Get", "List", "Set", "Delete", "Recover", "Purge"],
            }],
            tags: {
                Environment: args.environment,
                Purpose: "Platform-Management"
            }
        }, defaultResourceOptions);

        // Set outputs
        this.managementGroupId = rootMG.id;
        this.platformSubscriptionIds = pulumi.all([connectivityRG.id, managementRG.id, identityRG.id]).apply(([connectivityId, managementId, identityId]) => {
            return { 
                "connectivity": connectivityId,
                "management": managementId,
                "identity": identityId
            } as { [key: string]: string };
        });
        this.vnetIds = pulumi.all([hubVNet.id, prodVNet.id, devVNet.id]).apply(([hub, prod, dev]) => {
            return {
                "hub": hub,
                "production": prod,
                "development": dev
            } as { [key: string]: string };
        });

        this.registerOutputs({
            managementGroupId: this.managementGroupId,
            platformSubscriptionIds: this.platformSubscriptionIds,
            vnetIds: this.vnetIds,
        });
    }
}