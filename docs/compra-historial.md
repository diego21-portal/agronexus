# Confirmación de compra e historial

La compra se confirma en dos pasos: el servidor prepara una cotización y el comprador acepta ese resumen. La confirmación identifica el intento mediante una clave UUID para poder recuperar su resultado si se pierde la respuesta, sin crear otra compra por un reintento.

Los pagos de este MVP siguen siendo simulados. El proceso no ejecuta un cobro con una pasarela ni una transferencia bancaria real.

## Cotizar antes de confirmar

Un comprador autenticado envía a `POST /api/v1/checkout/quote/`:

```json
{
  "address_id": 3,
  "payment_method": "SIMULATED_CARD"
}
```

La respuesta `200` contiene:

| Campo | Contenido |
|---|---|
| `quote_token`, `expires_at` | Token firmado de la cotización y vencimiento UTC. Su validez es de cinco minutos. |
| `cart_id`, `items` | Carrito y líneas con producto, vendedor, SKU, cantidades y precios calculados por el servidor. |
| `subtotal`, `discount_total`, `shipping_cost`, `total`, `currency` | Resumen de importes; moneda `ARS`. |
| `shipping_address_snapshot` | Copia de la dirección revisada: región, calle, número, ciudad, provincia, código postal y referencia. |
| `price_changed` | Indica si se detectaron cambios de precio respecto del carrito. |

Cotizar no reserva unidades ni crea un pedido o un pago. El comprador debe revisar los productos, los importes, la dirección y el método antes de confirmar. El cliente no determina precios, descuentos, costos de envío o totales enviándolos en el cuerpo.

Los métodos admitidos son `SIMULATED_CARD`, `SIMULATED_BANK_TRANSFER`, `CASH_ON_DELIVERY`, `BUSINESS_ACCOUNT` y `SIMULATED_MERCADO_PAGO`. Todos generan un pago aprobado simulado al confirmar. Los nombres transferencia, contra entrega o cuenta corriente no implican validaciones o cobros reales ni un flujo bancario pendiente en esta versión.

## Confirmar y recuperar el resultado

`POST /api/v1/checkout/` requiere estos cuatro campos:

```json
{
  "address_id": 3,
  "payment_method": "SIMULATED_CARD",
  "quote_token": "<token devuelto por la cotización>",
  "idempotency_key": "2cdfe2b4-5f1d-4bbd-9015-56a5af296b33"
}
```

La UUID del ejemplo es ilustrativa: el cliente genera una clave nueva para cada intento de compra distinto y conserva el cuerpo completo mientras pueda necesitar recuperarlo. No debe reutilizar una clave para otra dirección, otro método, otra cotización o una compra posterior.

El servidor vuelve a validar la cotización, la dirección, los productos, los precios, las cantidades y el stock dentro de la transacción de confirmación. El pedido, las líneas históricas, el pago simulado, los envíos por vendedor y los movimientos de venta se confirman conjuntamente. Un fallo revierte esa operación.

| Resultado | Significado y acción del cliente |
|---|---|
| `201` con el pedido | La confirmación creó una compra nueva. |
| `200` con el mismo pedido | Ese intento ya se había completado. Se devuelve el resultado existente y no se repiten pago, descuento de stock o envíos. |
| `409`, `idempotency_conflict` | La clave ya está asociada a otro cuerpo. No sustituir sus parámetros para recuperar el intento anterior. |
| `409`, `quote_changed` | Cambiaron condiciones relevantes, como precio, cantidades, disponibilidad o dirección. Revisar la cotización actualizada del campo `quote`, si está disponible, antes de aceptar otra compra. |
| `400`, `quote_expired` | Venció una cotización que todavía no produjo una compra. Obtener una nueva y pedir confirmación. |
| `400`, `quote_invalid` | La firma o la relación de la cotización con el comprador, dirección o método no es válida. Obtener una cotización válida. |

`quote` puede ser `null` cuando no sea posible preparar un nuevo resumen, por ejemplo por falta de disponibilidad. No se debe interpretar un conflicto como aceptación automática de otro precio o dirección. Después de revisar las nuevas condiciones, la siguiente confirmación utiliza su nueva cotización y una nueva clave.

La respuesta de éxito es el objeto del pedido, sin un contenedor adicional `order`. El reintento con el mismo comprador, clave y cuerpo recupera el pedido creado incluso si la cotización original ya venció: el vencimiento no obliga a duplicar una compra existente. La asociación del carrito de origen con el pedido también protege frente a confirmaciones simultáneas de ese carrito.

### Si se pierde la conexión

Un timeout o un error de red deja el resultado sin confirmar para el navegador. No demuestra que el servidor haya rechazado la compra ni permite asegurar que no se registró un pago simulado.

Se debe reintentar con **la misma clave y el mismo cuerpo completo**, incluido el `quote_token`. Crear otra clave para resolver una respuesta perdida abandona la identificación del intento anterior. Una respuesta recuperada `200` permite mostrar el pedido original; un conflicto de cotización permite solicitar una nueva revisión cuando aquel intento no se completó.

El frontend conserva el intento enviado y su resumen en `sessionStorage`, asociado al comprador. En la misma pestaña ofrece recuperar la confirmación mediante una acción explícita cuando el usuario autenticado coincide con el dueño del intento, incluso después de volver a ingresar con la misma cuenta. No envía una nueva compra automáticamente ni permite recuperarlo desde otra cuenta. Otra pestaña no lo hereda. Cerrar la pestaña puede perder este registro; si el navegador bloquea el almacenamiento, el reintento puede mantenerse en memoria mientras siga abierta la página, sin garantía de recuperación después de recargar. La sección Mis pedidos permite consultar las compras confirmadas cuando ya no se dispone del intento guardado.

## Dirección e importes históricos

Los pedidos nuevos guardan `shipping_address_snapshot` y `shipping_address_snapshot_source` con origen `CHECKOUT`. Esa copia pertenece al pedido y conserva la dirección aceptada, aunque después se edite o desactive la dirección del perfil. Las líneas mantienen nombre, SKU, cantidad y precios históricos; el pedido y el pago conservan sus importes originales. Los reembolsos se registran mediante sus operaciones, sin reemplazar el total original por el saldo.

Los pedidos anteriores a este cambio conservan un snapshot nulo y el origen `LEGACY_UNKNOWN`. La migración no copia la dirección actual del perfil como si demostrara cuál se utilizó en aquella compra. Ese dato histórico se considera desconocido.

`Order` y `OrderItem` se consultan desde Django Admin sin altas, ediciones directas ni borrados. La dirección e importes históricos no se corrigen con un formulario administrativo. El progreso del envío, las cancelaciones, las inspecciones y los reembolsos continúan mediante sus servicios y rutas autorizadas. Consultar las [reglas de cancelación y devolución](cancelaciones-devoluciones.md).

## Actualización

Backend y frontend deben actualizarse juntos: una versión anterior del cliente no envía la cotización firmada y la clave obligatoria de confirmación.

Las migraciones incorporan el snapshot histórico y la asociación del carrito de origen con el pedido, además de la clave y referencia del intento. Los pedidos anteriores se conservan sin inventar direcciones originales.

Para Docker y PowerShell, seguir la [actualización controlada](cancelaciones-devoluciones.md#actualizar-con-docker-desde-powershell): conservar cambios locales, detener escrituras, respaldar base y archivos necesarios, actualizar y construir, ejecutar `audit_aftersales` antes de migrar y completar migración, auditoría, comprobación Django y pruebas antes de iniciar el servicio. Desde `frontend`, ejecutar `npm run quality`.

## Verificación del bloque

- Repetir la misma confirmación devuelve el mismo pedido y mantiene una sola operación de venta por línea.
- Reutilizar la clave con otro cuerpo devuelve un conflicto sin modificar la compra original.
- Cambiar precio, cantidad o dirección después de cotizar exige revisar de nuevo antes de comprar.
- Dos confirmaciones concurrentes no duplican el pedido del mismo carrito ni venden dos veces la última unidad.
- Editar o desactivar una dirección después de comprar no modifica su snapshot histórico.
- Migrar pedidos antiguos deja su dirección original como desconocida y mantiene sus importes.
- El navegador puede recuperar el resultado de una respuesta perdida sin registrar otra compra.

Las pruebas de concurrencia se ejecutan en PostgreSQL. `npm run e2e:auth` usa la configuración de navegador contra Django real e incluye sesiones y compra; la receta completa está en [testing](testing.md#compra-cotizada-recuperable-e-historial).
