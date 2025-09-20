# CI/CD Dashboard Deployment Guide

This document provides step-by-step instructions for deploying the CI/CD Dashboard using Terraform and Docker.

## Prerequisites

- Terraform (v1.0+)
- AWS CLI configured with appropriate credentials
- Docker and Docker Compose
- Git

## Infrastructure Deployment

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ci-cd-dashboard.git
cd ci-cd-dashboard/infra
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Review the Execution Plan

```bash
terraform plan
```

### 4. Apply the Infrastructure

```bash
terraform apply
```

This will create:
- VPC with public subnets
- EC2 instance
- Security groups
- Required IAM roles and policies

## Application Deployment

### 1. SSH into the EC2 Instance

```bash
ssh -i your-key.pem ubuntu@<ec2-public-ip>
```

### 2. Clone the Repository on the EC2 Instance

```bash
git clone https://github.com/your-username/ci-cd-dashboard.git
cd ci-cd-dashboard
```

### 3. Configure Environment Variables

Before starting the application, update the `.env` file with the EC2 instance's public IP:

```bash
# In the project root directory
cp .env.example .env
# Replace all 'localhost' occurrences with your EC2 public IP
sed -i 's/localhost/<ec2-public-ip>/g' .env
```

### 4. Start the Application

```bash
docker-compose up -d
```

### 5. Run Database Migrations

```bash
docker-compose exec backend npm run db:migrate
```

### 6. Access the Application

The application will be available at:
- Frontend: `http://<ec2-public-ip>:3000`
- Backend API: `http://<ec2-public-ip>:5000`

## Updating the Application

1. Push changes to your repository
2. SSH into the EC2 instance
3. Pull the latest changes
4. Rebuild and restart the containers

```bash
cd ci-cd-dashboard
git pull
docker-compose down
docker-compose up -d --build
```

## Destroying the Infrastructure

To tear down all resources:

```bash
cd infra
terraform destroy
```

## AI Assistance Used

- Generated Terraform configurations for AWS infrastructure
- Created deployment scripts
- Debugged networking and security group issues
- Optimized Docker and Docker Compose configurations

## Troubleshooting

- **Application not accessible**: Check security group rules and ensure ports 3000 and 5000 are open
- **Database connection issues**: Verify the database container is running and the connection string is correct
- **Permission denied errors**: Ensure the EC2 instance has the necessary IAM permissions
