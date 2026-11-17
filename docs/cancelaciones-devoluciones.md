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

### Actualizar con Docker desde PowerShell

Esta receta corresponde al PostgreSQL local definido en `backend/docker-compose.yml`, con sus servicios `db` y `web` y el archivo `.env.docker` ya configurado. Ejecutar desde `backend`, comprobando el resultado de cada paso antes de continuar. Tener Docker Desktop abierto no hace que un `python` escrito en PowerShell se ejecute dentro del contenedor.

Primero revisar la copia de trabajo:

```powershell
git status --short
git branch --show-current
git log -1 --oneline
docker compose ps
```

Si hay cambios propios, guardarlos antes de cambiar de rama o actualizar. Un PR integrado en GitHub todavía debe descargarse a esta copia local. El montaje `.:/app` hace que Docker utilice los archivos de este `backend`, incluso si la imagen se había construido con otra versión.

Detener `web` y cualquier otro proceso que escriba en esta base. Mantener disponible solamente PostgreSQL para respaldar y actualizar:

```powershell
docker compose stop web
docker compose up -d --wait db
```

Guardar un respaldo fuera del repositorio. Los nombres de usuario y base siguientes son los del Compose local; ajustarlos si se cambió esa configuración. El archivo se crea dentro del contenedor y se copia sin pasar sus bytes por una redirección de PowerShell:

```powershell
$backupName = "agronexus-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
New-Item -ItemType Directory -Force ..\..\agronexus-backups | Out-Null
docker compose exec -T db pg_dump -U agronexus_user -d agronexus_db -Fc -f "/tmp/$backupName"
docker compose cp "db:/tmp/$backupName" "..\..\agronexus-backups\$backupName"
```

Conservar también la versión anterior del código y los archivos `media` si se necesitan para restaurar la instalación. Un respaldo debe comprobarse mediante una restauración en una base de pruebas separada.

Con los cambios locales guardados, actualizar y construir la imagen:

```powershell
git switch main
git pull --ff-only
git log -1 --oneline
Test-Path .\apps\aftersales\management\commands\audit_aftersales.py
docker compose build web
```

`Test-Path` debe devolver `True`. Antes de iniciar `web`, ejecutar la auditoría con un comando que reemplaza el arranque habitual del servicio:

```powershell
docker compose run --rm --no-deps web python manage.py audit_aftersales
```

El Compose actual ejecuta `migrate` automáticamente al iniciar `web`. Por eso, en una actualización se deja ese arranque para el final. Si la auditoría informa precios inválidos, corregirlos antes de aplicar las nuevas restricciones. Si aparece `Unknown command`, comprobar el checkout y el registro de `apps.aftersales`; ese mensaje no indica que falte migrar.

Después de una auditoría satisfactoria, aplicar y verificar, deteniéndose ante cualquier error:

```powershell
docker compose run --rm --no-deps web python manage.py migrate
docker compose run --rm --no-deps web python manage.py audit_aftersales
docker compose run --rm --no-deps web python manage.py check
docker compose run --rm --no-deps web python -m pytest
```

Cuando todo termine correctamente, levantar el backend:

```powershell
docker compose up -d web
```

Desde `frontend`, ejecutar `npm run quality`. Si esta actualización incorpora por primera vez las [sesiones revocables](sesiones.md), volver a iniciar sesión: los tokens anteriores sin `sid` dejan de ser aceptados.

## Casos de verificación

La suite cubre comprador ajeno, separación de vendedores, solicitudes repetidas, carreras con despacho y entrega, reembolso parcial y total, límites de cantidad y dinero, inspección defectuosa sin reposición, revisión apta una sola vez, privacidad de notas y actualización de bases anteriores. Las pruebas de concurrencia requieren PostgreSQL y se omiten explícitamente en SQLite.
