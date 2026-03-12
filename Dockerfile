# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Generate Prisma client BEFORE TypeScript compilation so model types exist
RUN npx prisma generate
RUN npm run build

# Remove dev dependencies
RUN npm install --omit=dev

# ── Stage 2: Production ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Install Ghostscript for PDF compression
RUN apk add --no-cache ghostscript

WORKDIR /app

# Copy only what is needed
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
# prisma.config.ts tells Prisma v7 where to find the DATABASE_URL at runtime
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Generate Prisma client in production stage
RUN npx prisma generate

# Entrypoint: runs migrations then starts the app
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
