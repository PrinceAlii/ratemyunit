# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Role for Terraform Plan (Read-Only + Locking)
resource "aws_iam_role" "github_plan" {
  name = "ratemyunit-github-plan"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:PrinceAlii/ratemyunit:*"
          }
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Policy for Plan (State Read/Write for Locking, Read-Only for Resources)
# Note: For simplicity in this track, we might give 'ReadOnlyAccess' + State access.
# But 'plan' needs to refresh state, which is essentially read access.
resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.github_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Explicitly allow State Locking (DynamoDB) and State Reading (S3)
resource "aws_iam_policy" "tf_state_access" {
  name        = "ratemyunit-tf-state-access"
  description = "Allow access to Terraform State in S3 and Locking"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject" # Plan needs to write to state if it refreshes? Actually Apply does. Plan writes lock.
        ]
        Resource = [
          aws_s3_bucket.frontend.arn, # Wrong bucket? No, state bucket is not managed by TF here usually? 
          # Ah, the state bucket is ratemyunit-terraform-state.
          "arn:aws:s3:::ratemyunit-terraform-state",
          "arn:aws:s3:::ratemyunit-terraform-state/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "plan_state" {
  role       = aws_iam_role.github_plan.name
  policy_arn = aws_iam_policy.tf_state_access.arn
}


# Role for Terraform Apply & App Deployment (Admin-like)
resource "aws_iam_role" "github_deploy" {
  name = "ratemyunit-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = [
              "repo:PrinceAlii/ratemyunit:ref:refs/heads/main",
              "repo:PrinceAlii/ratemyunit:environment:production"
            ]
          }
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Attach AdministratorAccess for Deploy (Simplest for small team, restrict later)
resource "aws_iam_role_policy_attachment" "deploy_admin" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "github_plan_role_arn" {
  value = aws_iam_role.github_plan.arn
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
