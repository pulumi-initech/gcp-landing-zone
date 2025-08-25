import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

export interface AzureMonitoringArgs {
    orgName: string;
    environment: string;
}

export class AzureMonitoring extends pulumi.ComponentResource {
    public readonly dashboardUrl: pulumi.Output<string>;
    public readonly alertingEndpoint: pulumi.Output<string>;

    constructor(name: string, args: AzureMonitoringArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:azure:Monitoring", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

        const resourceGroup = new azure.core.ResourceGroup("monitoring-rg", {
            name: `${args.orgName}-monitoring-${args.environment}`,
            location: "East US",
        }, defaultResourceOptions);

        const logAnalytics = new azure.operationalinsights.AnalyticsWorkspace("log-analytics", {
            name: `${args.orgName}-monitoring-logs`,
            location: resourceGroup.location,
            resourceGroupName: resourceGroup.name,
            sku: "PerGB2018",
            retentionInDays: 90,
        }, defaultResourceOptions);

        const appInsights = new azure.appinsights.Insights("app-insights", {
            name: `${args.orgName}-monitoring-insights`,
            location: resourceGroup.location,
            resourceGroupName: resourceGroup.name,
            applicationType: "web",
            workspaceId: logAnalytics.id,
        }, defaultResourceOptions);

        const actionGroup = new azure.monitoring.ActionGroup("action-group", {
            name: `${args.orgName}-alerts`,
            resourceGroupName: resourceGroup.name,
            shortName: "alerts",
            webhookReceivers: [{
                name: "webhook",
                serviceUri: "https://example.com/webhook",
            }],
        }, defaultResourceOptions);

        const metricAlert = new azure.monitoring.MetricAlert("cpu-alert", {
            name: "high-cpu-usage",
            resourceGroupName: resourceGroup.name,
            scopes: [resourceGroup.id],
            description: "Alert when CPU usage is high",
            frequency: "PT5M",
            windowSize: "PT5M",
            criterias: [{
                metricNamespace: "Microsoft.Compute/virtualMachines",
                metricName: "Percentage CPU",
                aggregation: "Average",
                operator: "GreaterThan",
                threshold: 80,
            }],
            actionIds: [actionGroup.id],
        }, defaultResourceOptions);

        this.dashboardUrl = pulumi.interpolate`https://portal.azure.com/#@${args.orgName}.com/dashboard/arm/subscriptions/${resourceGroup.id}/resourceGroups/${resourceGroup.name}/providers/microsoft.insights/components/${appInsights.name}/overview`;
        this.alertingEndpoint = actionGroup.id;

        this.registerOutputs({
            dashboardUrl: this.dashboardUrl,
            alertingEndpoint: this.alertingEndpoint,
        });
    }
}