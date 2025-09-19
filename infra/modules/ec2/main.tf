# Create EC2 instance in public subnet
resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [var.security_group_id]
  subnet_id              = var.subnet_id
  
  # Use a larger root volume (default is 8GB, which might be too small)
  root_block_device {
    volume_size = 20  # GB
    volume_type = "gp2"
    encrypted   = true
  }
  
  # User data script to install Docker and run the application
  user_data = <<-EOF
              #!/bin/bash
              set -ex
              
              # Update and install required packages
              apt-get update -y
              apt-get install -y \
                  apt-transport-https \
                  ca-certificates \
                  curl \
                  gnupg \
                  lsb-release
              
              # Add Docker's official GPG key
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg
              
              # Set up the Docker repository
              echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
                tee /etc/apt/sources.list.d/docker.list > /dev/null
              
              # Install Docker Engine
              apt-get update -y
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
              
              # Add ubuntu user to docker group
              usermod -aG docker ubuntu
              
              # Add ubuntu user to docker group
              usermod -aG docker ubuntu
              
              # Create application directory
              mkdir -p /opt/ci-cd-dashboard
              
              # Create application directory
              mkdir -p /opt/ci-cd-dashboard
              
              # Create .env file with database connection details
              cat > /opt/ci-cd-dashboard/.env <<EOL
              # Database Configuration
              DATABASE_URL=postgresql://${var.db_username}:${var.db_password}@${var.db_endpoint}:5432/${var.db_name}?schema=public
              
              # Application Settings
              NODE_ENV=production
              PORT=3000
              JWT_SECRET=${var.jwt_secret}
              
              # CORS
              CORS_ORIGIN=*
              
              # Logging
              LOG_LEVEL=info
              EOL
              
              # Create docker-compose.yml
              cat > /opt/ci-cd-dashboard/docker-compose.yml <<EOL
              version: '3.8'
              
              services:
                app:
                  image: your-dockerhub-username/ci-cd-dashboard:latest
                  container_name: ci-cd-dashboard
                  restart: always
                  ports:
                    - "3000:3000"
                  env_file:
                    - .env
                  depends_on:
                    db:
                      condition: service_healthy
                  healthcheck:
                    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
                    interval: 30s
                    timeout: 10s
                    retries: 3
                
                db:
                  image: postgres:13-alpine
                  container_name: ci-cd-db
                  restart: always
                  environment:
                    POSTGRES_USER: ${var.db_username}
                    POSTGRES_PASSWORD: ${var.db_password}
                    POSTGRES_DB: ${var.db_name}
                  volumes:
                    - postgres_data:/var/lib/postgresql/data
                  healthcheck:
                    test: ["CMD-SHELL", "pg_isready -U ${var.db_username} -d ${var.db_name}"]
                    interval: 5s
                    timeout: 5s
                    retries: 5
              
              volumes:
                postgres_data:
              EOL
              
              # Start the application
              cd /opt/ci-cd-dashboard
              docker compose up -d
              EOF
  
  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-app"
    }
  )
}

# Elastic IP for the instance
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  
  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-eip"
    }
  )
}

# Get the latest Ubuntu 22.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  
  owners = ["099720109477"] # Canonical
}
