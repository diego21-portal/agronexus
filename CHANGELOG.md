# Historial de cambios

## 1.1.0 — experiencia móvil y administración paginada

- Demo con Docker Compose para iniciar React, Django y PostgreSQL en un solo comando. Carga datos en la primera instalación y conserva los cambios al recrear los contenedores.
- El inicio distingue errores de carga y secciones vacías. Cada sección puede reintentarse por separado.
- Accesos funcionales desde Mi perfil a pedidos, direcciones, favoritos y preguntas.
- Portada y catálogo renovados, filtros plegables en móvil, navegación por teclado y fichas con ilustraciones demo. Cuenta, vendedor y administración usan menús compactos.
- La cuenta muestra los errores de pedidos con opción de reintentar. `/ready/` comprueba la base para el arranque y la supervisión.
- Administración solicita páginas de 25 registros en usuarios, vendedores, productos, pedidos, pagos y envíos. Las búsquedas existentes y los filtros de rol y estado se resuelven en la API antes de paginar. Los clientes que consultan un listado sin parámetros de paginación reciben un arreglo.
- La prueba móvil espera el montaje del enlace de salto antes de pulsar Tab. CI señala pruebas públicas intermitentes y comprueba la compilación en Windows con npm 12.0.1.
- El entorno de Vitest simula `scrollTo` y el backend incorpora un chequeo estático con Ruff.

## 1.0.0 — cierre del MVP preparado para revisión

Esta entrada describe el alcance de la primera versión estable propuesta. El PR y su integración no publican automáticamente una etiqueta Git, una release de GitHub ni una instalación pública. El resultado de los checks debe corresponder al commit que se revise e integre.

### Correcciones y funcionalidades de cierre

- Dashboards de administrador y vendedor alineados con las secciones reales de Django. Se muestran cifras, rankings y ventas mensuales; se distinguen bruto, reembolsos e ingresos netos simulados. Un contrato incompatible se informa como error de carga.
- Alta comercial transaccional al asignar `SELLER`, con datos requeridos, perfil visible en administración y reactivación explícita de perfiles inactivos. El alta no desbloquea una cuenta de usuario bloqueada.
- Al retirar el rol de vendedor, sus productos dejan de publicarse y se bloquean nuevas ventas. Se conservan los datos comerciales y el historial.
- Gestión de imágenes propias desde el editor vendedor: JPEG/PNG/WebP validados, límites de tamaño y dimensiones, imagen principal única, orden y texto alternativo.
- Los editores guardan los campos modificados. Cambiar una descripción conserva el inventario actualizado mientras estaba abierto el formulario.
- Ficha técnica PDF opcional con carga, reemplazo y borrado, nombre generado por el servidor y descarga pública con cabeceras de adjunto y `nosniff`.
- Migración `products.0004_product_media`: conserva archivos antiguos, normaliza la imagen principal y protege el retroceso si existen referencias PDF.
- Prueba de navegador de posventa con dos vendedores, cancelación en tránsito, recepción, inspección de unidades aptas y defectuosas y reembolso. Se comprueban reintentos tras perder respuestas y ausencia de duplicación de stock o reembolso en ese recorrido.
- Ensayo de CI de persistencia de medios al recrear los contenedores y guías de actualización y aceptación coherentes con el código.

### Base consolidada de esta versión

- Sesiones JWT revocables con rotación y coordinación de pestañas.
- Carrito y compra con cotización firmada, confirmación explícita, idempotencia y dirección histórica del pedido.
- Envíos por vendedor, cancelaciones, devoluciones, recepción, inspección y reembolsos simulados auditables.
- Catálogo paginado, filtros por precio efectivo, privacidad por propietario y administración con campos editables restringidos.
- OpenAPI validado, dependencias versionadas y auditadas, pruebas frontend/backend y plantillas Docker con Nginx/TLS.
- Dependencias generadas fuera del control de versiones y documentación de ejecución reproducible.

### Alcance

Pagos, reembolsos y transporte son simulados. El portal operativo propio de logística, las pasarelas y transportistas reales, el hosting, los dominios, la infraestructura externa y el escalado quedan fuera de esta entrega. Las instrucciones y criterios de cierre están en [docs/cierre-v1.md](docs/cierre-v1.md).

La elección de licencia sigue correspondiendo al autor; esta actualización no añade ni concede una licencia nueva.
