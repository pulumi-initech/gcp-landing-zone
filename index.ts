import * as pulumi from "@pulumi/pulumi";
import { AwsLandingZone } from "./aws/landing-zone";
import { AzureLandingZone } from "./azure/landing-zone";
import { GcpLandingZone } from "./gcp/landing-zone";


const config = new pulumi.Config();

const gcpLandingZone = new GcpLandingZone("gcp-landing-zone", {
    orgName: config.require("orgName"),
    landingZoneFolder: config.require("landingZoneFolder"),
});

export const gcpProjectIds = gcpLandingZone.projectNumbers;
