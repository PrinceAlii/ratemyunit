FROM node:20-bookworm

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy root config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy source code
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Install Playwright browsers (Chromium only to save space/time)
# We use npx playwright install because we are in the root context
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Build the API and its dependencies
RUN pnpm turbo build --filter=@ratemyunit/api...

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Playwright needs this to find browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Expose API port
EXPOSE 3000

# Start the application
CMD ["node", "apps/api/dist/index.js"]
