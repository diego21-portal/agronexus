# Envíos por vendedor

Una compra puede incluir productos de varios vendedores y mantener un pago global. Cada vendedor tiene un único envío dentro de esa compra, con su tracking, transportista, estado e historial. `Shipment.order` es una relación de muchos a uno y la base de datos impide repetir `(order, seller)`.

## Aislamiento y estados

Las rutas del vendedor seleccionan el envío por su vendedor asignado, no por el hecho de que la orden contenga algún producto suyo. Un vendedor no puede usar el identificador del envío de otro participante. La ruta antigua de estado de pedido también opera sobre el envío propio; no escribe directamente el estado de toda la orden.

La actualización bloquea primero la orden y después el envío, vuelve a validar su estado y guarda el evento y la notificación en la misma transacción. El bloqueo de la orden coordina las actualizaciones simultáneas de vendedores distintos. Los envíos entregados o cancelados son finales y el estado de un envío no puede retroceder a una fase anterior del recorrido normal. Después de una incidencia (`DELIVERY_PROBLEM`), el vendedor puede retomar una fase normal, incluida la preparación, dejando registrado el cambio.

El estado de la orden resume el conjunto:

| Situación | Estado global |
|---|---|
| Todos los envíos entregados | `DELIVERED` |
| Todos cancelados, en datos históricos | `CANCELLED` |
| Algún envío con incidencia o una cancelación parcial histórica | `PROBLEM` |
| Todos despachados, en tránsito, en reparto o entregados | `SHIPPED` |
| Progreso parcial, mientras quedan envíos sin despachar | `PREPARING` |
| Todos recién creados | Conserva el estado de pago/confirmación de la orden |

El cliente puede reseñar o solicitar devolución de un ítem cuando el envío de su vendedor está entregado, aunque otros vendedores sigan preparando sus productos. El permiso se comprueba en el backend además de mostrarse en la interfaz.

La cancelación desde las rutas de vendedor responde con un error de validación. Su implementación necesita una operación coordinada de inventario y reembolso; cambiar solo el estado dejaría los datos inconsistentes. Los estados cancelados anteriores se conservan para lectura.

## Contratos HTTP

Las respuestas de compra, lista y detalle del cliente incluyen `shipments`, con todos los envíos. El campo `shipment` conserva compatibilidad para compras con exactamente un envío; en compras con varios es `null` y no debe usarse para elegir arbitrariamente un vendedor.

`GET /api/v1/orders/{id}/tracking/` devuelve un objeto con `order_id`, `order_number`, `order_status`, `shipments` y el campo singular de compatibilidad. Solo el comprador puede consultar su orden; una orden ajena o inexistente produce `404`.

Las respuestas de `GET /api/v1/seller/orders/` y su detalle incluyen:

| Campo | Significado |
|---|---|
| `items` | Productos comprados a este vendedor |
| `seller_subtotal` | Suma de esos productos, como importe decimal |
| `status` | Estado de la parte del vendedor |
| `order_status` | Estado global de la compra |
| `shipment` | Envío propio, con tracking e historial |
| `shipment_status`, `tracking_code` | Campos de compatibilidad del mismo envío propio |

`PATCH /api/v1/seller/shipments/{id}/status/` acepta los estados de envío, incluido `DISPATCHED` para despachado. `SHIPPED` es un estado de orden, no de envío. La ruta `PATCH /api/v1/seller/orders/{id}/status/` conserva `PREPARING`, `SHIPPED` y `PROBLEM`, traduciéndolos respectivamente a `PREPARING`, `DISPATCHED` y `DELIVERY_PROBLEM` en el envío propio.

El dashboard de cada vendedor cuenta estados locales y muestra su propio subtotal y tracking. Sus ventas, productos más vendidos y serie mensual incluyen importes con pago aprobado, excepto órdenes canceladas o su propio envío cancelado. Una incidencia logística, propia o de otro vendedor, no equivale a un reembolso y no elimina por sí sola una venta pagada. El cálculo de reembolsos parciales queda para el bloque de pagos/devoluciones.

## Migración de datos existentes

Antes de aplicar `shipments.0002_seller_shipments`, debe existir un respaldo de la base de datos y una forma comprobada de restaurarlo.

- Si el envío anterior correspondía a un solo vendedor, conserva su identificador, tracking e historial y recibe ese vendedor.
- Si la orden tenía varios vendedores, el envío original se asigna al primer vendedor según su identificador y conserva su tracking y eventos. Los demás reciben nuevos identificadores y trackings, una copia del estado y los datos logísticos anteriores, y un evento de migración. El original también recibe ese aviso.
- El aviso indica que el estado es **heredado y debe revisarse**. Los datos anteriores no permiten reconstruir qué vendedor realizó cada entrega; copiar el estado mantiene la información registrada, sin demostrar una entrega individual.
- Un envío histórico sin ítems conserva `seller=null` y ningún vendedor tiene permiso para modificarlo.

La migración es irreversible mediante `migrate` hacia atrás: fusionar envíos distintos perdería información. Si fuera necesario revertir el despliegue, la vía soportada es restaurar el respaldo anterior junto con la versión anterior del código.

Tras actualizar el código, aplicar desde `backend`:

```sh
python manage.py migrate
python manage.py check
```

`seed_demo` utiliza la combinación `(order, seller)` y conserva la idempotencia de sus envíos y eventos. `--reset` sigue destinado exclusivamente a reiniciar los datos de demostración.

## Verificación

Las comprobaciones de regresión deben cubrir compras con dos vendedores, rechazo de identificadores ajenos, entregas parciales y finales, las dos rutas de actualización, estados terminales, reseñas/devoluciones por ítem, migración de datos anteriores y ejecución repetida de `seed_demo`.

Las pruebas de solicitudes concurrentes requieren PostgreSQL; SQLite no demuestra los bloqueos entre vendedores. Los comandos de verificación son:

```sh
# Desde backend, con las variables de conexión PostgreSQL configuradas:
python manage.py makemigrations --check --dry-run
python -m pytest

# Desde frontend:
npm ci
npm run quality
```

Este documento describe el comportamiento y las verificaciones previstas; los resultados de cada ejecución deben registrarse junto al cambio correspondiente.
