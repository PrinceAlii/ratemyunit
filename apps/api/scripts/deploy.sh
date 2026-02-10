#!/bin/bash
# Manual deployment script for EC2
# Run this on EC2 after pushing code changes

set -e

echo "🚀 Deploying RateMyUnit API..."
echo ""

# Pull latest code
echo "📦 Pulling latest Docker image..."
sudo docker-compose pull api

# Stop old container
echo "⏹️  Stopping old container..."
sudo docker-compose stop api

# Run migrations and seeds
echo "📊 Running migrations and seeds..."
sudo docker-compose run --rm -e AUTO_SEED=true api echo "Setup complete"

# Start new container
echo "▶️  Starting new container..."
sudo docker-compose up -d api

# Show logs
echo ""
echo "📋 Logs:"
sudo docker logs --tail 50 -f ratemyunit-api
