output "ec2_public_ip" {
  description = "The public IP address of the EC2 instance"
  value       = aws_eip.api_eip.public_ip
}

output "api_public_ip" {
  description = "The public IP address of the API EC2 instance"
  value       = aws_eip.api_eip.public_ip
}

output "api_instance_id" {
  description = "The EC2 instance ID for the API server"
  value       = aws_instance.api.id
}

output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}
