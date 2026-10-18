# Stage 1: Install production dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production runtime
FROM node:20-alpine
WORKDIR /app
# Upgrade Alpine OS packages (e.g., openssl CVE-2026-45447) to latest patched versions
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001
# Remove npm/npx (not needed at runtime) — also removes bundled vulnerable ws
RUN npm cache clean --force && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "server.js"]
