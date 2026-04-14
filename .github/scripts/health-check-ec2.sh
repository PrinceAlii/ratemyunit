#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-ratemyunit-api}"
HEALTH_URL="${HEALTH_URL:-http://localhost/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-24}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-5}"

print_diagnostics() {
  echo "Container status:"
  docker inspect "$APP_NAME" --format '{{json .State}}' || true
  echo ""
  echo "Container process list:"
  docker top "$APP_NAME" || true
  echo ""
  echo "Listening sockets:"
  ss -ltnp || true
  echo ""
  echo "Recent container logs:"
  docker logs --tail 200 "$APP_NAME" || true
}

for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  if ! docker inspect "$APP_NAME" >/dev/null 2>&1; then
    echo "Health check failed: ${APP_NAME} container is missing"
    print_diagnostics
    exit 1
  fi

  running="$(docker inspect --format '{{.State.Running}}' "$APP_NAME")"
  if [[ "$running" != "true" ]]; then
    echo "Health check failed: ${APP_NAME} is not running"
    print_diagnostics
    exit 1
  fi

  http_code="$(curl --max-time 5 -sS -o /tmp/ratemyunit-health.json -w '%{http_code}' "$HEALTH_URL" || true)"
  if [[ "$http_code" == "200" ]]; then
    echo "✓ Health check passed"
    cat /tmp/ratemyunit-health.json
    exit 0
  fi

  echo "Health check attempt ${attempt}/${HEALTH_ATTEMPTS} returned HTTP ${http_code:-000}"
  if [[ "$attempt" == "$HEALTH_ATTEMPTS" ]]; then
    print_diagnostics
    exit 1
  fi

  sleep "$HEALTH_SLEEP_SECONDS"
done
