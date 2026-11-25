
# =========================
# Build stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

# Generate Prisma Client from the current schema
RUN npx prisma generate

# Build NestJS
RUN npm run build


# =========================
# Production stage
# =========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy Prisma schema
COPY --from=builder /app/prisma ./prisma

# Copy generated Prisma Client
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy NestJS build
COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads/listings uploads/payment-settings

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
