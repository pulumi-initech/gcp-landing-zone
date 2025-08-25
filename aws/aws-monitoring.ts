import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface AwsMonitoringArgs {
    orgName: string;
    environment: string;
}

export class AwsMonitoring extends pulumi.ComponentResource {
    public readonly dashboardUrl: pulumi.Output<string>;
    public readonly alertingEndpoint: pulumi.Output<string>;

    constructor(name: string, args: AwsMonitoringArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:aws:Monitoring", name, {}, opts);

        const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };


        const cwDashboard = new aws.cloudwatch.Dashboard("cloud-dashboard", {
            dashboardName: `${args.orgName}-cwd-${args.environment}`,
            dashboardBody: JSON.stringify({
                widgets: [
                    {
                        type: "metric",
                        x: 0,
                        y: 0,
                        width: 12,
                        height: 6,
                        properties: {
                            metrics: [
                                ["AWS/EC2", "CPUUtilization"],
                                ["AWS/Lambda", "Duration"],
                                ["AWS/S3", "NumberOfObjects"]
                            ],
                            period: 300,
                            stat: "Average",
                            region: "us-east-1",
                            title: "AWS Resource Metrics"
                        }
                    },
                    {
                        type: "log",
                        x: 0,
                        y: 6,
                        width: 12,
                        height: 6,
                        properties: {
                            query: "SOURCE '/aws/cloudtrail' | fields @timestamp, sourceIPAddress, userIdentity.type\n| filter sourceIPAddress != \"AWS Internal\"\n| stats count() by sourceIPAddress\n| sort @timestamp desc\n| limit 20",
                            region: "us-east-1",
                            title: "CloudTrail Activity"
                        }
                    }
                ]
            })
        }, defaultResourceOptions);

        const snsAlertTopic = new aws.sns.Topic("cloud-alerts", {
            name: `${args.orgName}-alerts-${args.environment}`,
        }, defaultResourceOptions);

        const cwAlarm = new aws.cloudwatch.MetricAlarm("high-error-rate", {
            comparisonOperator: "GreaterThanThreshold",
            evaluationPeriods: 2,
            metricName: "ErrorRate",
            namespace: "AWS/Lambda",
            period: 300,
            statistic: "Average",
            threshold: 5,
            alarmDescription: "High error rate detected",
            alarmActions: [snsAlertTopic.arn],
        }, defaultResourceOptions);

        this.dashboardUrl = pulumi.interpolate`https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=${cwDashboard.dashboardName}`;
        this.alertingEndpoint = snsAlertTopic.arn;

        this.registerOutputs({
            dashboardUrl: this.dashboardUrl,
            alertingEndpoint: this.alertingEndpoint,
        });
    }
}