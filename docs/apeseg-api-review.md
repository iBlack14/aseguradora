# Revisión de la API visible del formulario APESEG

Fecha: 27 de octubre de 2026. Revisión de recursos públicos del formulario y dos solicitudes sin autenticación. No se usaron las credenciales encontradas, no se resolvieron captchas y no se consultaron placas reales.

## Fuentes públicas

- Página: https://www.apeseg.org.pe/consultas-soat/
- Formulario: https://webapp.apeseg.org.pe/consulta-soat/?source=apeseg
- Configuración: https://webapp.apeseg.org.pe/consulta-soat/config.js
- Bundle observado: https://webapp.apeseg.org.pe/consulta-soat/assets/index-DzdirK07.js
- Base declarada: https://api.apeseg.org.pe

## Hallazgos confirmados

1. El bundle público contiene un correo y una contraseña fijos para solicitar un token en el endpoint de login. También incluye un valor fijo X-App-Secret. Se omiten sus valores en este informe. Al distribuirse al navegador, esos valores son visibles para los visitantes y no pueden considerarse secretos del servidor. No se verificó su vigencia mediante un inicio de sesión.
2. GET /captcha-api/api/captcha respondió HTTP 200 sin enviar X-App-Secret, cookies ni Authorization. Esto confirma que la generación del captcha es accesible sin ese encabezado; no demuestra que la verificación o consulta de certificados permita omitir controles.
3. GET /consulta-soat/api/certificados/placa/INVALID, sin credenciales, respondió HTTP 500 con el mensaje: `Auth guard [ ipwhilelist] is not defined.` Expone un detalle interno de configuración. No devolvió certificados ni demuestra acceso anónimo a información de placas.

## Flujo que implementa el frontend

| Método | Ruta | Datos o controles observados en el código |
| --- | --- | --- |
| GET | /captcha-api/api/captcha | Envía X-App-Secret; recibe imagen y clave del captcha |
| POST | /captcha-api/api/captcha/verify | Envía captcha, clave y X-App-Secret |
| POST | /consulta-soat/api/login | Envía las credenciales fijas incluidas en el bundle; espera access_token |
| GET | /consulta-soat/api/certificados/placa/{placa} | Envía Authorization Bearer, CF-Turnstile-Response, X-Source y X-Referrer |
| POST | /consulta-soat/api/logout | Envía Authorization Bearer |

El frontend verifica el captcha y la presencia del token Turnstile antes del login. La revisión del JavaScript permite describir el flujo del cliente, pero no confirmar qué controles valida efectivamente el servidor ni si existe una API de integración autorizada.

## Implicación para el proyecto

Los endpoints y algunos valores que deberían protegerse están expuestos. Esto no equivale a una API libre, documentada o autorizada para reutilización. La aplicación local sigue utilizando el iframe oficial. No se incorporaron estas credenciales ni se modificó la integración para eludir captcha, Turnstile o autenticación.

La captura local para esta revisión se guardó con los valores sensibles redactados en output/apeseg-api/app.redacted.js; las respuestas HTTP resumidas están en output/apeseg-api/http-checks.json.

## Prueba posterior mediante el formulario oficial

El usuario proporcionó AMY-477 y completó el captcha y la verificación humana en el navegador. Se observó el flujo normal del frontend oficial, sin construir solicitudes de login manuales ni extraer o reutilizar tokens:

- POST /captcha-api/api/captcha/verify: HTTP 200. El formulario continuó al login.
- POST /consulta-soat/api/login: HTTP 200. El frontend continuó a consultar certificados.
- GET /consulta-soat/api/certificados/placa/AMY477: HTTP 403, con respuesta `{"message":"Acceso no autorizado"}`.

No se obtuvieron certificados para esa placa. El rechazo ocurre en la consulta de certificados después del login; el mensaje no permite atribuirlo a una causa específica (permisos, origen, IP u otra regla). No se intentó eludir ese rechazo. La API no quedó validada como una integración utilizable desde nuestra aplicación.

## Prueba desde la página original completa

Tras completar el usuario la verificación en el iframe de https://www.apeseg.org.pe/consultas-soat/, se observó:

- Verificación del captcha: HTTP 200.
- Login del frontend oficial: HTTP 200.
- Consulta de AMY477: HTTP 200, con una lista de 10 registros.
- Logout del frontend oficial: HTTP 200.

El primer registro indica Pacifico Seguros, estado VIGENTE, inicio 28/02/2026, fin 28/02/2027, uso PARTICULAR, clase AUTOMOVIL y certificado DIGITAL. Marca, modelo y número de asientos son nulos en ese registro. No se incluyen aquí nombres del contratante, números de serie ni identificadores de póliza.

La respuesta incluye 22 campos, entre ellos NombreCompania, FechaInicio, FechaFin, Placa, NumeroPoliza, NombreUsoVehiculo, NombreClaseVehiculo, Estado, TipoCertificado, FechaCreacion, FechaAnulacion, FechaControlPolicial, NumeroAsientos, ModeloVehiculo y Marca.

En la sesión incrustada, document.referrer y el referrer registrado por la aplicación son https://www.apeseg.org.pe/. En la sesión abierta directamente, document.referrer está vacío y la aplicación registra unknown. Esto sugiere que el contexto de origen podría influir, pero no demuestra que sea la única causa del resultado diferente. No se falsificaron encabezados ni se reutilizaron tokens para comprobarlo. El éxito en el flujo oficial no valida una conexión directa desde nuestro servidor o desde localhost.
