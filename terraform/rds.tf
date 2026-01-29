# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "ratemyunit-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "ratemyunit-db-subnet-group"
  }
}

# RDS Instance
resource "aws_db_instance" "postgres" {
  identifier        = "ratemyunit-prod-db"
  engine            = "postgres"
  engine_version    = "16.6"
  instance_class    = "db.t3.micro" # Free Tier
  allocated_storage = 20
  storage_type      = "gp2"
  db_name           = "ratemyunit"
  username          = "ratemyunit"

  # In a production Terraform setup, this should come from a variable or 
  # be managed via the aws_ssm_parameter resource. 
  # For now, we define it as a placeholder.
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  publicly_accessible = false
  skip_final_snapshot = true

  backup_retention_period = 0 # No backups needed
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name = "ratemyunit-db"
  }
}
