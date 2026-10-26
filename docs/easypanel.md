# Deploy del cotizador en Easypanel

## Opción recomendada

Crear el cotizador como un servicio adicional dentro del mismo proyecto de Easypanel.

- **Source:** repositorio Git.
- **Build method:** Dockerfile.
- **Dockerfile:** `infrastructure/docker/cotizador.Dockerfile`.
- **Build context:** raíz del repositorio.
- **Internal port:** `3002`.
- **Start command:** dejar vacío; ya está definido en el Dockerfile.
- **Health check:** `GET /`.

En variables de entorno configurar:

```env
NODE_ENV=production
API_URL=http://api:4000
```

`api` debe ser el nombre interno del servicio Fastify dentro del mismo proyecto. Si Easypanel le asigna otro nombre, reemplaza `api` por el hostname interno que muestre el panel.

Después de desplegar, activar un dominio para el servicio `cotizador`. No se debe exponer PostgreSQL públicamente. La API tampoco necesita dominio público si solo la consumen `web`, `admin` y `cotizador` dentro de la red del proyecto.

## Usando Docker Compose

El servicio ya está incluido como `cotizador` en `docker-compose.yml`. En Easypanel, si se importa el Compose completo, publicar únicamente el puerto del servicio `cotizador` y mantener `API_URL=http://api:4000`.

Antes de producción, cambiar los assets de referencia de `apps/cotizador/public/assets/reference` por recursos propios o autorizados.
