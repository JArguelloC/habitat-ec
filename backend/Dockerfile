# ==============================================================================
# HÁBITAT EC - BACKEND (NestJS 12 + TypeORM + PostgreSQL Neon)
# Multi-Stage Production Dockerfile
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S habitat && adduser -S habitat -G habitat

COPY --from=builder --chown=habitat:habitat /app/package*.json ./
COPY --from=builder --chown=habitat:habitat /app/node_modules ./node_modules
COPY --from=builder --chown=habitat:habitat /app/dist ./dist

USER habitat

EXPOSE 3000

CMD ["node", "dist/main.js"]

