resource "random_password" "db_password" {
  length  = 16
  special = false
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/ratemyunit/production/database/password"
  type  = "SecureString"
  value = random_password.db_password.result

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "aws_ssm_parameter" "db_url" {
  name  = "/ratemyunit/production/database/url"
  type  = "SecureString"
  value = format("postgresql://%s:%s@%s/%s", aws_db_instance.postgres.username, random_password.db_password.result, aws_db_instance.postgres.endpoint, aws_db_instance.postgres.db_name)

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "aws_ssm_parameter" "redis_url" {
  name  = "/ratemyunit/production/redis/url"
  type  = "SecureString"
  value = "redis://redis:6379"

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
  name  = "/ratemyunit/production/jwt/secret"
  type  = "SecureString"
  value = random_password.jwt_secret.result

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}

resource "aws_ssm_parameter" "frontend_url" {
  name  = "/ratemyunit/production/frontend/url"
  type  = "String"
  value = "http://localhost:5173"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = "Production"
    Project     = "RateMyUnit"
  }
}
