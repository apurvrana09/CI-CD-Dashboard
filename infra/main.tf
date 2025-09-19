# Generate a random string for JWT secret if not provided
resource "random_string" "jwt_secret" {
  length  = 32
  special = true
}

# Generate a random password for the database if not provided
resource "random_password" "db_password" {
  length  = 16
  special = false
  # Ensure the password only contains valid characters for RDS
  override_special = "!@#%^&*()_+{}[]:;<>?,."
  min_special = 1
  min_upper   = 1
  min_lower   = 1
  min_numeric = 1
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

# Create RDS Database in public subnet (for free tier)
module "rds" {
  source = "./modules/rds"
  
  subnet_ids           = module.vpc.public_subnet_ids  # Using public subnets for free tier
  db_security_group_id = module.security_groups.rds_security_group_id
  environment          = var.environment
  project_name         = var.project_name
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password != "" ? var.db_password : random_password.db_password.result
  db_instance_class    = var.db_instance_class
  publicly_accessible  = true  # Required for public subnet access
  tags                 = var.tags
  
  depends_on = [module.security_groups]
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
  db_username       = var.db_username
  db_password       = var.db_password != "" ? var.db_password : random_password.db_password.result
  db_name           = var.db_name
  db_endpoint       = module.rds.db_instance_endpoint
  jwt_secret        = var.jwt_secret != "" ? var.jwt_secret : random_string.jwt_secret.result
  tags              = var.tags
  
  depends_on = [module.rds]
}
