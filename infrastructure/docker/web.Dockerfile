FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY apps/consulta/package.json apps/consulta/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN npm run build -w @falabella/web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","apps/web","-p","3000"]
