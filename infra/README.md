# CI/CD Dashboard Infrastructure (Free Tier)

This directory contains Terraform configuration for deploying the CI/CD Dashboard application on AWS using only free tier eligible resources.

## Prerequisites

1. [Terraform](https://www.terraform.io/downloads.html) >= 1.0.0
2. [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
3. An AWS account with free tier eligibility
4. An existing AWS key pair for EC2 instance access (create in AWS Console > EC2 > Key Pairs)

## Directory Structure

```
infra/
├── main.tf                 # Main configuration
├── variables.tf            # Input variables
├── outputs.tf             # Output values
├── versions.tf            # Terraform and provider versions
├── providers.tf           # Provider configurations
├── terraform.tfvars       # Variable values (gitignored)
├── terraform.tfvars.example # Example variables file
└── modules/               # Reusable modules
    ├── vpc/              # VPC and networking
    ├── security/         # Security groups
    ├── rds/              # PostgreSQL database
    └── ec2/              # Application server
```

## Deployment Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ci-cd-dashboard/infra
   ```

2. **Configure variables**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your configuration
   ```

3. **Initialize Terraform**
   ```bash
   terraform init
   ```

4. **Review the execution plan**
   ```bash
   terraform plan
   ```

5. **Apply the configuration**
   ```bash
   terraform apply
   ```
   When prompted, review the plan and type `yes` to apply.

6. **Access the application**
   After the deployment completes, the application will be available at:
   ```
   http://<ec2-public-ip>:3000
   ```
   You can find the EC2 public IP in the Terraform outputs or AWS Console > EC2 > Instances.

## Important Variables

Key variables to configure in `terraform.tfvars`:

- `aws_region`: AWS region (default: ap-south-1 for Mumbai)
- `key_name`: Your EC2 key pair name
- `db_username`: Database username (default: postgres)
- `db_password`: Database password (leave empty to auto-generate)
- `jwt_secret`: Secret key for JWT (leave empty to auto-generate)

## Cost Management

This configuration uses free tier eligible resources:
- EC2 t3.micro (750 hours/month)
- RDS db.t3.micro (750 hours/month)
- EBS storage (30GB free)

### Cleaning Up

To avoid unexpected charges, destroy all resources when not in use:

```bash
terraform destroy
```

## Security Notes

1. The database is publicly accessible for this free tier setup. In production:
   - Use private subnets with a NAT Gateway
   - Enable VPC endpoints
   - Use a bastion host for SSH access

2. All resources are tagged for cost allocation and management.

3. Sensitive values (database password, JWT secret) are either auto-generated or should be provided through environment variables or a secrets manager in production.

## Security Notes

- The database password and JWT secret are generated automatically if not provided
- All resources are tagged with the environment and project name
- Security groups are configured to allow only necessary traffic
- RDS is not publicly accessible (only from the EC2 instance)

## Cost Estimation

This configuration uses AWS Free Tier eligible resources:
- EC2 t3.micro (750 hours/month)
- RDS db.t3.micro (750 hours/month)
- EBS storage (30GB free)

Additional usage may incur costs.
