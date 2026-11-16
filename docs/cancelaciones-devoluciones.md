# Cancelaciones, retornos e inventario

El comprador puede cancelar todos los productos incluidos en el envío de un vendedor. Cada parte de una compra con varios vendedores se gestiona de forma independiente. Los pagos y reembolsos de este proyecto son simulados.

## Reglas iniciales

| Situación | Operación |
|---|---|
| Envío creado o preparando | La cancelación confirma conjuntamente estado, liberación de unidades y reembolso de productos. |
| En tránsito, despacho, reparto o incidencia | Se abre una solicitud; el paquete conserva su estado físico y no se repone stock ni se reembolsa todavía. |
| Retorno confirmado | El vendedor responsable o administración registra recepción e inspección. |
| Producto entregado antes de la solicitud | Se utiliza la devolución por ítem de la compra. |
| Entrega mientras existe una solicitud pendiente | Se conserva el envío entregado; el expediente sigue con su retorno y resolución comercial. |

La cancelación incluye el envío completo del vendedor. Las devoluciones posteriores a una entrega permiten indicar cuántas unidades del ítem se devolverán, con una solicitud por ítem en esta versión.

La solicitud en tránsito puede desistirse mientras siga pendiente. Después de confirmar el retorno, retirar la solicitud no puede borrar movimientos físicos. Una solicitud rechazada o desistida admite una nueva solicitud si el envío sigue siendo elegible.

## Responsables y estados

El comprador solicita y consulta sus propios casos. El vendedor solo puede confirmar el retorno, recibir e inspeccionar sus productos. Administración autoriza el reembolso posterior a un retorno, el rechazo de una solicitud pendiente y cualquier devolución del costo de envío. El rol de operador logístico todavía no tiene una asignación operativa propia; esta versión no simula una confirmación de una empresa de transporte real.

Las cancelaciones en tránsito siguen:

`REQUESTED → RETURNING → RECEIVED → INSPECTED → COMPLETED`

`WITHDRAWN` y `REJECTED` son finales para el expediente pendiente. Antes del despacho se llega a `COMPLETED` sin fabricar una recepción: los productos aún no habían salido.

Las devoluciones posteriores a una entrega siguen:

`REQUESTED → IN_REVIEW / APPROVED / REJECTED → PRODUCT_RECEIVED → INSPECTED → REFUNDED → CLOSED`

La recepción y la inspección tienen acciones específicas. Un selector de estado no puede afirmar que un producto llegó o que fue revisado. Solo las devoluciones rechazadas o ya reembolsadas pueden cerrarse; no se puede saltar de solicitada a reembolsada.

## Recepción e inspección

Cada ítem tiene cantidades esperadas, recibidas, aptas para venta y defectuosas. Las cantidades enviadas al servidor son totales acumulados y no pueden disminuir. Se admite recepción e inspección parcial.

Las unidades recibidas quedan pendientes de revisión: `recibidas - aptas - defectuosas`. Recibirlas no aumenta `Product.stock`. Solo el incremento de unidades declaradas aptas genera un movimiento `RETURN`. Las defectuosas quedan fuera del inventario disponible aunque corresponda reembolsarlas al comprador. La inspección requiere una observación del responsable.

Los movimientos `RETURN`, `CANCELLATION` y `SALE` quedan vinculados al ítem de compra y a una referencia única. Las rutas manuales de inventario solo permiten reposición y ajuste manual. La edición general de stock también usa bloqueo y registro; el Django Admin permite consultar el historial, pero no fabricar o editar movimientos de compra.

Para retirar un producto del catálogo se utiliza su estado archivado o su desactivación. La eliminación desde el Django Admin está deshabilitada para preservar el historial de inventario asociado.

## Dinero y gastos de envío

El importe original del pedido y del pago se conserva. `PaymentRefund` registra cada operación y el pago expone importe reembolsado, saldo reembolsable y estado parcial o total. La suma de reembolsos no puede superar el valor histórico de las unidades compradas ni el monto del pago global. Se usa el precio guardado en la compra, nunca el precio actual del catálogo.

La cancelación antes del despacho reembolsa los productos en la misma transacción. Después de un retorno, administración puede completar la cancelación cuando todas las unidades están recibidas e inspeccionadas. Aprobar dinero no agrega stock.

Los gastos de envío se resuelven por separado, mediante una operación explícita de administración con motivo, importe y clave de operación. Su máximo es el costo original de envío que queda sin devolver y el saldo del pago. No se inventa un reparto de ese costo global entre vendedores. Un reintento debe conservar su clave de operación.

Los dashboards conservan el importe bruto y descuentan reembolsos para sus ingresos netos. Un reembolso parcial no elimina las ventas del otro vendedor. Una cancelación comercial puede coexistir con una entrega histórica y se muestra separada del progreso de las partes activas.

## API

| Método y ruta | Responsable |
|---|---|
| `POST /api/v1/shipments/{id}/cancellation/` con `reason` | Comprador dueño |
| `GET /api/v1/users/me/cancellations/` | Comprador dueño |
| `POST /api/v1/cancellations/{id}/withdraw/` | Comprador dueño |
| `GET /api/v1/seller/cancellations/` | Vendedor de la parte |
| `GET /api/v1/admin/cancellations/` | Administración |
| `POST /api/v1/seller/cancellations/{id}/action/` | Retorno, recepción e inspección propios |
| `POST /api/v1/admin/cancellations/{id}/action/` | Logística, resolución y reembolsos |
| `POST /api/v1/{seller,admin}/returns/{id}/receive/` | Recepción de devolución |
| `POST /api/v1/{seller,admin}/returns/{id}/inspect/` | Inspección de devolución |
| `PATCH /api/v1/admin/returns/{id}/status/` | Decisión y reembolso de devolución |

Las acciones de cancelación son `start_return`, `receive`, `inspect`, `complete`, `reject` y `refund_shipping`. Recepción e inspección reciben una lista de ítems con sus cantidades acumuladas. La inspección y el rechazo requieren un resultado o motivo; la devolución del envío necesita además importe y referencia de operación. Las respuestas públicas excluyen notas internas y correos de responsables.

## Actualización de una instalación existente

1. Detener procesos que escriban en la base y guardar un respaldo que pueda restaurarse.
2. Actualizar el código, conservando los cambios locales propios.
3. Activar el entorno virtual y ejecutar desde `backend`:

```powershell
python manage.py audit_aftersales
python manage.py migrate
python manage.py audit_aftersales
python manage.py check
python -m pytest
```

Desde `frontend`, ejecutar `npm run quality` y arrancar la aplicación para comprobar sus pedidos y solicitudes.

La auditoría es de lectura. Los precios o descuentos históricos inválidos detienen la nueva restricción con una lista de productos que deben corregirse; la migración no cambia importes por su cuenta.

Los pagos que ya figuraban reembolsados y aquellos con devoluciones históricas reembolsadas o cerradas quedan marcados para conciliación. Una solicitud cerrada antigua no permite saber si antes se reembolsó o rechazó: la marca no afirma un pago nuevo. Se conserva el historial y se bloquean otros reembolsos hasta revisar esos registros. No se inventan asientos ni recepciones anteriores para hacer pasar la actualización.

La aplicación muestra esa marca al consultar el pago. Si aparece, deben conciliarse los datos históricos con sus evidencias antes de habilitar más operaciones financieras sobre esa compra.

Las migraciones protegen los expedientes, recepciones y asientos existentes frente a un retroceso que los borraría. La reversión con datos operativos requiere restaurar un respaldo completo y su versión de código. `seed_demo`, incluso con `--reset`, rechaza reconstruir pedidos demo que ya tengan ese historial protegido; para repetir una demostración desde cero debe utilizarse otra base de pruebas.

## Casos de verificación

La suite cubre comprador ajeno, separación de vendedores, solicitudes repetidas, carreras con despacho y entrega, reembolso parcial y total, límites de cantidad y dinero, inspección defectuosa sin reposición, revisión apta una sola vez, privacidad de notas y actualización de bases anteriores. Las pruebas de concurrencia requieren PostgreSQL y se omiten explícitamente en SQLite.
