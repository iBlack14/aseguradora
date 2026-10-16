# Plataforma Seguros Falabella — propuesta

Monorepo para el cotizador público de SOAT, el panel interno de operaciones y la API.

## Aplicaciones

- `apps/web`: portal público en Next.js.
- `apps/admin`: sistema interno en Next.js.
- `apps/api`: API HTTP en Fastify con persistencia PostgreSQL.
- `packages/database`: esquema Prisma/PostgreSQL.
- `packages/validation`: contratos Zod compartidos.
- `packages/ui`: componentes y tokens compartidos.
- `prototypes`: diseños HTML y exportaciones de Stitch conservados como referencia.

## Desarrollo

1. Copia `.env.example` a `.env`.
2. Ajusta `DATABASE_URL` para usar `localhost` si ejecutarás la API fuera de Docker.
3. Ejecuta PostgreSQL localmente o con Docker.
4. Ejecuta `npm install` y `npm run db:generate`.
5. Usa `npm run dev:web`, `npm run dev:admin` y `npm run dev:api` en terminales separadas.

Sin `DATABASE_URL`, la API usa memoria únicamente en desarrollo. Los precios y beneficios incluidos actualmente son tarifas demostrativas; `DEMO_MODE` debe permanecer en `false` en producción para no simular datos vehiculares.

## Despliegue en VPS

1. Instala Docker Engine, Docker Compose y un proxy HTTPS (Nginx, Caddy o Traefik).
2. Copia `.env.example` a `.env` y reemplaza todas las credenciales. La contraseña incluida en `DATABASE_URL` debe estar codificada para URL si contiene símbolos reservados.
3. Configura `VERIFIK_TOKEN`; sin proveedor disponible, la consulta vehicular devuelve un error y nunca inventa datos con `DEMO_MODE=false`.
4. Ejecuta `docker compose config` y luego `docker compose up -d --build`.
5. Publica `127.0.0.1:3000` para la web y `127.0.0.1:3001` para el panel mediante HTTPS. PostgreSQL y la API quedan solo en la red interna de Docker.
6. Verifica `docker compose ps`, `curl http://127.0.0.1:3000` y el acceso al panel administrativo.

La API aplica automáticamente las migraciones Prisma al iniciar. El endpoint de emisión/pago continúa deshabilitado hasta conectar una pasarela y los adaptadores reales de aseguradoras.
