# syntax=docker/dockerfile:1
# Reference Dockerfile for the future Node.js rebuild. Node 22+, multi-stage, non-root runtime.

ARG NODE_VERSION=22-alpine

# ---------- deps: install all dependencies (incl. dev) for build ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build: compile TypeScript ----------
FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- prod-deps: install only production dependencies ----------
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- development: hot-reload, full toolchain, runs as root-less user too ----------
FROM node:${NODE_VERSION} AS development
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER app
ENV NODE_ENV=development
EXPOSE 8080
CMD ["npm", "run", "dev"]

# ---------- production: minimal runtime image ----------
FROM node:${NODE_VERSION} AS production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY migrations ./migrations
USER app
ENV NODE_ENV=production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node dist/healthcheck.js || exit 1
CMD ["node", "dist/server.js"]
