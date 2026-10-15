# Plataforma Seguros Falabella — propuesta

Monorepo para el cotizador público de SOAT, el panel interno de operaciones y la API.

## Aplicaciones

- `apps/web`: portal público en Next.js.
- `apps/admin`: sistema interno en Next.js.
- `apps/api`: API HTTP en Fastify.
- `packages/database`: esquema Prisma/PostgreSQL.
- `packages/validation`: contratos Zod compartidos.
- `packages/ui`: componentes y tokens compartidos.
- `prototypes`: diseños HTML y exportaciones de Stitch conservados como referencia.

## Desarrollo

1. Copia `.env.example` a `.env`.
2. Ejecuta `docker compose up -d postgres redis`.
3. Ejecuta `npm install` y `npm run db:generate`.
4. Usa `npm run dev:web`, `npm run dev:admin` y `npm run dev:api` en terminales separadas.

Los precios y beneficios incluidos actualmente son datos demostrativos. La integración con aseguradoras y pasarelas de pago debe conectarse mediante credenciales de producción.
