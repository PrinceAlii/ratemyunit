#!/bin/bash
set -euo pipefail

# Update system
yum update -y

# Install runtime dependencies
yum install -y docker amazon-cloudwatch-agent aws-cli python3
systemctl enable docker
systemctl start docker
usermod -a -G docker ec2-user

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

fetch_param() {
  local name="$1"
  local with_decryption="${2:-false}"
  if [[ "$with_decryption" == "true" ]]; then
    aws ssm get-parameter --name "$name" --with-decryption --query "Parameter.Value" --output text --region "$REGION"
  else
    aws ssm get-parameter --name "$name" --query "Parameter.Value" --output text --region "$REGION"
  fi
}

urlencode() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import quote

print(quote(sys.argv[1], safe=""))
PY
}

POSTGRES_PASSWORD=$(fetch_param "/ratemyunit/production/database/password" true)
POSTGRES_PASSWORD_ENCODED=$(urlencode "$POSTGRES_PASSWORD")
JWT_SECRET=$(fetch_param "/ratemyunit/production/jwt/secret" true)
REDIS_URL=$(fetch_param "/ratemyunit/production/redis/url" true)
FRONTEND_URL=$(fetch_param "/ratemyunit/production/frontend/url" false)
GUEST_REVIEW_IP_HASH_SALT=$(fetch_param "/ratemyunit/production/security/guest_review_ip_hash_salt" true)
TRUSTED_PROXY_CIDRS=$(fetch_param "/ratemyunit/production/network/trusted_proxy_cidrs" false)
RESEND_API_KEY=$(fetch_param "/ratemyunit/production/resend/api_key" true 2>/dev/null || true)
RESEND_FROM_NAME=$(fetch_param "/ratemyunit/production/resend/from_name" false 2>/dev/null || echo "RateMyUnit")
RESEND_FROM_EMAIL=$(fetch_param "/ratemyunit/production/resend/from_email" false 2>/dev/null || echo "verify@send.ratemyunit.dev")

# Create Docker Network
docker network create ratemyunit-net || true

mkdir -p /etc/ratemyunit /var/lib/ratemyunit
cat >/etc/ratemyunit/runtime.env <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://ratemyunit:${POSTGRES_PASSWORD_ENCODED}@postgres:5432/ratemyunit
REDIS_URL=${REDIS_URL}
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=${FRONTEND_URL}
GUEST_REVIEW_IP_HASH_SALT=${GUEST_REVIEW_IP_HASH_SALT}
TRUSTED_PROXY_CIDRS=${TRUSTED_PROXY_CIDRS}
RESEND_API_KEY=${RESEND_API_KEY}
RESEND_FROM_NAME=${RESEND_FROM_NAME}
RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}
EOF
chmod 600 /etc/ratemyunit/runtime.env

# Start postgres container
docker run -d \
  --name postgres \
  --network ratemyunit-net \
  --restart always \
  -e POSTGRES_USER=ratemyunit \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  -e POSTGRES_DB=ratemyunit \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:18.3-alpine || docker start postgres

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
  redis:8.4.1-alpine redis-server --appendonly yes || docker start redis

echo "UserData setup complete. Application container is deployed by GitHub Actions."
