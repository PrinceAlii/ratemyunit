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
