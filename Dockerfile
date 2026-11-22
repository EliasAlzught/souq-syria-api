
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma

# Copy the Prisma Client generated in the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy NestJS build
COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads/listings uploads/payment-settings

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
