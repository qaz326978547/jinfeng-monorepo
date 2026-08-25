# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

# ---- deps: full install (incl. devDependencies), used by build/development ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript -> dist ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- production-deps: prod-only node_modules ----
FROM base AS production-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- development: local docker-compose target only (never deployed) ----
# Has devDependencies (tsx, typescript, vitest) so `npm run dev` and
# `npm run db:migrate` / `db:verify` can run against mounted source.
FROM deps AS development
ENV NODE_ENV=development
COPY . .
USER app
EXPOSE 8080
CMD ["npm", "run", "dev"]

# ---- production: default build target, what gets deployed to Zeabur ----
FROM base AS production
ENV NODE_ENV=production
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY migrations ./migrations
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "dist/healthcheck.js"]
CMD ["node", "dist/server.js"]
