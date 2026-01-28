terraform {
  backend "s3" {
    bucket         = "ratemyunit-terraform-state"
    key            = "state/terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = true
    dynamodb_table = "ratemyunit-terraform-lock"
  }
}
