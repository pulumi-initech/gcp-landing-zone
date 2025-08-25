#!/usr/bin/env python3

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, ConnectionPatch
import numpy as np

# Create figure and axis
fig, ax = plt.subplots(1, 1, figsize=(16, 12))
ax.set_xlim(0, 16)
ax.set_ylim(0, 12)
ax.set_aspect('equal')

# Colors
org_color = '#4285f4'  # Google Blue
platform_color = '#34a853'  # Google Green
workload_color = '#fbbc04'  # Google Yellow
project_color = '#ea4335'  # Google Red
network_color = '#9c27b0'  # Purple
security_color = '#ff6d01'  # Orange

# Title
ax.text(8, 11.5, 'GCP Landing Zone Architecture', fontsize=20, fontweight='bold', ha='center')

# Organization Root
org_box = FancyBboxPatch((1, 9.5), 14, 1.2, boxstyle="round,pad=0.1", 
                        facecolor=org_color, edgecolor='black', alpha=0.8)
ax.add_patch(org_box)
ax.text(8, 10.1, 'GCP Organization', fontsize=14, fontweight='bold', ha='center', color='white')

# Landing Zone Folder
lz_box = FancyBboxPatch((2, 8), 12, 1, boxstyle="round,pad=0.1", 
                       facecolor='#e8f0fe', edgecolor=org_color, linewidth=2)
ax.add_patch(lz_box)
ax.text(8, 8.5, 'Landing Zone Folder', fontsize=12, fontweight='bold', ha='center')

# Platform Folder
platform_box = FancyBboxPatch((0.5, 5.5), 7, 2, boxstyle="round,pad=0.1", 
                              facecolor=platform_color, edgecolor='black', alpha=0.3)
ax.add_patch(platform_box)
ax.text(4, 7.2, 'Platform Folder', fontsize=12, fontweight='bold', ha='center')

# Workloads Folder
workloads_box = FancyBboxPatch((8.5, 5.5), 7, 2, boxstyle="round,pad=0.1", 
                              facecolor=workload_color, edgecolor='black', alpha=0.3)
ax.add_patch(workloads_box)
ax.text(12, 7.2, 'Workloads Folder', fontsize=12, fontweight='bold', ha='center')

# Platform Sub-folders
networking_folder = FancyBboxPatch((1, 4.8), 2, 0.6, boxstyle="round,pad=0.05", 
                                  facecolor='#e8f5e8', edgecolor=platform_color)
ax.add_patch(networking_folder)
ax.text(2, 5.1, 'Networking', fontsize=10, ha='center', fontweight='bold')

shared_folder = FancyBboxPatch((3.5, 4.8), 2, 0.6, boxstyle="round,pad=0.05", 
                              facecolor='#e8f5e8', edgecolor=platform_color)
ax.add_patch(shared_folder)
ax.text(4.5, 5.1, 'Shared Services', fontsize=10, ha='center', fontweight='bold')

security_folder = FancyBboxPatch((6, 4.8), 2, 0.6, boxstyle="round,pad=0.05", 
                                facecolor='#e8f5e8', edgecolor=platform_color)
ax.add_patch(security_folder)
ax.text(7, 5.1, 'Security', fontsize=10, ha='center', fontweight='bold')

# Workloads Sub-folders
prod_folder = FancyBboxPatch((9, 4.8), 2.5, 0.6, boxstyle="round,pad=0.05", 
                            facecolor='#fff8e1', edgecolor=workload_color)
ax.add_patch(prod_folder)
ax.text(10.25, 5.1, 'Production', fontsize=10, ha='center', fontweight='bold')

dev_folder = FancyBboxPatch((12, 4.8), 2.5, 0.6, boxstyle="round,pad=0.05", 
                           facecolor='#fff8e1', edgecolor=workload_color)
ax.add_patch(dev_folder)
ax.text(13.25, 5.1, 'Development', fontsize=10, ha='center', fontweight='bold')

# Projects
projects = [
    {'name': 'Networking\nProject', 'x': 1, 'y': 3.8, 'color': project_color},
    {'name': 'Shared Services\nProject', 'x': 3.5, 'y': 3.8, 'color': project_color},
    {'name': 'Security\nProject', 'x': 6, 'y': 3.8, 'color': project_color},
    {'name': 'Production\nProject', 'x': 9, 'y': 3.8, 'color': project_color},
    {'name': 'Development\nProject', 'x': 12, 'y': 3.8, 'color': project_color},
]

for proj in projects:
    proj_box = FancyBboxPatch((proj['x'], proj['y']), 2, 0.8, boxstyle="round,pad=0.05", 
                             facecolor=proj['color'], edgecolor='black', alpha=0.7)
    ax.add_patch(proj_box)
    ax.text(proj['x'] + 1, proj['y'] + 0.4, proj['name'], fontsize=9, ha='center', 
           color='white', fontweight='bold')

# Shared VPC Network
vpc_box = FancyBboxPatch((1, 2.5), 14, 1, boxstyle="round,pad=0.1", 
                        facecolor=network_color, edgecolor='black', alpha=0.3)
ax.add_patch(vpc_box)
ax.text(8, 3, 'Shared VPC Network (Host Project: Networking)', fontsize=12, 
       fontweight='bold', ha='center', color='white')

# Subnets
subnets = [
    {'name': 'Production\nSubnet\n10.0.1.0/24', 'x': 2, 'y': 1.5},
    {'name': 'Development\nSubnet\n10.0.2.0/24', 'x': 6, 'y': 1.5},
    {'name': 'Shared Services\nSubnet\n10.0.3.0/24', 'x': 10, 'y': 1.5},
    {'name': 'Router & NAT\nGateway', 'x': 13.5, 'y': 1.5}
]

for subnet in subnets:
    subnet_box = FancyBboxPatch((subnet['x'], subnet['y']), 2.3, 0.8, boxstyle="round,pad=0.05", 
                               facecolor='#f3e5f5', edgecolor=network_color)
    ax.add_patch(subnet_box)
    ax.text(subnet['x'] + 1.15, subnet['y'] + 0.4, subnet['name'], fontsize=8, ha='center', 
           fontweight='bold')

# Security and Compliance section
security_box = FancyBboxPatch((0.5, 0.2), 7, 0.8, boxstyle="round,pad=0.05", 
                             facecolor=security_color, edgecolor='black', alpha=0.3)
ax.add_patch(security_box)
ax.text(4, 0.6, 'Security & Compliance:\n• Organization Policies • Cloud KMS • Logging & Monitoring', 
       fontsize=9, ha='center', fontweight='bold', color='white')

# APIs and Services section
apis_box = FancyBboxPatch((8.5, 0.2), 7, 0.8, boxstyle="round,pad=0.05", 
                         facecolor='#607d8b', edgecolor='black', alpha=0.3)
ax.add_patch(apis_box)
ax.text(12, 0.6, 'Enabled APIs:\n• Compute • Logging • Monitoring • Cloud KMS', 
       fontsize=9, ha='center', fontweight='bold', color='white')

# Connection lines
connections = [
    # From LZ folder to Platform and Workloads
    [(8, 8), (4, 7.5)],
    [(8, 8), (12, 7.5)],
    
    # From folders to sub-folders
    [(4, 6.8), (2, 5.4)],
    [(4, 6.8), (4.5, 5.4)],
    [(4, 6.8), (7, 5.4)],
    [(12, 6.8), (10.25, 5.4)],
    [(12, 6.8), (13.25, 5.4)],
    
    # From sub-folders to projects
    [(2, 4.8), (2, 4.6)],
    [(4.5, 4.8), (4.5, 4.6)],
    [(7, 4.8), (7, 4.6)],
    [(10.25, 4.8), (10, 4.6)],
    [(13.25, 4.8), (13, 4.6)],
    
    # From networking project to VPC
    [(2, 3.8), (2, 3.5)],
]

for start, end in connections:
    line = ConnectionPatch(start, end, "data", "data", 
                          arrowstyle="-", shrinkA=5, shrinkB=5, 
                          mutation_scale=20, fc="gray", alpha=0.6)
    ax.add_patch(line)

# Remove axes
ax.set_xticks([])
ax.set_yticks([])
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['bottom'].set_visible(False)
ax.spines['left'].set_visible(False)

# Add legend
legend_elements = [
    patches.Patch(color=org_color, label='Organization Level'),
    patches.Patch(color=platform_color, alpha=0.3, label='Platform Resources'),
    patches.Patch(color=workload_color, alpha=0.3, label='Workload Resources'),
    patches.Patch(color=project_color, alpha=0.7, label='GCP Projects'),
    patches.Patch(color=network_color, alpha=0.3, label='Networking'),
    patches.Patch(color=security_color, alpha=0.3, label='Security & Compliance')
]

ax.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(0.98, 0.95))

plt.tight_layout()
plt.savefig('/Users/james/Code/demos/landing-zones/gcp-landing-zone-architecture.png', 
           dpi=300, bbox_inches='tight', facecolor='white')
plt.close()

print("GCP Landing Zone architecture diagram saved as 'gcp-landing-zone-architecture.png'")