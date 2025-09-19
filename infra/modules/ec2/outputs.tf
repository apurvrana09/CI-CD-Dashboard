output "instance_id" {
  description = "The ID of the EC2 instance"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "The public IP address of the EC2 instance"
  value       = aws_eip.app.public_ip
}

output "public_dns" {
  description = "The public DNS name of the EC2 instance"
  value       = aws_eip.app.public_dns
}

output "private_ip" {
  description = "The private IP address of the EC2 instance"
  value       = aws_instance.app.private_ip
}

output "instance_arn" {
  description = "The ARN of the EC2 instance"
  value       = aws_instance.app.arn
}

output "eip_allocation_id" {
  description = "The allocation ID of the Elastic IP"
  value       = aws_eip.app.allocation_id
}

output "ami_id" {
  description = "The ID of the AMI used for the EC2 instance"
  value       = data.aws_ami.ubuntu.id
}
