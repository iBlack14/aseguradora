# Catálogo de vehículos

Revisión: 28 de octubre de 2026.

Los selectores de ventas y web utilizan el mismo contenido en `apps/admin/lib/vehicleCatalog.ts` y `apps/web/lib/vehicleCatalog.ts`. Al actualizarlo, mantener ambos archivos iguales. Se conservaron los modelos anteriores de ambas aplicaciones y se ampliaron las opciones por tipo de vehículo.

El catálogo es una ayuda para ingresar datos; no acredita homologación, disponibilidad comercial ni cobertura de una aseguradora. Incluye modelos históricos e importados. La entrada manual sigue disponible para vehículos ausentes.

## Fuentes consultadas para modelos de oferta local

- Suzuki autos: https://www.suzuki.com.pe/
- Suzuki motos: https://www.suzukimotos.pe/productos/
- Suzuki Carry (fabricante global): https://www.globalsuzuki.com/automobile/lineup/carry/
- Changan: https://www.changan.com.pe/
- Jetour: https://www.jetour.com.pe/modelos
- BAIC: https://baic.pe/
- Honda motos: https://motos.honda.com.pe/modelos
- Yamaha: https://www.yamaha-motor.com.pe/terminos-legales
- JMC: https://jmc.pe/pasajeros/promociones/
- ZX Auto: https://www.zxauto.pe/contacto/
- SWM, distribuidor Ambacar: https://ambacar.pe/SWM/
- Kaiyi, concesionario: https://www.asanmiguel.com.pe/marcas/kaiyi

Estas fuentes respaldan las incorporaciones locales indicadas; el catálogo completo no es una descarga de un registro oficial. Las opciones históricas complementarias no implican que el vehículo se venda nuevo en Perú.

## Revisión de formularios

Se verifican las cinco categorías por separado. Una marca puede tener vehículos en varias categorías; por ejemplo, Suzuki figura en autos, motos, vans y carga ligera, sin agregar modelos ficticios de mototaxi.

Las marcas recibidas en mayúsculas se resuelven a la opción del catálogo. Los modelos detectados que no figuren en la lista permanecen editables mediante la entrada manual. Cambiar de categoría o marca limpia el modelo anterior y exige elegirlo, en lugar de seleccionar automáticamente el primero.

Pruebas del catálogo: `node --test tools/tests/vehicle-catalog.test.mjs`.
