# Arquitectura inicial

## Superficies

- **Web pública (`apps/web`)**: captación, cotización, comparación y pago/emisión.
- **Administración (`apps/admin`)**: operaciones, cotizaciones, ventas, tarifas, usuarios y auditoría.
- **API (`apps/api`)**: contratos HTTP, validación, orquestación de cotizaciones y emisión.
- **PostgreSQL**: clientes, vehículos, ofertas, órdenes y auditoría.
- **Redis**: caché de cotizaciones y futura cola de integraciones.

## Flujo objetivo

1. La web envía datos validados a `POST /v1/quotes`.
2. La API consulta adaptadores de aseguradoras de forma asíncrona.
3. Las respuestas normalizadas se guardan como `Offer`.
4. El cliente selecciona una oferta y se crea una `Order`.
5. El proveedor de pago confirma mediante webhook firmado.
6. La API solicita la emisión y almacena número y documento de póliza.
7. Cada transición sensible genera un `AuditLog`.

## Estado actual

La navegación y las interfaces están implementadas con información demostrativa. Los adaptadores reales, autenticación, proveedor de pago, almacenamiento de pólizas y notificaciones requieren credenciales y contratos de producción.
