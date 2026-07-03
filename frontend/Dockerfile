# Production Dockerfile for Next.js
FROM node:20-alpine AS base

# Pull latest Alpine security patches — the base image is baked with a
# libcrypto3/libssl3 version affected by CVE-2026-45447 (openssl
# PKCS7_verify use-after-free). apk upgrade picks up the fix from
# Alpine's live repo at build time.
RUN apk update && apk upgrade --no-cache

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ARG JWT_SECRET=default_jwt_secret_for_build
ENV JWT_SECRET=$JWT_SECRET
ARG NEXT_PUBLIC_API_URL=https://api-nest-staging.ordermysaddle.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Remove npm/npx/corepack (not needed at runtime, eliminates bundled CVEs)
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]