output "ec2_public_ip" {
  description = "The public IP address of the EC2 instance"
  value       = aws_eip.api_eip.public_ip
}

output "api_public_ip" {
  description = "The public IP address of the API EC2 instance"
  value       = aws_eip.api_eip.public_ip
}

output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "s3_bucket_name" {
  description = "The name of the frontend S3 bucket"
  value       = aws_s3_bucket.frontend.id
}

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "frontend_url" {
  description = "The frontend URL (CloudFront)"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "update_frontend_url_command" {
  description = "Command to update the frontend URL in SSM Parameter Store"
  value       = "aws ssm put-parameter --name '/ratemyunit/production/frontend/url' --value 'https://${aws_cloudfront_distribution.frontend.domain_name}' --overwrite --region ${data.aws_region.current.name}"
}
