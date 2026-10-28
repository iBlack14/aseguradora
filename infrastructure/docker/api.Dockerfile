FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY apps/consulta/package.json apps/consulta/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/database/prisma packages/database/prisma
RUN npm run db:generate
COPY apps/api apps/api
RUN npm run build -w @falabella/api
FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/packages/database/prisma ./packages/database/prisma
EXPOSE 4000
CMD ["sh","-c","npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma && node dist/server.js"]
