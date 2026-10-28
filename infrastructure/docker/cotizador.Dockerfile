FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/cotizador/package.json apps/cotizador/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY apps/consulta/package.json apps/consulta/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/cotizador apps/cotizador
RUN npm run build -w @falabella/cotizador

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/cotizador/.next ./apps/cotizador/.next
COPY --from=build /app/apps/cotizador/public ./apps/cotizador/public
COPY --from=build /app/apps/cotizador/package.json ./apps/cotizador/package.json
COPY --from=build /app/apps/cotizador/next.config.mjs ./apps/cotizador/next.config.mjs
EXPOSE 3002
CMD ["node","node_modules/next/dist/bin/next","start","apps/cotizador","-p","3002"]
