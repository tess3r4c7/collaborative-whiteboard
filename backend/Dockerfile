# Stage 1: Install production dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production runtime
FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "server.js"]
