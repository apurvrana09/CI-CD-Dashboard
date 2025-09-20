# AI Prompt Logs

This document contains a log of prompts used with AI tools (ChatGPT, Copilot, Cursor) to assist in developing and deploying the CI/CD Dashboard.

## Infrastructure as Code (Terraform)

### Initial Infrastructure Setup
```
Create a Terraform configuration for AWS that includes:
- VPC with public subnets
- EC2 instance with Docker installed
- Security groups for web access (ports 80, 443, 22, 3000, 5000)
- IAM roles with least privilege
- Output the public IP and DNS
```

### RDS Removal and Local PostgreSQL Setup
```
Help me remove AWS RDS from my Terraform configuration and switch to using a local PostgreSQL database in a Docker container. Update all related configurations including security groups, IAM policies, and application settings.
```

### Security Group Configuration
```
Generate a secure security group configuration for an EC2 instance that will run a Node.js backend (port 5000) and React frontend (port 3000), with PostgreSQL (port 5432) and Redis (port 6379) in Docker containers. Only allow SSH from my IP and HTTP/HTTPS from anywhere.
```

## Docker and Application Deployment

### Docker Compose Configuration
```
Create a docker-compose.yml file for a full-stack application with:
- Node.js backend with Prisma ORM
- PostgreSQL database
- Redis for caching
- React frontend
- Nginx reverse proxy (optional)
Include environment variables and volume mounts for development.
```

### EC2 User Data Script
```
Write a user data script for an EC2 instance that will:
1. Update packages
2. Install Docker and Docker Compose
3. Clone a GitHub repository
4. Set up environment variables
5. Start the application using docker-compose
6. Ensure services start on boot
```

## Debugging and Optimization

### Terraform State Issues
```
I'm getting this error when running terraform apply: "Error: Error creating security group: InvalidGroup.Duplicate: The security group 'ci-cd-dashboard-sg' already exists". How can I fix this while preserving my existing resources?
```

### Docker Memory Issues
```
My frontend build is failing on a t3.micro instance with "JavaScript heap out of memory" error. How can I modify the build process to use less memory?
```

### Database Migration
```
Create a script to run Prisma migrations in a Docker container with proper error handling and logging. The script should:
1. Check if database is available
2. Run migrations
3. Seed initial data if needed
4. Exit with appropriate status codes
```

## Documentation

### README Updates
```
Update the README.md to reflect that we're now using Docker containers for all services instead of AWS RDS. Include:
- Updated architecture diagram
- Simplified setup instructions
- Environment variable documentation
- Deployment instructions for both development and production
```

### Deployment Guide
```
Create a deployment guide that explains how to:
1. Set up the infrastructure with Terraform
2. Deploy the application with Docker
3. Configure environment variables
4. Run database migrations
5. Troubleshoot common issues
```

## AI-Generated Code Quality

All AI-generated code was reviewed and tested before being committed to the repository. The following practices were followed:
- Manually verified all security group rules
- Tested deployment on a clean environment
- Validated IAM policies for least privilege
- Ensured sensitive data is not hardcoded
- Added proper error handling and logging
