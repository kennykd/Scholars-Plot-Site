# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_AUTH_DOMAIN
ARG NEXT_PUBLIC_PROJECT_ID
ARG NEXT_PUBLIC_STORAGE_BUCKET
ARG NEXT_PUBLIC_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_APP_ID
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_AUTH_DOMAIN=$NEXT_PUBLIC_AUTH_DOMAIN \
    NEXT_PUBLIC_PROJECT_ID=$NEXT_PUBLIC_PROJECT_ID \
    NEXT_PUBLIC_STORAGE_BUCKET=$NEXT_PUBLIC_STORAGE_BUCKET \
    NEXT_PUBLIC_MESSAGING_SENDER_ID=$NEXT_PUBLIC_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_APP_ID=$NEXT_PUBLIC_APP_ID \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY


ARG DATABASE_URL=postgresql://placeholder
ENV DATABASE_URL=$DATABASE_URL

ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package-lock.json /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/lib/generated/prisma ./lib/generated/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

RUN npm prune --omit=dev

USER nextjs

EXPOSE 3000
CMD ["npm", "start"]
