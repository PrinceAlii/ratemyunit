#!/bin/bash
set -e

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl enable docker
systemctl start docker
usermod -a -G docker ec2-user

# Install Docker Compose
mkdir -p /usr/local/lib/docker/cli-plugins/
curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install CloudWatch Agent and AWS CLI v2
yum install -y amazon-cloudwatch-agent
yum install -y aws-cli

# Configure CloudWatch Agent (Basic)
cat > /opt/aws/amazon-cloudwatch-agent/bin/config.json <<EOF
{
  "metrics": {
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "metrics_collection_interval": 60,
        "resources": ["/"]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/messages",
            "log_group_name": "ratemyunit-system-logs",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/docker.log",
            "log_group_name": "ratemyunit-docker-logs",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json

# Get region from instance metadata (IMDSv2)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s)
REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/placement/region)

# Retrieve secrets from SSM Parameter Store
export POSTGRES_PASSWORD=$(aws ssm get-parameter --name "/ratemyunit/production/database/password" --with-decryption --query "Parameter.Value" --output text --region $REGION)
export JWT_SECRET=$(aws ssm get-parameter --name "/ratemyunit/production/jwt/secret" --with-decryption --query "Parameter.Value" --output text --region $REGION)
export REDIS_URL=$(aws ssm get-parameter --name "/ratemyunit/production/redis/url" --with-decryption --query "Parameter.Value" --output text --region $REGION)
export FRONTEND_URL=$(aws ssm get-parameter --name "/ratemyunit/production/frontend/url" --query "Parameter.Value" --output text --region $REGION)
export GUEST_REVIEW_IP_HASH_SALT=$(aws ssm get-parameter --name "/ratemyunit/production/security/guest_review_ip_hash_salt" --with-decryption --query "Parameter.Value" --output text --region $REGION)
export TRUSTED_PROXY_CIDRS=$(aws ssm get-parameter --name "/ratemyunit/production/network/trusted_proxy_cidrs" --query "Parameter.Value" --output text --region $REGION)

# Create Docker Network
docker network create ratemyunit-net || true

# Start postgres container
docker run -d \
  --name postgres \
  --network ratemyunit-net \
  --restart always \
  -e POSTGRES_USER=ratemyunit \
  -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
  -e POSTGRES_DB=ratemyunit \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Wait for postgres to be ready
echo "Waiting for postgres to be ready..."
for i in {1..30}; do
    if docker exec postgres pg_isready -U ratemyunit >/dev/null 2>&1; then
        echo "Postgres is ready!"
        break
    fi
    sleep 2
done

# Start Redis with persistence
docker run -d \
  --name redis \
  --network ratemyunit-net \
  --restart always \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

# Log in to ECR (non-interactive)
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ecr_repository_url}

# Pull and run API container
# Note: CD pipeline will update this to specific SHA-tagged versions
# This ensures the app is running after boot/reboot
docker pull ${api_image}

export DATABASE_URL="postgresql://ratemyunit:${POSTGRES_PASSWORD}@postgres:5432/ratemyunit"

docker run -d \
  --name ratemyunit-api \
  --network ratemyunit-net \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e REDIS_URL="$REDIS_URL" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e FRONTEND_URL="$FRONTEND_URL" \
  -e GUEST_REVIEW_IP_HASH_SALT="$GUEST_REVIEW_IP_HASH_SALT" \
  -e TRUSTED_PROXY_CIDRS="$TRUSTED_PROXY_CIDRS" \
  ${api_image}

echo "UserData Setup Complete"