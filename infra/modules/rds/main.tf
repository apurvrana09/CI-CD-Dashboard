# Create RDS Subnet Group with public subnets
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-subnet-group"
  subnet_ids = var.subnet_ids
  
  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-db-subnet-group"
    }
  )
}

# Create RDS Parameter Group
resource "aws_db_parameter_group" "main" {
  name        = "${var.project_name}-${var.environment}-pg13"
  family      = "postgres13"
  description = "Parameter group for ${var.project_name} ${var.environment} database"
  
  parameter {
    name  = "log_connections"
    value = "1"
  }
  
  parameter {
    name  = "log_statement"
    value = "all"
  }
  
  tags = var.tags
}

# Create RDS Instance (Free Tier compatible)
resource "aws_db_instance" "main" {
  # Basic Configuration
  identifier             = "${var.project_name}-${var.environment}-db"
  instance_class         = var.db_instance_class
  allocated_storage      = 20  # GB (Free tier allows up to 20GB)
  max_allocated_storage  = 20  # Keep at 20GB for free tier
  storage_type           = "gp2"
  storage_encrypted      = false  # Encryption not in free tier
  
  # Database Configuration
  engine                 = "postgres"
  engine_version         = "13.15"  # Updated to a valid PostgreSQL version
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  parameter_group_name   = aws_db_parameter_group.main.name
  
  # Network & Security
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.db_security_group_id]
  publicly_accessible    = var.publicly_accessible
  
  # Backup & Maintenance
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  # Deletion Protection
  deletion_protection    = var.environment == "prod" ? true : false
  skip_final_snapshot    = var.environment == "prod" ? false : true
  
  # Performance Insights (disabled for free tier)
  performance_insights_enabled = false
  
  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-db"
    }
  )
  
  # Ensure parameter group is created first
  depends_on = [aws_db_parameter_group.main]
}
