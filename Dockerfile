# ─── Stage 1: Base ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install system dependencies required for OpenSSL/Prisma and clean up apt cache
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1

# ─── Stage 2: Dependencies ──────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 3: Builder ───────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prisma generate does not open a DB connection; placeholder
ENV DATABASE_URL=postgresql://build:[REDACTED]@127.0.0.1:5432/build?sslmode=disable
RUN npx prisma generate

# Build Arguments (passed from your CI/CD or docker-compose build args)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_DOCS_ENABLED
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Expose arguments to the Next.js compilation process
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
  NEXT_PUBLIC_API_DOCS_ENABLED=${NEXT_PUBLIC_API_DOCS_ENABLED} \
  NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY} \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN} \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID} \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET} \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID} \
  NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID} \
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}

RUN npm run build

# ─── Stage 4: Migrator ──────────────────────────────────────────────────────
# One-off migrations run on the VPS via: docker compose --profile migrate run --rm db-schema-sync
FROM base AS migrator
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL=postgresql://migrate:[REDACTED]@127.0.0.1:5432/migrate?sslmode=disable
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# ─── Stage 5: Runner ────────────────────────────────────────────────────────
FROM base AS runner

LABEL org.opencontainers.image.title="scholars-plot-site"
LABEL org.opencontainers.image.url="https://e2526-wads-b4bc-05.csbihub.id"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/lib/generated/prisma ./lib/generated/prisma

USER nextjs

EXPOSE 3026
ENV NODE_ENV=production
ENV PORT=3026
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]