resource "random_password" "db_password" {
  length  = 16
  special = false
}

resource "aws_kms_key" "ssm_parameters" {
  description             = "KMS key for RateMyUnit SSM SecureString parameters"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "ssm_parameters" {
  name          = "alias/ratemyunit-ssm-parameters"
  target_key_id = aws_kms_key.ssm_parameters.key_id
}

resource "aws_ssm_parameter" "db_password" {
  name   = "/ratemyunit/production/database/password"
  type   = "SecureString"
  value  = random_password.db_password.result
  key_id = aws_kms_key.ssm_parameters.arn

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "aws_ssm_parameter" "db_url" {
  name   = "/ratemyunit/production/database/url"
  type   = "SecureString"
  value  = format("postgresql://%s:%s@%s/%s?sslmode=require", aws_db_instance.postgres.username, random_password.db_password.result, aws_db_instance.postgres.endpoint, aws_db_instance.postgres.db_name)
  key_id = aws_kms_key.ssm_parameters.arn

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "aws_ssm_parameter" "redis_url" {
  name   = "/ratemyunit/production/redis/url"
  type   = "SecureString"
  value  = "redis://redis:6379"
  key_id = aws_kms_key.ssm_parameters.arn

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "random_password" "jwt_secret" {
  length  = 32
  special = true
}

resource "aws_ssm_parameter" "jwt_secret" {
  name   = "/ratemyunit/production/jwt/secret"
  type   = "SecureString"
  value  = random_password.jwt_secret.result
  key_id = aws_kms_key.ssm_parameters.arn

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "aws_ssm_parameter" "frontend_url" {
  name  = "/ratemyunit/production/frontend/url"
  type  = "String"
  value = "https://ratemyunit.dev"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "random_password" "guest_review_ip_hash_salt" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "guest_review_ip_hash_salt" {
  name   = "/ratemyunit/production/security/guest_review_ip_hash_salt"
  type   = "SecureString"
  value  = random_password.guest_review_ip_hash_salt.result
  key_id = aws_kms_key.ssm_parameters.arn

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "aws_ssm_parameter" "trusted_proxy_cidrs" {
  name  = "/ratemyunit/production/network/trusted_proxy_cidrs"
  type  = "String"
  value = "173.245.48.0/20,103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,141.101.64.0/18,108.162.192.0/18,190.93.240.0/20,188.114.96.0/20,197.234.240.0/22,198.41.128.0/17,162.158.0.0/15,104.16.0.0/13,104.24.0.0/14,172.64.0.0/13,131.0.72.0/22,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2a06:98c0::/29,2c0f:f248::/32"

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

# Resend API Key for email sending
# Value is managed by GitHub Actions workflow from RESEND_API_KEY secret
# Terraform only ensures the parameter exists
resource "aws_ssm_parameter" "resend_api_key" {
  name   = "/ratemyunit/production/resend/api_key"
  type   = "SecureString"
  value  = "placeholder"
  key_id = aws_kms_key.ssm_parameters.arn

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}
