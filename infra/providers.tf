provider "aws" {
  region = var.aws_region
  
  # Prevent accidental deletion of resources
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "ci-cd-dashboard"
      ManagedBy   = "terraform"
    }
  }
}

# For managing ACM certificates in us-east-1 (required for CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "ci-cd-dashboard"
      ManagedBy   = "terraform"
    }
  }
}
