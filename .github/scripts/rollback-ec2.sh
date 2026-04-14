#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:?AWS_REGION is required}"
BACKUP_IMAGE_REF="${BACKUP_IMAGE_REF:?BACKUP_IMAGE_REF is required}"
RUNTIME_ENV_FILE="${RUNTIME_ENV_FILE:-/etc/ratemyunit/runtime.env}"
APP_NAME="ratemyunit-api"

fetch_param() {
  local name="$1"
  local with_decryption="${2:-false}"
  if [[ "$with_decryption" == "true" ]]; then
    aws ssm get-parameter \
      --region "$AWS_REGION" \
      --name "$name" \
      --with-decryption \
      --query 'Parameter.Value' \
      --output text
  else
    aws ssm get-parameter \
      --region "$AWS_REGION" \
      --name "$name" \
      --query 'Parameter.Value' \
      --output text
  fi
}

fetch_optional_param() {
  local name="$1"
  local with_decryption="${2:-false}"
  if [[ "$with_decryption" == "true" ]]; then
    aws ssm get-parameter \
      --region "$AWS_REGION" \
      --name "$name" \
      --with-decryption \
      --query 'Parameter.Value' \
      --output text 2>/dev/null || true
  else
    aws ssm get-parameter \
      --region "$AWS_REGION" \
      --name "$name" \
      --query 'Parameter.Value' \
      --output text 2>/dev/null || true
  fi
}

urlencode() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import quote

print(quote(sys.argv[1], safe=""))
PY
}

render_runtime_env() {
  local db_password db_password_encoded redis_url jwt_secret frontend_url guest_salt trusted_proxy_cidrs resend_api_key resend_from_name resend_from_email

  db_password="$(fetch_param /ratemyunit/production/database/password true)"
  db_password_encoded="$(urlencode "$db_password")"
  redis_url="$(fetch_param /ratemyunit/production/redis/url true)"
  jwt_secret="$(fetch_param /ratemyunit/production/jwt/secret true)"
  frontend_url="$(fetch_param /ratemyunit/production/frontend/url false)"
  guest_salt="$(fetch_param /ratemyunit/production/security/guest_review_ip_hash_salt true)"
  trusted_proxy_cidrs="$(fetch_param /ratemyunit/production/network/trusted_proxy_cidrs false)"
  resend_api_key="$(fetch_optional_param /ratemyunit/production/resend/api_key true)"
  resend_from_name="$(fetch_optional_param /ratemyunit/production/resend/from_name false)"
  resend_from_email="$(fetch_optional_param /ratemyunit/production/resend/from_email false)"

  mkdir -p "$(dirname "$RUNTIME_ENV_FILE")"
  cat >"$RUNTIME_ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://ratemyunit:${db_password_encoded}@postgres:5432/ratemyunit
REDIS_URL=${redis_url}
JWT_SECRET=${jwt_secret}
FRONTEND_URL=${frontend_url}
GUEST_REVIEW_IP_HASH_SALT=${guest_salt}
TRUSTED_PROXY_CIDRS=${trusted_proxy_cidrs}
RESEND_API_KEY=${resend_api_key}
RESEND_FROM_NAME=${resend_from_name:-RateMyUnit}
RESEND_FROM_EMAIL=${resend_from_email:-verify@send.ratemyunit.dev}
EOF
  chmod 600 "$RUNTIME_ENV_FILE"
}

main() {
  render_runtime_env

  registry="${BACKUP_IMAGE_REF%%/*}"
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
  docker pull "$BACKUP_IMAGE_REF" >/dev/null

  docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$APP_NAME" \
    --network ratemyunit-net \
    --restart unless-stopped \
    -p 80:3000 \
    --env-file "$RUNTIME_ENV_FILE" \
    -e FIRST_DEPLOY=false \
    -e AUTO_SEED=false \
    "$BACKUP_IMAGE_REF" >/dev/null

  docker ps --filter "name=${APP_NAME}"
}

main "$@"
