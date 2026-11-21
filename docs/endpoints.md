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

`GET /products/` devuelve `{count, next, previous, results}`, con 24 productos por defecto y `page_size` hasta 100. Acepta `page`, búsqueda `search`, slugs de `category`, `brand` y `region`, `min_price`, `max_price`, `in_stock` y `ordering`. El precio filtrado y ordenado es el precio efectivo, incluido el descuento. El orden es estable entre páginas. Los precios inválidos o rangos invertidos responden `400`; una página inexistente responde `404`. Los productos ocultos y los vendedores o sus usuarios inactivos quedan fuera de lista, detalle, destacados, reseñas y preguntas públicas.

La compra requiere cotizar primero. `POST /checkout/` exige dirección, método de pago canónico, token firmado y UUID de idempotencia. Una creación devuelve `201`; recuperar la misma confirmación devuelve `200` con el mismo pedido; un cambio de condiciones devuelve conflicto y solicita revisión. La dirección histórica del pedido es independiente de la libreta actual. Lee [compra e historial](compra-historial.md) antes de modificar este cliente. Todos los métodos de pago siguen siendo simulados.

`GET /users/me/reviews/` conserva el acceso privado a las reseñas propias aunque el producto deje de publicarse. La edición y el borrado requieren ser dueño de la reseña; publicar una reseña exige una compra entregada elegible.

La edición general administrativa admite únicamente `role` e `is_active` del usuario, `is_verified` del vendedor e `is_active` del producto. No admite atributos de privilegios Django, contraseñas, cambios de precio o stock ni escritura general sobre pedidos, pagos o envíos. Estas operaciones tienen rutas y servicios de negocio específicos. Los listados administrativos actuales no están paginados; para volúmenes grandes deben incorporar paginación coordinada con el cliente.

La cancelación en tránsito no repone unidades por solicitarla. Se necesita recepción e inspección y únicamente las unidades aptas vuelven al stock disponible. Acciones, cantidades, reintentos y conciliación histórica se detallan en [cancelaciones y devoluciones](cancelaciones-devoluciones.md) y [envíos](envios-vendedor.md).

La renovación y el cierre de sesión verifican una sesión revocable del servidor. Lee [sesiones](sesiones.md) para rotación, concurrencia, límites y cierre sin red.

Para exportar el contrato desde `backend/`:

```bash
python manage.py spectacular --validate --fail-on-warn --file /tmp/agronexus-openapi.yml
```

Usa una ruta temporal de tu sistema si ejecutas Python directamente en Windows. Un esquema válido describe la API; las pruebas de negocio y permisos comprueban su comportamiento.
