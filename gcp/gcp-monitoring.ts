import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface GcpMonitoringArgs {
    orgName: string;
    monitoringProjectId: pulumi.Input<string>;
}

export class GcpMonitoring extends pulumi.ComponentResource {
    public readonly dashboardUrl: pulumi.Output<string>;
    public readonly alertingEndpoint: pulumi.Output<string>;

    constructor(name: string, args: GcpMonitoringArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:gcp:Monitoring", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

        const monitoringApi = new gcp.projects.Service("monitoring-api", {
            project: args.monitoringProjectId,
            service: "monitoring.googleapis.com",
        }, defaultResourceOptions);

        const loggingApi= new gcp.projects.Service(
        "logging-api-shared",
        {
            project: args.monitoringProjectId,
            service: "logging.googleapis.com",
        },
        { parent: this}
        );

        // Cloud Logging and Monitoring setup
        const logBucket = new gcp.logging.ProjectBucketConfig(
        "log-bucket",
        {
            project: args.monitoringProjectId,
            location: "global",
            bucketId: "_Default",
            retentionDays: 90,
        },
        { parent: this, dependsOn: [loggingApi] }
        );

        const logSink = new gcp.logging.ProjectSink(
        "project-log-sink",
        {
            name: `${args.orgName.toLowerCase()}-project-sink`,
            project: args.monitoringProjectId,
            destination: pulumi.interpolate`logging.googleapis.com/projects/${logBucket.project}/locations/${logBucket.location}/buckets/${logBucket.bucketId}`,
            filter: "severity >= INFO",
            uniqueWriterIdentity: true,
        },
        { parent: this, dependsOn: [logBucket] }
        );

        const alertPolicy = new gcp.monitoring.AlertPolicy("cpu-alert-policy", {
            displayName: "High CPU Usage",
            project: args.monitoringProjectId,
            combiner: "OR",
            conditions: [{
                displayName: "CPU usage is above 80%",
                conditionThreshold: {
                    filter: 'resource.type="gce_instance" AND metric.type="compute.googleapis.com/instance/cpu/utilization"',
                    comparison: "COMPARISON_GT",
                    thresholdValue: 0.8,
                    duration: "300s",
                    aggregations: [{
                        alignmentPeriod: "300s",
                        perSeriesAligner: "ALIGN_MEAN",
                        crossSeriesReducer: "REDUCE_MEAN",
                        groupByFields: ["resource.label.instance_id"],
                    }],
                },
            }],
            notificationChannels: [],
            alertStrategy: {
                autoClose: "1800s",
            },
        }, { dependsOn: [monitoringApi], ...defaultResourceOptions });

        const dashboard = new gcp.monitoring.Dashboard("multi-cloud-dashboard", {
            project: args.monitoringProjectId,
            dashboardJson: JSON.stringify({
                displayName: `${args.orgName} Multi-Cloud Dashboard`,
                mosaicLayout: {
                    columns: 6,
                    tiles: [{
                        width: 6,
                        height: 4,
                        widget: {
                            title: "CPU Utilization",
                            xyChart: {
                                dataSets: [{
                                    timeSeriesQuery: {
                                        timeSeriesFilter: {
                                            filter: 'resource.type="gce_instance" AND metric.type="compute.googleapis.com/instance/cpu/utilization"',
                                            aggregation: {
                                                alignmentPeriod: "300s",
                                                perSeriesAligner: "ALIGN_MEAN",
                                            }
                                        }
                                    }
                                }]
                            }
                        }
                    }]
                }
            })
        }, { dependsOn: [monitoringApi], ...defaultResourceOptions });

        this.dashboardUrl = pulumi.interpolate`https://console.cloud.google.com/monitoring/dashboards/custom/${dashboard.id}?project=${args.monitoringProjectId}`;
        this.alertingEndpoint = alertPolicy.id;

        this.registerOutputs({
            dashboardUrl: this.dashboardUrl,
            alertingEndpoint: this.alertingEndpoint,
        });
    }
}