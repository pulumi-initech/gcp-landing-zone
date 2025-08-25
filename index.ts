import * as pulumi from "@pulumi/pulumi";
import { AwsLandingZone } from "./aws/landing-zone";
import { AzureLandingZone } from "./azure/landing-zone";
import { GcpLandingZone } from "./gcp/landing-zone";


const config = new pulumi.Config();

const gcpLandingZone = new GcpLandingZone("gcp-landing-zone", {
    orgName: config.require("orgName"),
    billingAccount: config.require("billingAccount"),
    landingZoneFolder: config.require("landingZoneFolder"),
    environments: config.requireObject<string[]>("environments"),
});

export const gcpProjectIds = gcpLandingZone.projectNumbers;
