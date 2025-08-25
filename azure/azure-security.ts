import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

export interface AzureSecurityArgs {
    orgName: string;
    environment: string;
}

export class AzureSecurity extends pulumi.ComponentResource {
    public readonly securityContactId: pulumi.Output<string>;
    public readonly defenderIds: pulumi.Output<string[]>;
    public readonly policyAssignmentIds: pulumi.Output<string[]>;

    constructor(name: string, args: AzureSecurityArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:azure:Security", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

        // Resource Group for security resources
        const securityRG = new azure.core.ResourceGroup("security-rg", {
            name: `${args.orgName}-security-${args.environment}`,
            location: "East US",
        }, defaultResourceOptions);

        // Azure Security Center Contact
        const securityContact = new azure.securitycenter.Contact("security-contact", {
            email: `security@${args.orgName.toLowerCase()}.com`,
            phone: "+1-555-555-5555",
            alertNotifications: true,
            alertsToAdmins: true,
        }, defaultResourceOptions);

        // Azure Defender for different resource types
        const defenderForVMs = new azure.securitycenter.Setting("defender-for-vms", {
            settingName: "MCAS",
            enabled: true,
        }, defaultResourceOptions);

        const defenderForStorage = new azure.securitycenter.Setting("defender-for-storage", {
            settingName: "WDATP",
            enabled: true,
        }, defaultResourceOptions);

        // Security Policy Assignments
        const requireEncryptionPolicy = new azure.policy.Assignment("require-storage-encryption", {
            name: "require-storage-encryption",
            scope: securityRG.id,
            policyDefinitionId: "/providers/Microsoft.Authorization/policyDefinitions/404c3081-a854-4457-ae30-26a93ef643f9",
            displayName: "Require storage account encryption",
            description: "Ensure storage accounts have encryption enabled",
        }, defaultResourceOptions);

        const allowedLocationsPolicy = new azure.policy.Assignment("allowed-locations", {
            name: "allowed-locations",
            scope: securityRG.id,
            policyDefinitionId: "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4c",
            displayName: "Allowed locations",
            parameters: JSON.stringify({
                listOfAllowedLocations: {
                    value: ["East US", "West US 2", "West Europe"]
                }
            }),
        }, defaultResourceOptions);

        this.securityContactId = securityContact.id;
        this.defenderIds = pulumi.all([defenderForVMs.id, defenderForStorage.id]);
        this.policyAssignmentIds = pulumi.all([
            requireEncryptionPolicy.id,
            allowedLocationsPolicy.id
        ]);

        this.registerOutputs({
            securityContactId: this.securityContactId,
            defenderIds: this.defenderIds,
            policyAssignmentIds: this.policyAssignmentIds,
        });
    }
}