#!/bin/bash
set -euo pipefail

echo "This script is deprecated."
echo "Production deploys are performed by GitHub Actions via SSM using .github/scripts/*.sh."
echo "If you need to inspect the running app manually, use:"
echo "  docker logs --tail 200 -f ratemyunit-api"
