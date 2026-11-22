# API implementada

La base de estas rutas es `/api/v1`. El contrato de cuerpos y respuestas se publica en `/api/v1/schema/` y la documentación interactiva en `/api/v1/docs/`. La CI valida el esquema sin advertencias. Esta lista refleja las rutas implementadas, incluidas las operaciones históricas de posventa; no es una propuesta de endpoints futuros.

Las rutas privadas usan `Authorization: Bearer <access>`. El cliente solo accede a sus recursos, el vendedor a sus productos y operaciones, y la administración requiere una cuenta activa con rol administrativo efectivo. Consulta [roles y permisos](roles-permisos.md).

## Sesiones y cuenta

| Métodos | Ruta |
|---|---|
| POST | `/auth/login/` |
| POST | `/auth/logout/` |
| POST | `/auth/refresh/` |
| POST | `/auth/register/` |
| GET, PUT, PATCH | `/users/me/` |
| GET, POST | `/users/me/addresses/` |
| GET, PUT, PATCH, DELETE | `/users/me/addresses/{id}/` |
| GET | `/users/me/cancellations/` |
| GET | `/users/me/complaints/` |
| PUT, PATCH | `/users/me/preferences/` |
| GET, PUT, PATCH | `/users/me/profile/` |
| GET | `/users/me/questions/` |
| GET | `/users/me/returns/` |
| GET | `/users/me/reviews/` |

## Catálogo y actividad social

| Métodos | Ruta |
|---|---|
| GET | `/brands/` |
| GET | `/brands/{slug}/` |
| GET | `/categories/` |
| GET | `/categories/{slug}/` |
| GET | `/favorites/` |
| DELETE | `/favorites/{id}/` |
| POST | `/favorites/add/` |
| GET | `/products/` |
| GET | `/products/{slug}/` |
| POST, DELETE | `/products/{slug}/favorite/` |
| GET | `/products/{slug}/favorite/status/` |
| GET, POST | `/products/{slug}/questions/` |
| GET, POST | `/products/{slug}/reviews/` |
| GET | `/products/featured/` |
| GET | `/regions/` |
| GET | `/regions/{slug}/` |
| GET, PUT, PATCH, DELETE | `/reviews/{id}/` |
| GET | `/users/me/reviews/` |

## Compra y posventa del comprador

| Métodos | Ruta |
|---|---|
| POST | `/cancellations/{id}/withdraw/` |
| GET | `/cart/` |
| DELETE | `/cart/clear/` |
| POST | `/cart/items/` |
| PUT, PATCH | `/cart/items/{id}/` |
| DELETE | `/cart/items/{id}/delete/` |
| POST | `/checkout/` |
| POST | `/checkout/quote/` |
| POST | `/order-items/{id}/returns/` |
| GET | `/orders/` |
| GET | `/orders/{id}/` |
| POST | `/orders/{id}/complaints/` |
| GET | `/orders/{id}/tracking/` |
| POST | `/shipments/{id}/cancellation/` |
| GET | `/users/me/cancellations/` |

## Portal vendedor

| Métodos | Ruta |
|---|---|
| GET | `/seller/cancellations/` |
| POST | `/seller/cancellations/{id}/action/` |
| GET | `/seller/complaints/` |
| GET | `/seller/dashboard/` |
| GET | `/seller/orders/` |
| GET | `/seller/orders/{id}/` |
| PUT, PATCH | `/seller/orders/{id}/status/` |
| GET, POST | `/seller/products/` |
| GET, PUT, PATCH, DELETE | `/seller/products/{id}/` |
| GET, POST | `/seller/products/{id}/images/` |
| PATCH, DELETE | `/seller/products/{id}/images/{image_id}/` |
| POST, DELETE | `/seller/products/{id}/technical-sheet/` |
| PUT, PATCH | `/seller/products/{id}/stock/` |
| GET | `/seller/questions/` |
| PUT, PATCH | `/seller/questions/{id}/answer/` |
| GET | `/seller/returns/` |
| POST | `/seller/returns/{id}/inspect/` |
| POST | `/seller/returns/{id}/receive/` |
| PUT, PATCH | `/seller/shipments/{id}/status/` |
| GET, POST | `/seller/stock/movements/` |

## Administración

| Métodos | Ruta |
|---|---|
| GET | `/admin/cancellations/` |
| POST | `/admin/cancellations/{id}/action/` |
| GET | `/admin/complaints/` |
| PUT, PATCH | `/admin/complaints/{id}/status/` |
| GET | `/admin/dashboard/` |
| GET | `/admin/orders/` |
| GET | `/admin/orders/{id}/` |
| GET | `/admin/payments/` |
| GET | `/admin/products/` |
| GET, PATCH | `/admin/products/{id}/` |
| GET | `/admin/returns/` |
| POST | `/admin/returns/{id}/inspect/` |
| POST | `/admin/returns/{id}/receive/` |
| PUT, PATCH | `/admin/returns/{id}/status/` |
| GET | `/admin/sellers/` |
| PATCH | `/admin/sellers/{id}/verify/` |
| GET | `/admin/shipments/` |
| GET | `/admin/users/` |
| GET, PATCH | `/admin/users/{id}/` |

## Notificaciones

| Métodos | Ruta |
|---|---|
| GET | `/notifications/` |
| DELETE | `/notifications/{id}/` |
| PUT, PATCH | `/notifications/{id}/read/` |
| PATCH | `/notifications/read-all/` |
| GET | `/notifications/unread/` |

## Contratos principales

`GET /products/` devuelve `{count, next, previous, results}`, con 24 productos por defecto y `page_size` hasta 100. Acepta `page`, búsqueda `search`, slugs de `category`, `brand` y `region`, `min_price`, `max_price`, `in_stock` y `ordering`. El precio filtrado y ordenado es el precio efectivo, incluido el descuento. El orden es estable entre páginas. Los precios inválidos o rangos invertidos responden `400`. Una página inexistente responde `404`. La publicación requiere un producto publicado y activo, un perfil comercial activo y una cuenta activa con rol `SELLER`.

La compra requiere cotizar primero. `POST /checkout/` exige dirección, método de pago canónico, token firmado y UUID de idempotencia. Una creación devuelve `201`; recuperar la misma confirmación devuelve `200` con el mismo pedido; un cambio de condiciones devuelve conflicto y solicita revisión. La dirección histórica del pedido es independiente de la libreta actual. Lee [compra e historial](compra-historial.md) antes de modificar este cliente. Todos los métodos de pago siguen siendo simulados.

`GET /users/me/reviews/` conserva el acceso privado a las reseñas propias aunque el producto deje de publicarse. La edición y el borrado requieren ser dueño de la reseña; publicar una reseña exige una compra entregada elegible.

La edición general administrativa admite `role` e `is_active` del usuario, `is_verified` del vendedor e `is_active` del producto. Al asignar `role=SELLER`, admite además los datos de alta comercial descritos abajo. No admite atributos de privilegios Django, contraseñas, cambios de precio o stock ni escritura general sobre pedidos, pagos o envíos. Estas operaciones tienen rutas y servicios de negocio específicos. Los listados administrativos actuales no están paginados; para volúmenes grandes deben incorporar paginación coordinada con el cliente.

### Alta comercial de vendedor

`PATCH /admin/users/{id}/` puede crear o completar el perfil comercial y asignar el rol dentro de una misma transacción:

```json
{
  "role": "SELLER",
  "seller_profile": {
    "business_name": "Agro del Sur",
    "tax_id": "",
    "description": "Repuestos para maquinaria agrícola"
  }
}
```

Un perfil nuevo o sin nombre requiere `business_name` de 2 a 160 caracteres, normalizado sin espacios en los extremos. `tax_id` es opcional, admite hasta 30 caracteres y puede estar vacío; `description` es opcional, admite hasta 5000 y puede estar vacía. Un perfil existente activo permite asignar solo `role`. Para reactivar uno inactivo, el objeto `seller_profile` debe incluir `is_active: true` explícitamente. Este flujo no admite `is_active: false`, verificación comercial, calificaciones ni privilegios adicionales dentro de ese objeto.

`seller_profile` solo se acepta junto a `role=SELLER`. La respuesta administrativa del usuario incluye `seller_profile` con `id`, `business_name`, `tax_id`, `description`, `is_active` e `is_verified`, o `null` cuando no existe. Un error no debe dejar el rol cambiado sin el perfil requerido. La cuenta de usuario sigue teniendo su propio `is_active`: dar de alta o reactivar el perfil comercial no desbloquea una cuenta bloqueada. Estas reglas pertenecen al servicio de la API y no sustituyen la administración técnica ni una restricción global sobre escrituras ORM.

### Imágenes y ficha PDF

Estas rutas exigen un vendedor activo y un producto propio. Se rechazan referencias a productos o imágenes de otro vendedor. Los archivos se gestionan mediante las rutas dedicadas; no se escriben desde el JSON general de producto.

| Operación | Petición | Respuesta de éxito |
|---|---|---|
| `GET /seller/products/{id}/images/` | Sin cuerpo | Lista de imágenes |
| `POST /seller/products/{id}/images/` | `multipart/form-data`: `image`, opcionalmente `alt_text`, `is_main`, `order` | `201`, imagen creada |
| `PATCH /seller/products/{id}/images/{image_id}/` | JSON con `alt_text`, `is_main` y/o `order` | `200`, imagen actualizada |
| `DELETE /seller/products/{id}/images/{image_id}/` | Sin cuerpo | `204` |
| `POST /seller/products/{id}/technical-sheet/` | `multipart/form-data`: `file` | `200`, producto vendedor actualizado |
| `DELETE /seller/products/{id}/technical-sheet/` | Sin cuerpo | `204` |

Cada imagen devuelve `id`, `image` (URL), `alt_text`, `is_main` y `order`. `alt_text` tiene un máximo de 180 caracteres; `order` es un entero no negativo. El servidor admite hasta 12 imágenes por producto, JPEG/PNG/WebP de hasta 5 MiB, no animadas y con un máximo de 8000 píxeles por dimensión y 20 megapíxeles. Comprueba los bytes con Pillow. La primera imagen queda como principal; seleccionar otra mantiene una única principal y borrar la principal selecciona una existente en orden estable.

La ficha admite un PDF de hasta 10 MiB. Se valida extensión, firma y estructura básica, sin afirmar un análisis de malware. Los nombres almacenados se generan con UUID. El detalle público devuelve `technical_sheet` con una URL o `null`; el DTO vendedor incluye además `images`. Los archivos son públicos y no deben contener datos privados. Nginx en producción y el servidor de archivos de Django con `DEBUG` entregan las fichas como descarga, con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`.

Una subida o borrado no crea un nuevo producto ni modifica stock. La sustitución conserva el archivo anterior hasta confirmar el cambio de base. Si la respuesta se pierde, el cliente debe volver a consultar los archivos y revisar el estado antes de repetir una escritura: estas operaciones no tienen la clave de idempotencia del checkout.

### Dashboards

`GET /admin/dashboard/` devuelve secciones como `users`, `sellers`, `products`, `orders`, `sales`, `stock`, `complaints`, `returns` y rankings. `GET /seller/dashboard/` devuelve las secciones propias del vendedor. No existe un contenedor genérico `summary` ni contadores planos equivalentes.

Los importes agregados de estos diccionarios se renderizan como números JSON. `sales.total_revenue` representa el ingreso neto simulado del resumen, `gross_revenue` el bruto y `refunded_amount` los reembolsos incluidos. Los rankings usan `product_id`/`product_name` y, en administración, `seller_id`/`seller`; las series mensuales usan `month`, `orders_count` y `revenue`, además de `units_sold` en vendedor. La aplicación valida los campos que muestra y presenta un error si la respuesta no cumple el contrato, en lugar de inventar ceros. El esquema OpenAPI describe el resto de campos y sus tipos.

La cancelación en tránsito no repone unidades por solicitarla. Se necesita recepción e inspección y únicamente las unidades aptas vuelven al stock disponible. Acciones, cantidades, reintentos y conciliación histórica se detallan en [cancelaciones y devoluciones](cancelaciones-devoluciones.md) y [envíos](envios-vendedor.md).

La renovación y el cierre de sesión verifican una sesión revocable del servidor. Lee [sesiones](sesiones.md) para rotación, concurrencia, límites y cierre sin red.

Para exportar el contrato desde `backend/`:

```bash
python manage.py spectacular --validate --fail-on-warn --file /tmp/agronexus-openapi.yml
```

Usa una ruta temporal de tu sistema si ejecutas Python directamente en Windows. Un esquema válido describe la API; las pruebas de negocio y permisos comprueban su comportamiento.
