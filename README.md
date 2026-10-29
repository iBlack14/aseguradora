# Plataforma Seguros Falabella — propuesta

## Registro manual de certificados

En el panel, **Registro APESEG** (`/registro-apeseg`) permite registrar, buscar por placa y editar certificados con los 22 campos observados en el resultado de consulta SOAT. Conserva números de póliza con ceros iniciales y calcula la vigencia a partir de las fechas, respetando las anulaciones. Estos registros son internos: no inscriben certificados ante APESEG ni emiten pólizas. Se consultan por placa tanto desde la Web como desde la página de consulta similar a APESEG, mediante `/v1/soat/consulta`; la página independiente también muestra el historial.

ADMIN, OPERATIONS y SALES pueden guardar cambios; SUPPORT y AUDITOR solo consultan. Las rutas `/v1/soat-registry` (GET y POST) y `/v1/soat-registry/:id` (PUT) requieren autenticación interna y rol.

Con PostgreSQL se usa el modelo `SoatCertificate`, con auditoría transaccional. Aplicar la migración `20261027090000_add_soat_certificates` antes del despliegue; Docker la aplica al iniciar la API. En desarrollo sin DATABASE_URL, los registros se guardan de forma persistente en `apps/api/.local-data/soat-certificates.json` al iniciar la API desde su workspace. Los archivos locales quedan excluidos de Git y Docker.

Monorepo para el cotizador público de SOAT, el panel interno de operaciones y la API.

## Aplicaciones

- `apps/web`: portal público en Next.js.
- `apps/admin`: sistema interno en Next.js.
- `apps/consulta`: consulta SOAT independiente, referencia visual APESEG, en el puerto 3003. Ver `apps/consulta/README.md`.
- `apps/cotizador`: cotizador independiente en Next.js, conectado a la misma API y base de datos.
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
5. Usa `npm run dev:web`, `npm run dev:admin`, `npm run dev:cotizador` y `npm run dev:api` en terminales separadas.

Para desplegar el cotizador en Easypanel, consulta `docs/easypanel.md`.

Sin `DATABASE_URL`, la API usa memoria únicamente en desarrollo. Los precios y beneficios incluidos actualmente son tarifas demostrativas; `DEMO_MODE` debe permanecer en `false` en producción para no simular datos vehiculares.

## Despliegue en VPS

1. Instala Docker Engine, Docker Compose y un proxy HTTPS (Nginx, Caddy o Traefik).
2. Copia `.env.example` a `.env` y reemplaza todas las credenciales. La contraseña incluida en `DATABASE_URL` debe estar codificada para URL si contiene símbolos reservados.
3. Configura `VERIFIK_TOKEN`; sin proveedor disponible, la consulta vehicular devuelve un error y nunca inventa datos con `DEMO_MODE=false`.
4. Ejecuta `docker compose config` y luego `docker compose up -d --build`.
5. En un VPS, publica `127.0.0.1:3000` para la web y `127.0.0.1:3001` para el panel mediante un proxy HTTPS. En Easypanel, configura dominios propios para `web` y `admin`; no uses `https://localhost:3001`, porque `3001` es solo el puerto interno del contenedor. PostgreSQL y la API quedan solo en la red interna de Docker.
6. Verifica `docker compose ps`, `curl http://127.0.0.1:3000` y el acceso al panel administrativo.

La API aplica automáticamente las migraciones Prisma al iniciar. El endpoint de emisión/pago continúa deshabilitado hasta conectar una pasarela y los adaptadores reales de aseguradoras.

## Acceso interno y emisión

Configura el mismo `ADMIN_API_KEY` aleatorio en los servicios `api` y `admin`. Es una credencial interna: no debe configurarse en `web`, `cotizador` ni variables `NEXT_PUBLIC_*`. En producción la API requiere esta clave para iniciar; el proxy administrativo requiere además una sesión válida y comprueba el rol. Solo ADMIN puede cambiar usuarios, tarifas y configuración; SUPPORT y AUDITOR tienen acceso de lectura.

La emisión y la generación de certificados están deshabilitadas hasta integrar confirmación de pago y emisión oficial. Los números simulados anteriores no se muestran como pólizas vigentes en la consulta pública. Las tarifas modificadas se guardan en PostgreSQL mediante AppSetting; sin base de datos, el modo de desarrollo utiliza memoria temporal. Si falla una escritura con base de datos configurada, se devuelve un error sin anunciar éxito.

## Verificación

- `npm run typecheck`: comprobación de tipos de todos los paquetes.
- `npm test`: compila la API y comprueba acceso por roles, emisión deshabilitada, validación de tarifas y cotización pública en un proceso aislado sin base de datos.
- `npm run build` y después `npm run test:proxies`: compila las aplicaciones y prueba sus proxies HTTP con sesiones válidas, inválidas y distintos roles.

Para desarrollo local, configura la misma clave `ADMIN_API_KEY` en `apps/api/.env` y `apps/admin/.env.local` (archivos ignorados por Git). En Docker/Easypanel se inyecta mediante variables de entorno.
