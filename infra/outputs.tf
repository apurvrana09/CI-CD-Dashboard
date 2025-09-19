# VPC Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

# EC2 Outputs
output "ec2_instance_id" {
  description = "The ID of the EC2 instance"
  value       = module.ec2.instance_id
}

output "ec2_public_ip" {
  description = "The public IP address of the EC2 instance"
  value       = module.ec2.public_ip
}

output "ec2_public_dns" {
  description = "The public DNS name of the EC2 instance"
  value       = module.ec2.public_dns
}

# RDS Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "rds_database_name" {
  description = "The name of the database"
  value       = module.rds.db_instance_name
  sensitive   = true
}

# Security Group Outputs
output "ec2_security_group_id" {
  description = "The ID of the EC2 security group"
  value       = module.security_groups.ec2_security_group_id
}

output "rds_security_group_id" {
  description = "The ID of the RDS security group"
  value       = module.security_groups.rds_security_group_id
}

# Application URL
output "application_url" {
  description = "URL to access the application"
  value       = "http://${module.ec2.public_dns}:3000"
}
