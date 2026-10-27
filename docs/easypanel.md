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

## Panel administrativo

Si se importa el `docker-compose.yml` completo, el servicio `admin` debe publicarse en el puerto interno `3001` y tener su propio dominio en Easypanel, por ejemplo `admin.tudominio.com`. La URL pública será:

```text
https://admin.tudominio.com/login
```

No uses `https://localhost:3001/login` en Easypanel. `localhost:3001` solo sirve desde la máquina donde corre Docker y el contenedor atiende HTTP internamente; Easypanel debe terminar HTTPS y reenviar al puerto `3001` del servicio `admin`.

Variables del servicio `admin`:

```env
NODE_ENV=production
API_INTERNAL_URL=http://api:4000
API_URL=http://api:4000
AUTH_SECRET=<secreto-largo-y-aleatorio>
ADMIN_EMAIL=<correo-del-administrador>
ADMIN_PASSWORD=<contraseña-del-administrador>
```

En Easypanel configura el dominio desde la sección **Domains** del servicio `admin`, con protocolo HTTPS habilitado y puerto interno `3001`. No publiques el puerto `3001` como dominio HTTPS directo ni lo apuntes a `localhost`.

`api` debe ser el nombre interno del servicio Fastify dentro del mismo proyecto. Si Easypanel le asigna otro nombre, reemplaza `api` por el hostname interno que muestre el panel.

Después de desplegar, activar un dominio para el servicio `cotizador`. No se debe exponer PostgreSQL públicamente. La API tampoco necesita dominio público si solo la consumen `web`, `admin` y `cotizador` dentro de la red del proyecto.

## Usando Docker Compose

El servicio ya está incluido como `cotizador` en `docker-compose.yml`. En Easypanel, si se importa el Compose completo, publicar únicamente el puerto del servicio `cotizador` y mantener `API_URL=http://api:4000`.

Antes de producción, cambiar los assets de referencia de `apps/cotizador/public/assets/reference` por recursos propios o autorizados.
