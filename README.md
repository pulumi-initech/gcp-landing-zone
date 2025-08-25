# GCP Landing Zone with Pulumi

This project demonstrates a comprehensive GCP landing zone implementation using Pulumi with ComponentResource architecture. It follows Google Cloud best practices and implements standardized governance, security, and monitoring.

## Architecture Overview

The GCP landing zone implements a hierarchical folder structure with shared VPC networking:

### GCP Landing Zone Structure

- **Organization Structure**: Folder hierarchy for Platform, Workloads environments
- **Projects**: Separate projects for networking, shared services, security, and workload environments
- **Networking**: Shared VPC model with centralized networking project
- **Security**: Cloud KMS for encryption, IAM for access control
- **Monitoring**: Centralized monitoring in shared services project

## Project Structure

```text
landing-zones/
├── index.ts                    # Main entry point
├── gcp/
│   ├── landing-zone.ts         # Main GCP landing zone orchestrator
│   ├── networking.ts           # Networking ComponentResource
│   ├── shared-services.ts      # Shared services ComponentResource
│   ├── security.ts             # Security ComponentResource
│   ├── environment.ts          # Environment ComponentResource
│   ├── gcp-monitoring.ts       # GCP monitoring implementation
│   └── gcp-security.ts         # GCP security baseline
├── package.json
├── Pulumi.yaml
├── Pulumi.dev.yaml             # Configuration file
└── README.md
```

## Prerequisites

1. **Pulumi CLI** installed and configured
2. **Google Cloud SDK** configured with appropriate permissions
3. **Node.js** and **npm** installed
4. **GCP Organizational Permissions**:
   - Organization Administrator role
   - Project Creator role
   - Folder Admin role
   - Billing Account Administrator role

## Configuration

This project uses Pulumi ESC (Environments, Secrets, and Configuration) for configuration management. Configure your environment in the Pulumi Cloud console:

1. **Create or update your ESC environment** at [Pulumi Cloud](https://app.pulumi.com)
2. **Set the following configuration values**:

```yaml
values:
  gcp:
    region: us-central1
    disableGlobalProjectWarning: "true"
  landing-zones:
    orgName: your-org-name
    landingZoneFolder: folders/your-folder-id
    billingAccount: your-billing-account-id
    environments:
      - production
      - development
```

3. **Reference the ESC environment** in your `Pulumi.dev.yaml`:

```yaml
environment:
  - landing-zones/dev
```

## Required Permissions

### GCP
- **Existing GCP Organization**: This demo assumes you have an existing GCP Organization
- **Billing Account**: Active billing account with billing administrator access
- Organization Administrator role
- Project Creator role
- Folder Admin role
- Compute Admin role for networking
- Security Admin role for KMS and IAM

## Deployment

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure GCP CLI**:
   ```bash
   gcloud auth login
   gcloud config set project [YOUR_PROJECT_ID]
   ```

3. **Configure ESC environment**:
   - Log in to [Pulumi Cloud](https://app.pulumi.com)
   - Navigate to ESC (Environments, Secrets, and Configuration)
   - Create or update your `landing-zones/dev` environment
   - Add your organization-specific values as shown in the Configuration section above

   **To find your GCP Billing Account ID:**
   ```bash
   gcloud billing accounts list --format="value(name)"
   ```

   **To find your GCP Organization/Folder ID:**
   ```bash
   gcloud organizations list
   gcloud resource-manager folders list --organization=[ORG_ID]
   ```

4. **Deploy the landing zone**:
   ```bash
   pulumi up
   ```

5. **View outputs**:
   ```bash
   pulumi stack output
   ```

## ComponentResource Architecture

The project uses Pulumi ComponentResources for modularity and reusability:

- `GcpLandingZone`: Main orchestrator that creates the folder structure and coordinates all components
- `LzNetworking`: Manages networking project, Shared VPC, subnets, and firewall rules
- `SharedServices`: Creates shared services project and monitoring setup
- `Security`: Manages security project and Cloud KMS encryption
- `Environment`: Creates individual environment projects (prod, dev) with Shared VPC attachment

## Key Features

### Hierarchical Organization
- Platform folder containing networking, shared services, and security
- Workloads folder containing production and development environments
- Clear separation of concerns and responsibilities

### Shared VPC Networking
- Central networking project owns the VPC and subnets
- Environment projects attach as service projects
- Proper IAM permissions for subnet usage
- Firewall rules for internal communication

### Security by Design
- Cloud KMS for encryption key management
- IAM policies for least-privilege access
- Security baseline monitoring
- Centralized security project

### Operational Excellence
- Centralized monitoring in shared services project
- Automated resource provisioning
- Infrastructure as Code best practices
- Project-specific service account permissions

## Outputs

The deployment provides the following outputs:

```typescript
// GCP outputs
folderIds: {
  platform: "folders/123456789",
  workloads: "folders/987654321", 
  networking: "folders/456789123",
  "shared-services": "folders/654321987",
  security: "folders/321987654"
}

projectNumbers: {
  "pulumi-net-abc123": "123456789012",
  "pulumi-shared": "987654321098", 
  "pulumi-sec": "456789123456",
  "pulumi-pro": "789123456789",
  "pulumi-dev": "321987654321"
}
```

## Customization

To customize the landing zone for your organization:

1. **Modify environments** in `Pulumi.dev.yaml` configuration
2. **Update component resources** in the gcp directory  
3. **Adjust security policies** in the security component
4. **Customize monitoring** dashboards and alerts
5. **Add additional projects** by extending the environments array

## Best Practices Implemented

- **ComponentResource Architecture**: Modular, reusable components
- **Shared VPC Model**: Centralized networking with distributed consumption  
- **Infrastructure as Code**: All resources defined in TypeScript
- **Security First**: KMS encryption and IAM controls from day one
- **Monitoring and Observability**: Centralized monitoring setup
- **Project Naming**: Consistent, unique project ID generation
- **Resource Organization**: Clear folder hierarchy and labeling

## Troubleshooting

Common issues and solutions:

1. **Permission Errors**: Ensure all required GCP IAM roles are assigned
2. **Quota Limits**: Check GCP quotas for projects and compute resources
3. **Shared VPC Issues**: Verify organization-level Shared VPC permissions
4. **Project ID Conflicts**: Project IDs include random suffixes for uniqueness
5. **Billing Account**: Ensure billing account is active and linked

## Contributing

To contribute to this project:

1. Fork the repository
2. Create a feature branch
3. Follow the existing ComponentResource patterns
4. Test thoroughly in a GCP organization
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
