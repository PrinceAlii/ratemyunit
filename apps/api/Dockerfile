FROM node:20-bookworm-slim

WORKDIR /app

# Install system dependencies (PostgreSQL client + native module deps)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libc6 \
    libgcc1 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Copy root config files
COPY package.json package-lock.json turbo.json ./

# Copy source code
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN npm ci

# Install Playwright browsers (Chromium only to save space/time)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium && \
    npx playwright install-deps chromium

# Build the API and frontend
RUN npx turbo build --filter=@ratemyunit/api...
RUN VITE_API_URL=https://ratemyunit.dev npx turbo build --filter=@ratemyunit/web

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose API port
EXPOSE 3000

# Copy and set entrypoint script
COPY apps/api/scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Start the application via entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]