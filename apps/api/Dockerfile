# syntax=docker/dockerfile:1
#
# Build from the REPOSITORY ROOT (the compose file sets context: ..):
#   docker build -f apps/api/Dockerfile -t artsheaven-api:local .
#
# Source is copied file-by-file rather than with `COPY apps/api/ ./` so that a
# local apps/api/.env (which may contain real secrets) is never baked into an image layer.

# ---------------------------------------------------------------------------
# 1. Dependencies (all deps kept so `prisma` CLI is available at runtime)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/package.json apps/api/nest-cli.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./
COPY apps/api/src ./src
COPY apps/api/prisma ./prisma
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# 3. Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production
RUN apk add --no-cache openssl \
    && addgroup -S app \
    && adduser -S -G app app
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod 755 ./docker-entrypoint.sh && chown -R app:app /app
USER app

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
