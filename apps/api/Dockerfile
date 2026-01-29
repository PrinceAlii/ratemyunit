FROM node:20-bookworm

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json turbo.json ./

# Copy source code
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN npm ci

# Install Playwright browsers (Chromium only to save space/time)
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Build the API and frontend
RUN npx turbo build --filter=@ratemyunit/api...
RUN VITE_API_URL=https://ratemyunit.dev npx turbo build --filter=@ratemyunit/web

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Playwright needs this to find browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Expose API port
EXPOSE 3000

# Start the application
CMD ["node", "apps/api/dist/index.js"]