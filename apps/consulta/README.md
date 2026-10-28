# Consulta SOAT — referencia visual APESEG

Aplicación independiente en el puerto **3003**. Conserva la página completa de referencia: cabecera, consulta, banners, servicios, contactos, artículos y pie, con recursos públicos descargados localmente.

## Ejecutar

Desde la raíz: `npm run dev:consulta`. Abrir http://localhost:3003.

Para producción: `npm run build -w @falabella/consulta` y `npm run start -w @falabella/consulta`.

## Archivos para modificar

- `reference/page.html`: HTML editable servido en `/`, generado durante el build.
- `public/assets/apeseg/`: 191 recursos capturados: CSS, JavaScript de presentación, imágenes, iconos y fuentes.
- `reference/manifest.json`: mapa de cada URL original a su archivo local.
- `reference/original.html`: HTML original archivado como referencia.
- `reference/consulta-ui.css`: copia de referencia de los estilos oficiales del formulario, los resultados y el historial.
- `app/route.ts`: entrega del documento, sin acceso a la API privada del proyecto.

El formulario permanece como iframe oficial de webapp.apeseg.org.pe. La consulta, el captcha y la verificación humana dependen de APESEG y de una conexión a Internet. No se simulan resultados ni se duplican sus servicios privados. Los enlaces de contenido apuntan a las páginas originales; la consulta enlaza a esta aplicación.

Se conservan marcas, textos y créditos de la referencia para la comparación visual solicitada. Los scripts de analítica y seguimiento del sitio de origen se excluyen de la copia local. Esta aplicación no se ha publicado.

## Actualizar la captura

Instalar `requests` y `beautifulsoup4` con pip y ejecutar `python tools/capture-consulta.py`. Después recompilar la aplicación.

Fuente: https://www.apeseg.org.pe/consultas-soat/

Captura: 27 de octubre de 2026.

## Revisión de resultados e historial

Se compararon ambas pantallas dentro de la página original y de la copia local a 1440 px y 390 px de ancho. Coinciden los títulos, colores, tamaños de letra, etiquetas y dimensiones de las tablas. La pantalla de resultados contiene 15 campos; el historial presenta los 10 registros de la consulta de prueba y permite desplazarse horizontalmente dentro de su tabla.

Las vistas siguen siendo las oficiales cargadas en el iframe. La comparación visual reutilizó el resultado ya obtenido mediante el flujo oficial, sin nuevas consultas de placa ni cambios en autenticación. No acredita que una consulta nueva desde localhost sea aceptada por la API. La conexión directa sigue pendiente de un acceso de integración autorizado.

## Docker / Easypanel

Usar `infrastructure/docker/consulta.Dockerfile` con contexto en la raíz del repositorio. Puerto interno: **3003**. No requiere claves ni base de datos. El servicio `consulta` también está incluido en `docker-compose.yml`.
