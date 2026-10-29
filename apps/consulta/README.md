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
- `app/route.ts`: entrega del documento.
- `public/consulta-interna.html`: formulario, resultado e historial internos.
- `app/api/consulta/route.ts`: proxy de solo lectura a la consulta pública compartida.

El formulario consulta los certificados del registro interno mediante `/api/consulta`, que usa la misma API que la Web (`/v1/soat/consulta`). Muestra resultado, historial y anulaciones sin exponer datos del contratante, motor o chasis. Las cotizaciones emitidas con número de póliza real siguen disponibles como respaldo cuando no hay certificados registrados para la placa.

Configurar `API_INTERNAL_URL` (o `API_URL`) con la URL de la API; en desarrollo se usa `http://127.0.0.1:4000` y Docker Compose usa `http://api:4000`. El formulario indica que los datos son internos y enlaza a la consulta oficial para certificados externos. No envía registros a APESEG ni habilita emisión oficial. La integración externa queda pendiente.

Se conservan marcas, textos y créditos de la referencia para la comparación visual solicitada. Los scripts de analítica y seguimiento del sitio de origen se excluyen de la copia local. Esta aplicación no se ha publicado.

## Actualizar la captura

Instalar `requests` y `beautifulsoup4` con pip y ejecutar `python tools/capture-consulta.py`. Después recompilar la aplicación.

Fuente: https://www.apeseg.org.pe/consultas-soat/

Captura: 27 de octubre de 2026.

## Revisión de resultados e historial

Se compararon ambas pantallas dentro de la página original y de la copia local a 1440 px y 390 px de ancho. Coinciden los títulos, colores, tamaños de letra, etiquetas y dimensiones de las tablas. La pantalla de resultados contiene 15 campos; el historial presenta los 10 registros de la consulta de prueba y permite desplazarse horizontalmente dentro de su tabla.

Las vistas siguen siendo las oficiales cargadas en el iframe. La comparación visual reutilizó el resultado ya obtenido mediante el flujo oficial, sin nuevas consultas de placa ni cambios en autenticación. No acredita que una consulta nueva desde localhost sea aceptada por la API. La conexión directa sigue pendiente de un acceso de integración autorizado.

## Docker / Easypanel

Usar `infrastructure/docker/consulta.Dockerfile` con contexto en la raíz del repositorio. Puerto interno: **3003**. No requiere claves propias; requiere acceso a la API para consultar. El servicio `consulta` también está incluido en `docker-compose.yml`.


Las comparaciones visuales y pruebas del iframe descritas arriba corresponden a la captura anterior. El formulario activo ahora es el registro interno.


## Captcha interno

La consulta requiere un código de imagen propio, validado por el servidor antes de consultar la API. Caduca en cinco minutos y cada intento lo consume. El botón de actualizar genera otro código. No requiere claves de terceros.

Los desafíos se guardan en memoria del proceso: ejecutar una sola instancia de `consulta`. Un reinicio invalida los códigos anteriores; en un despliegue con varias réplicas se requiere almacenamiento compartido para los desafíos.

Verificación: `npx tsx --test tools/tests/captcha.test.ts`.
