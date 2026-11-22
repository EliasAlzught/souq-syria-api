# ===== مرحلة البناء =====
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ===== مرحلة التشغيل (أخف وأصغر) =====
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# مجلد الصور المرفوعة - لازم يكون Volume دائم (راجع docker-compose.prod.yml)
RUN mkdir -p uploads/listings uploads/payment-settings

EXPOSE 3000
CMD ["node", "dist/main"]
