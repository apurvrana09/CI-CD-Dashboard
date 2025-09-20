# Generate a random string for JWT secret if not provided
resource "random_string" "jwt_secret" {
  length  = 32
  special = true
}

# Create VPC with only public subnets (free tier friendly)
module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr     = var.vpc_cidr
  environment  = var.environment
  project_name = var.project_name
  tags         = var.tags
}

# Create Security Groups
module "security_groups" {
  source = "./modules/security"
  
  vpc_id       = module.vpc.vpc_id
  environment  = var.environment
  project_name = var.project_name
  tags         = var.tags
  
  depends_on = [module.vpc]
}

# Create EC2 Instance in public subnet
module "ec2" {
  source = "./modules/ec2"
  
  instance_type     = var.instance_type
  key_name          = var.key_name
  security_group_id = module.security_groups.ec2_security_group_id
  subnet_id         = module.vpc.public_subnet_ids[0]  # Use first public subnet
  environment       = var.environment
  project_name      = var.project_name
  jwt_secret        = var.jwt_secret != "" ? var.jwt_secret : random_string.jwt_secret.result
  tags              = var.tags
  
  depends_on = [module.security_groups]
}
