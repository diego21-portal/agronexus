# Endpoints — AgroNexus

## 1. Descripción general

Este documento define los endpoints principales de la API REST de AgroNexus.

La API será desarrollada con Django REST Framework y será consumida por el frontend de la plataforma. Los endpoints permiten gestionar usuarios, productos, carrito, pedidos, pagos simulados, envíos, preguntas, reseñas, vendedores y administración general.

El objetivo de este documento es servir como guía para el desarrollo del backend y como contrato inicial entre frontend y backend.

---

## 2. Convenciones generales

### URL base

```http
/api/v1/
```

### Formato de datos

Las peticiones y respuestas utilizarán formato JSON.

### Autenticación

Los endpoints privados requerirán autenticación mediante token.

```http
Authorization: Bearer <access_token>
```

### Métodos HTTP

| Método | Uso |
|---|---|
| GET | Obtener información |
| POST | Crear un recurso |
| PUT | Reemplazar un recurso completo |
| PATCH | Actualizar parcialmente un recurso |
| DELETE | Eliminar o desactivar un recurso |

### Códigos HTTP comunes

| Código | Significado |
|---|---|
| 200 | Operación exitosa |
| 201 | Recurso creado |
| 204 | Operación exitosa sin contenido |
| 400 | Error de validación |
| 401 | Usuario no autenticado |
| 403 | Usuario sin permisos |
| 404 | Recurso no encontrado |
| 500 | Error interno del servidor |

---

## 3. Autenticación y usuarios

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| POST | `/auth/register/` | Registrar nuevo usuario cliente | Público |
| POST | `/auth/login/` | Iniciar sesión | Público |
| POST | `/auth/logout/` | Cerrar sesión | Autenticado |
| POST | `/auth/refresh/` | Renovar token de acceso | Autenticado |
| GET | `/users/me/` | Obtener datos del usuario actual | Autenticado |
| PATCH | `/users/me/` | Actualizar perfil propio | Autenticado |
| PATCH | `/users/me/preferences/` | Actualizar preferencias de usuario | Autenticado |
| GET | `/users/me/addresses/` | Listar direcciones del usuario | Cliente |
| POST | `/users/me/addresses/` | Crear dirección de envío | Cliente |
| PATCH | `/users/me/addresses/{id}/` | Actualizar dirección | Cliente |
| DELETE | `/users/me/addresses/{id}/` | Eliminar dirección | Cliente |

### Reglas importantes

- Todo usuario nuevo se registra como cliente.
- Cada usuario solo puede modificar sus propios datos.
- Las direcciones solo pueden ser gestionadas por su propietario.

---

## 4. Catálogo público

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/products/` | Listar productos publicados | Público |
| GET | `/products/{slug}/` | Ver detalle de producto | Público |
| GET | `/products/featured/` | Listar productos destacados | Público |
| GET | `/products/promotions/` | Listar productos en promoción | Público |
| GET | `/products/{id}/related/` | Listar productos relacionados | Público |
| GET | `/categories/` | Listar categorías activas | Público |
| GET | `/categories/{slug}/` | Ver detalle de categoría | Público |
| GET | `/brands/` | Listar marcas activas | Público |
| GET | `/brands/{slug}/` | Ver detalle de marca | Público |
| GET | `/regions/` | Listar regiones disponibles | Público |

### Filtros sugeridos para productos

```http
GET /api/v1/products/?search=filtro&category=repuestos&brand=john-deere&region=mendoza&min_price=10000&max_price=50000&in_stock=true&ordering=price
```

| Parámetro | Descripción |
|---|---|
| `search` | Buscar por nombre, marca, SKU o descripción |
| `category` | Filtrar por categoría |
| `brand` | Filtrar por marca |
| `region` | Filtrar por región |
| `min_price` | Precio mínimo |
| `max_price` | Precio máximo |
| `in_stock` | Mostrar solo productos con stock |
| `condition` | Nuevo, usado o reacondicionado |
| `ordering` | Ordenar resultados |

---

## 5. Gestión de productos del vendedor

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/seller/products/` | Listar productos del vendedor | Vendedor |
| POST | `/seller/products/` | Crear producto | Vendedor |
| GET | `/seller/products/{id}/` | Ver producto propio | Vendedor |
| PATCH | `/seller/products/{id}/` | Editar producto propio | Vendedor |
| DELETE | `/seller/products/{id}/` | Desactivar producto propio | Vendedor |
| POST | `/seller/products/{id}/images/` | Subir imagen de producto | Vendedor |
| POST | `/seller/products/{id}/technical-sheets/` | Subir ficha técnica PDF | Vendedor |
| PATCH | `/seller/products/{id}/stock/` | Actualizar stock | Vendedor |

### Reglas importantes

- El vendedor solo puede modificar sus propios productos.
- El SKU debe ser único.
- El stock no puede ser negativo.
- Un producto en borrador no aparece en el catálogo público.
- El producto debe estar activo y publicado para mostrarse públicamente.

---

## 6. Carrito

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/cart/` | Ver carrito actual | Cliente |
| POST | `/cart/items/` | Agregar producto al carrito | Cliente |
| PATCH | `/cart/items/{id}/` | Modificar cantidad de un ítem | Cliente |
| DELETE | `/cart/items/{id}/` | Quitar producto del carrito | Cliente |
| DELETE | `/cart/clear/` | Vaciar carrito | Cliente |

### Ejemplo de agregar producto

```json
{
  "product_id": 15,
  "quantity": 2
}
```

### Reglas importantes

- El producto debe estar activo.
- La cantidad debe ser mayor que cero.
- No se puede superar el stock disponible.
- Un usuario debe tener un solo carrito activo.

---

## 7. Checkout y pedidos

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| POST | `/checkout/` | Confirmar compra desde el carrito | Cliente |
| GET | `/orders/` | Listar pedidos propios | Cliente |
| GET | `/orders/{id}/` | Ver detalle de pedido propio | Cliente |
| POST | `/orders/{id}/cancel/` | Cancelar pedido si corresponde | Cliente |
| GET | `/orders/{id}/tracking/` | Ver seguimiento del pedido | Cliente |
| GET | `/seller/orders/` | Ver pedidos recibidos | Vendedor |
| GET | `/seller/orders/{id}/` | Ver detalle de pedido recibido | Vendedor |
| PATCH | `/seller/orders/{id}/status/` | Actualizar estado del pedido | Vendedor |
| GET | `/admin/orders/` | Listar todos los pedidos | Admin |
| PATCH | `/admin/orders/{id}/` | Actualizar pedido | Admin |

### Ejemplo de checkout

```json
{
  "address_id": 3,
  "payment_method": "SIMULATED_CARD",
  "coupon_code": "AGRO10"
}
```

### Reglas importantes

- El carrito no puede estar vacío.
- El sistema debe validar stock antes de crear la orden.
- El precio del producto debe quedar congelado en la orden.
- Una orden entregada no puede cancelarse.
- Una orden pagada no debe eliminarse.

---

## 8. Pagos simulados

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/payments/{id}/` | Ver detalle de pago | Cliente/Admin |
| POST | `/orders/{id}/payments/simulate/` | Simular pago de una orden | Cliente |
| GET | `/payment-methods/` | Listar métodos de pago simulados | Cliente |
| POST | `/payment-methods/` | Guardar método de pago simulado | Cliente |
| DELETE | `/payment-methods/{id}/` | Eliminar método de pago simulado | Cliente |
| GET | `/admin/payments/` | Listar pagos simulados | Admin |
| POST | `/admin/payments/{id}/approve/` | Aprobar pago simulado | Admin |
| POST | `/admin/payments/{id}/reject/` | Rechazar pago simulado | Admin |

### Estados posibles

```text
PENDING
APPROVED
REJECTED
CANCELLED
REFUNDED
```

### Reglas importantes

- No se almacenan datos reales de tarjetas.
- El monto del pago debe coincidir con el total de la orden.
- Un pago rechazado no permite avanzar el pedido.
- Un pago aprobado habilita la preparación del pedido.

---

## 9. Envíos y seguimiento

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/shipments/{id}/` | Ver información del envío | Cliente/Vendedor/Admin |
| GET | `/shipments/{id}/events/` | Ver eventos del envío | Cliente/Vendedor/Admin |
| POST | `/shipments/{id}/events/` | Crear evento de seguimiento | Vendedor/Operador/Admin |
| PATCH | `/shipments/{id}/status/` | Actualizar estado del envío | Vendedor/Operador/Admin |
| GET | `/admin/shipments/` | Listar todos los envíos | Admin |

### Estados posibles

```text
CREATED
PREPARING
DISPATCHED
IN_TRANSIT
IN_DISTRIBUTION_CENTER
OUT_FOR_DELIVERY
DELIVERED
DELIVERY_PROBLEM
CANCELLED
```

### Reglas importantes

- Cada cambio de estado debe generar un evento.
- El cliente solo puede consultar el seguimiento.
- El vendedor, operador logístico o administrador pueden actualizar estados.
- Un pedido entregado no debe modificarse libremente.

---

## 10. Preguntas al vendedor

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/products/{slug}/questions/` | Ver preguntas del producto | Público |
| POST | `/products/{slug}/questions/` | Crear pregunta sobre producto | Cliente |
| GET | `/seller/questions/` | Ver preguntas recibidas | Vendedor |
| POST | `/seller/questions/{id}/answer/` | Responder pregunta | Vendedor |
| PATCH | `/admin/questions/{id}/` | Moderar pregunta | Admin |
| DELETE | `/admin/questions/{id}/` | Ocultar pregunta | Admin |

### Reglas importantes

- Solo usuarios autenticados pueden preguntar.
- Solo el vendedor dueño del producto puede responder.
- Las preguntas públicas ayudan a otros compradores.
- El administrador puede moderar preguntas inapropiadas.

---

## 11. Reseñas y favoritos

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/products/{slug}/reviews/` | Ver reseñas de producto | Público |
| POST | `/products/{slug}/reviews/` | Crear reseña de producto | Cliente |
| PATCH | `/reviews/{id}/` | Editar reseña propia | Cliente |
| DELETE | `/reviews/{id}/` | Eliminar reseña propia | Cliente |
| GET | `/users/me/favorites/` | Ver productos favoritos | Cliente |
| POST | `/users/me/favorites/` | Agregar producto a favoritos | Cliente |
| DELETE | `/users/me/favorites/{id}/` | Quitar producto de favoritos | Cliente |

### Reglas importantes

- Solo puede reseñar quien compró el producto.
- La calificación debe estar entre 1 y 5.
- Un producto no debe repetirse en favoritos del mismo usuario.
- Las reseñas afectan la calificación promedio del producto.

---

## 12. Portal del vendedor

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/seller/dashboard/` | Ver resumen del vendedor | Vendedor |
| GET | `/seller/profile/` | Ver perfil comercial | Vendedor |
| PATCH | `/seller/profile/` | Editar perfil comercial | Vendedor |
| GET | `/seller/stock/` | Ver stock de productos propios | Vendedor |
| GET | `/seller/reviews/` | Ver reseñas recibidas | Vendedor |
| GET | `/seller/reports/sales/` | Ver reporte de ventas propias | Vendedor |

### Métricas posibles

- Ventas totales
- Pedidos pendientes
- Productos publicados
- Productos sin stock
- Preguntas pendientes
- Calificación promedio

---

## 13. Administración

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/admin/dashboard/` | Ver dashboard general | Admin |
| GET | `/admin/users/` | Listar usuarios | Admin |
| PATCH | `/admin/users/{id}/` | Actualizar usuario | Admin |
| PATCH | `/admin/users/{id}/deactivate/` | Desactivar usuario | Admin |
| GET | `/admin/sellers/` | Listar vendedores | Admin |
| PATCH | `/admin/sellers/{id}/verify/` | Verificar vendedor | Admin |
| PATCH | `/admin/sellers/{id}/deactivate/` | Desactivar vendedor | Admin |
| POST | `/admin/categories/` | Crear categoría | Admin |
| PATCH | `/admin/categories/{id}/` | Editar categoría | Admin |
| DELETE | `/admin/categories/{id}/` | Desactivar categoría | Admin |
| POST | `/admin/brands/` | Crear marca | Admin |
| PATCH | `/admin/brands/{id}/` | Editar marca | Admin |
| DELETE | `/admin/brands/{id}/` | Desactivar marca | Admin |
| POST | `/admin/regions/` | Crear región | Admin |
| PATCH | `/admin/regions/{id}/` | Editar región | Admin |
| DELETE | `/admin/regions/{id}/` | Desactivar región | Admin |
| GET | `/admin/products/` | Listar todos los productos | Admin |
| PATCH | `/admin/products/{id}/status/` | Cambiar estado de producto | Admin |
| GET | `/admin/reports/sales/` | Reporte general de ventas | Admin |
| GET | `/admin/reports/stock/` | Reporte de stock | Admin |

### Reglas importantes

- Solo administradores pueden acceder a estos endpoints.
- Las acciones críticas deben quedar registradas.
- El administrador puede pausar productos, usuarios o vendedores.
- Los reportes deben estar protegidos por permisos.

---

## 14. Promociones y cupones

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/promotions/` | Ver promociones activas | Público |
| GET | `/coupons/validate/` | Validar cupón en checkout | Cliente |
| POST | `/admin/promotions/` | Crear promoción | Admin |
| PATCH | `/admin/promotions/{id}/` | Editar promoción | Admin |
| DELETE | `/admin/promotions/{id}/` | Desactivar promoción | Admin |
| POST | `/admin/coupons/` | Crear cupón | Admin |
| PATCH | `/admin/coupons/{id}/` | Editar cupón | Admin |
| DELETE | `/admin/coupons/{id}/` | Desactivar cupón | Admin |

### Ejemplo de validación de cupón

```http
GET /api/v1/coupons/validate/?code=AGRO10
```

### Reglas importantes

- El cupón debe estar activo.
- El cupón no debe estar vencido.
- El cupón no debe superar su límite de uso.
- El descuento debe recalcularse antes de confirmar la compra.

---

## 15. Reclamos

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/complaints/` | Ver mis reclamos | Cliente |
| POST | `/orders/{id}/complaints/` | Crear reclamo sobre una orden | Cliente |
| GET | `/complaints/{id}/` | Ver detalle de reclamo | Cliente/Admin |
| GET | `/seller/complaints/` | Ver reclamos relacionados con ventas propias | Vendedor |
| GET | `/admin/complaints/` | Listar todos los reclamos | Admin |
| PATCH | `/admin/complaints/{id}/` | Cambiar estado del reclamo | Admin |

### Estados posibles

```text
OPEN
IN_REVIEW
RESOLVED
REJECTED
CLOSED
```

### Reglas importantes

- Un reclamo debe estar asociado a una orden.
- Solo el comprador puede reclamar sobre su pedido.
- El administrador puede revisar y resolver reclamos.
- Los reclamos pueden afectar la reputación del vendedor.

---

## 16. Notificaciones

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/notifications/` | Listar mis notificaciones | Autenticado |
| PATCH | `/notifications/{id}/read/` | Marcar notificación como leída | Autenticado |
| PATCH | `/notifications/read-all/` | Marcar todas como leídas | Autenticado |

### Tipos de notificación

```text
ORDER
PAYMENT
SHIPMENT
QUESTION
REVIEW
PROMOTION
SYSTEM
```

---

## 17. Respuestas de error esperadas

### Error de validación

```json
{
  "error": "Datos inválidos",
  "details": {
    "stock": "No hay stock suficiente para este producto."
  }
}
```

### Error de permisos

```json
{
  "error": "No tienes permisos para realizar esta acción."
}
```

### Recurso no encontrado

```json
{
  "error": "Recurso no encontrado."
}
```

---

## 18. Endpoints mínimos para el MVP

Para la primera versión funcional del proyecto, se priorizarán estos endpoints:

```text
POST /auth/register/
POST /auth/login/
GET /users/me/

GET /products/
GET /products/{slug}/
GET /categories/
GET /brands/
GET /regions/

POST /seller/products/
PATCH /seller/products/{id}/
GET /seller/products/

GET /cart/
POST /cart/items/
PATCH /cart/items/{id}/
DELETE /cart/items/{id}/

POST /checkout/
GET /orders/
GET /orders/{id}/
GET /orders/{id}/tracking/

POST /orders/{id}/payments/simulate/

GET /admin/dashboard/
GET /admin/products/
GET /admin/orders/
GET /admin/users/
```

---

## 19. Conclusión

Este documento define la estructura inicial de endpoints de AgroNexus.

La API se organizará por módulos para mantener claridad, seguridad y escalabilidad. Los endpoints aquí definidos servirán como guía para implementar vistas, serializers, permisos, validaciones y servicios en Django REST Framework.

La implementación se realizará por fases, comenzando por los endpoints mínimos del MVP y luego agregando funcionalidades avanzadas como reseñas, preguntas, promociones, reportes, reclamos y notificaciones.
