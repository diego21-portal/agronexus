# Modelo de Datos — AgroNexus

## 1. Descripción general

El modelo de datos de AgroNexus está diseñado para soportar una plataforma web tipo marketplace orientada al sector agrícola y agroindustrial.

El sistema permite gestionar usuarios, vendedores, productos, categorías, marcas, stock, carrito, pedidos, pagos simulados, envíos, preguntas, reseñas, promociones, reclamos, notificaciones y reportes comerciales.

El objetivo del modelo es mantener una estructura clara, escalable y preparada para futuras funcionalidades como pagos reales, stock por sucursal, facturación, recomendaciones y auditoría avanzada.

---

## 2. Convenciones generales

Para mantener consistencia en el desarrollo, se utilizarán las siguientes convenciones:

- Los nombres de modelos estarán en inglés.
- Los nombres de campos estarán en inglés.
- La documentación explicativa estará en español.
- Todos los modelos principales tendrán campos de auditoría:
  - `created_at`
  - `updated_at`
- Los modelos importantes tendrán `is_active` cuando sea necesario.
- Se utilizarán relaciones explícitas mediante claves foráneas.
- Los precios se manejarán con campos decimales, no con números flotantes.
- Los estados del sistema se representarán mediante opciones controladas.
- Los archivos como imágenes y fichas técnicas estarán asociados a productos.
- No se almacenarán datos bancarios reales ni números completos de tarjetas.

---

## 3. Módulos principales del modelo

```text
Usuarios y perfiles
Vendedores
Regiones y direcciones
Catálogo de productos
Stock
Carrito
Pedidos
Pagos simulados
Envíos
Preguntas y respuestas
Reseñas
Promociones
Reclamos
Notificaciones
Reportes
```

---

## 4. Entidades principales

```text
User
UserProfile
Address
Region
SellerProfile
Category
Brand
Product
ProductImage
ProductTechnicalSheet
ProductQuestion
ProductAnswer
ProductReview
FavoriteProduct
Cart
CartItem
Order
OrderItem
Payment
PaymentMethod
Shipment
ShipmentEvent
StockMovement
Promotion
Coupon
Complaint
Notification
```

---

## 5. Usuarios y perfiles

### 5.1 User

Representa la cuenta principal del sistema.

En Django se recomienda utilizar un modelo de usuario personalizado desde el inicio del proyecto para evitar problemas futuros si se necesitan campos adicionales.

#### Campos principales

```text
id
email
username
password
first_name
last_name
role
is_active
is_staff
is_superuser
date_joined
last_login
```

#### Roles posibles

```text
CUSTOMER
SELLER
LOGISTICS_OPERATOR
ADMIN
SUPERADMIN
```

> Nota: el visitante no se guarda como usuario en base de datos. Es simplemente un usuario no autenticado.

#### Reglas de negocio

- El email debe ser único.
- El usuario debe tener un rol asignado.
- Un usuario cliente puede comprar productos.
- Un usuario vendedor puede publicar productos si tiene un perfil de vendedor activo.
- Un usuario administrador puede gestionar la plataforma.
- Un usuario operador logístico puede actualizar estados de envío.

---

### 5.2 UserProfile

Guarda información adicional del usuario.

#### Campos principales

```text
id
user
phone
avatar
document_type
document_number
birth_date
preferred_region
preferred_theme
created_at
updated_at
```

#### Relaciones

```text
User 1 ─── 1 UserProfile
Region 1 ─── N UserProfile
```

#### Reglas de negocio

- Cada usuario debe tener un único perfil.
- El tema visual puede ser claro, oscuro o automático.
- La región preferida se usará para mostrar productos y promociones cercanas.

---

### 5.3 Address

Representa las direcciones de envío del usuario.

#### Campos principales

```text
id
user
region
street
number
city
province
postal_code
reference
is_default
created_at
updated_at
```

#### Relaciones

```text
User 1 ─── N Address
Region 1 ─── N Address
```

#### Reglas de negocio

- Un usuario puede tener varias direcciones.
- Solo una dirección debería estar marcada como principal.
- Para confirmar una compra, el usuario debe tener una dirección válida.

---

### 5.4 Region

Representa regiones, provincias o zonas comerciales.

#### Campos principales

```text
id
name
province
country
is_active
created_at
updated_at
```

#### Ejemplos

```text
Mendoza
San Juan
Córdoba
Buenos Aires
Santa Fe
```

#### Reglas de negocio

- La región afecta disponibilidad, envío, promociones y orden de productos.
- Un producto puede estar asociado a una región principal de venta.
- Una dirección debe pertenecer a una región.

---

## 6. Vendedores

### 6.1 SellerProfile

Representa el perfil comercial de un vendedor.

#### Campos principales

```text
id
user
business_name
tax_id
description
logo
rating_average
total_sales
is_verified
is_active
created_at
updated_at
```

#### Relaciones

```text
User 1 ─── 1 SellerProfile
SellerProfile 1 ─── N Product
SellerProfile 1 ─── N OrderItem
```

#### Reglas de negocio

- Un vendedor debe estar asociado a un usuario.
- Un vendedor activo puede publicar productos.
- Un vendedor puede responder preguntas sobre sus productos.
- Un vendedor puede ver pedidos relacionados con sus publicaciones.
- La reputación del vendedor se calcula a partir de ventas, reseñas, entregas y reclamos.

---

## 7. Catálogo de productos

### 7.1 Category

Representa una categoría de productos.

#### Campos principales

```text
id
name
slug
description
parent
is_active
created_at
updated_at
```

#### Ejemplos

```text
Maquinaria
Repuestos
Insumos
Herramientas
Riego
Lubricantes
Neumáticos
Tecnología agrícola
```

#### Relaciones

```text
Category 1 ─── N Product
Category 1 ─── N Category
```

#### Reglas de negocio

- Una categoría puede tener subcategorías.
- Una categoría inactiva no debería mostrarse en el catálogo público.
- El slug debe ser único.

---

### 7.2 Brand

Representa la marca del producto.

#### Campos principales

```text
id
name
slug
description
logo
is_active
created_at
updated_at
```

#### Ejemplos

```text
John Deere
Massey Ferguson
New Holland
Agrometal
Pla
Yanmar
```

#### Relaciones

```text
Brand 1 ─── N Product
```

#### Reglas de negocio

- La marca puede usarse como filtro de búsqueda.
- El slug debe ser único.

---

### 7.3 Product

Representa un producto publicado en la plataforma.

#### Campos principales

```text
id
seller
category
brand
region
name
slug
sku
short_description
description
technical_description
price
discount_price
unit
stock
minimum_stock
condition
status
warranty
shipping_available
average_rating
total_reviews
is_featured
is_active
created_at
updated_at
```

#### Valores posibles para `condition`

```text
NEW
USED
REFURBISHED
```

#### Valores posibles para `status`

```text
DRAFT
PUBLISHED
PAUSED
OUT_OF_STOCK
ARCHIVED
```

#### Ejemplos de `unit`

```text
unidad
kg
litro
metro
bolsa
caja
pack
```

#### Relaciones

```text
SellerProfile 1 ─── N Product
Category 1 ─── N Product
Brand 1 ─── N Product
Region 1 ─── N Product
Product 1 ─── N ProductImage
Product 1 ─── N ProductQuestion
Product 1 ─── N ProductReview
Product 1 ─── N StockMovement
```

#### Reglas de negocio

- Un producto debe pertenecer a un vendedor.
- Un producto debe tener categoría.
- Un producto debe tener precio mayor o igual a cero.
- El SKU debe ser único.
- El stock no puede ser negativo.
- Si el stock llega a cero, el producto debe figurar como agotado.
- Si `discount_price` existe, debe ser menor que `price`.
- Solo los productos publicados y activos aparecen en el catálogo público.
- Los productos destacados pueden mostrarse en la home.

---

### 7.4 ProductImage

Representa las imágenes asociadas a un producto.

#### Campos principales

```text
id
product
image
alt_text
is_main
order
created_at
updated_at
```

#### Relaciones

```text
Product 1 ─── N ProductImage
```

#### Reglas de negocio

- Un producto puede tener varias imágenes.
- Solo una imagen debería estar marcada como principal.
- Las imágenes se ordenan mediante el campo `order`.

---

### 7.5 ProductTechnicalSheet

Representa la ficha técnica en PDF de un producto.

#### Campos principales

```text
id
product
file
title
version
uploaded_at
```

#### Relaciones

```text
Product 1 ─── N ProductTechnicalSheet
```

#### Reglas de negocio

- Un producto puede tener una o varias fichas técnicas.
- La ficha técnica debe estar asociada a un producto.
- El archivo debe ser de tipo PDF.
- Puede existir una ficha técnica principal o una última versión.

---

## 8. Preguntas y respuestas

### 8.1 ProductQuestion

Representa una pregunta realizada por un cliente sobre un producto.

#### Campos principales

```text
id
product
user
question
is_public
is_answered
created_at
updated_at
```

#### Relaciones

```text
Product 1 ─── N ProductQuestion
User 1 ─── N ProductQuestion
ProductQuestion 1 ─── 1 ProductAnswer
```

#### Reglas de negocio

- Solo usuarios autenticados pueden preguntar.
- La pregunta pertenece a un producto.
- Las preguntas pueden ser públicas.
- El vendedor del producto puede responder la pregunta.
- Un administrador puede moderar preguntas.

---

### 8.2 ProductAnswer

Representa la respuesta del vendedor a una pregunta.

#### Campos principales

```text
id
question
seller
answer
created_at
updated_at
```

#### Relaciones

```text
ProductQuestion 1 ─── 1 ProductAnswer
SellerProfile 1 ─── N ProductAnswer
```

#### Reglas de negocio

- Solo el vendedor dueño del producto puede responder.
- Una pregunta puede tener una respuesta principal.
- La respuesta debe quedar visible junto a la pregunta si es pública.

---

## 9. Reseñas y favoritos

### 9.1 ProductReview

Representa una reseña realizada por un cliente.

#### Campos principales

```text
id
product
user
order_item
rating
comment
is_public
created_at
updated_at
```

#### Relaciones

```text
Product 1 ─── N ProductReview
User 1 ─── N ProductReview
OrderItem 1 ─── 1 ProductReview
```

#### Reglas de negocio

- La calificación debe estar entre 1 y 5.
- Solo debería poder reseñar quien compró el producto.
- Un usuario no debería reseñar dos veces el mismo ítem comprado.
- Las reseñas pueden afectar el promedio del producto y del vendedor.

---

### 9.2 FavoriteProduct

Representa productos guardados como favoritos por un usuario.

#### Campos principales

```text
id
user
product
created_at
```

#### Relaciones

```text
User 1 ─── N FavoriteProduct
Product 1 ─── N FavoriteProduct
```

#### Reglas de negocio

- Un usuario no puede guardar dos veces el mismo producto.
- Los favoritos se muestran en el perfil del usuario.

---

## 10. Carrito

### 10.1 Cart

Representa el carrito activo de un usuario.

#### Campos principales

```text
id
user
status
created_at
updated_at
```

#### Valores posibles para `status`

```text
ACTIVE
ORDERED
ABANDONED
```

#### Relaciones

```text
User 1 ─── N Cart
Cart 1 ─── N CartItem
```

#### Reglas de negocio

- Un usuario debería tener un solo carrito activo.
- Cuando se confirma la compra, el carrito pasa a estado `ORDERED`.
- El carrito no debe permitir productos inactivos o sin stock.

---

### 10.2 CartItem

Representa un producto dentro del carrito.

#### Campos principales

```text
id
cart
product
quantity
unit_price
created_at
updated_at
```

#### Relaciones

```text
Cart 1 ─── N CartItem
Product 1 ─── N CartItem
```

#### Reglas de negocio

- La cantidad debe ser mayor que cero.
- No se puede agregar más cantidad que el stock disponible.
- El precio unitario puede guardarse para conservar el valor al momento de agregarlo.
- Un mismo producto no debería duplicarse en el carrito.

---

## 11. Pedidos

### 11.1 Order

Representa una orden de compra.

#### Campos principales

```text
id
user
shipping_address
order_number
status
subtotal
discount_total
shipping_cost
total
created_at
updated_at
```

#### Valores posibles para `status`

```text
PENDING
CONFIRMED
PAID
PREPARING
SHIPPED
DELIVERED
CANCELLED
PROBLEM
```

#### Relaciones

```text
User 1 ─── N Order
Address 1 ─── N Order
Order 1 ─── N OrderItem
Order 1 ─── 1 Payment
Order 1 ─── 1 Shipment
```

#### Reglas de negocio

- Una orden pertenece a un cliente.
- El total debe calcularse desde los ítems, descuentos y envío.
- No se debe permitir modificar libremente una orden entregada o cancelada.
- Para el MVP, se recomienda permitir una orden con productos de un mismo vendedor o manejar la separación por vendedor desde `OrderItem`.
- En una versión avanzada, una compra con productos de distintos vendedores puede generar subórdenes por vendedor.

---

### 11.2 OrderItem

Representa un producto comprado dentro de una orden.

#### Campos principales

```text
id
order
product
seller
product_name
sku
quantity
unit_price
total_price
created_at
```

#### Relaciones

```text
Order 1 ─── N OrderItem
Product 1 ─── N OrderItem
SellerProfile 1 ─── N OrderItem
```

#### Reglas de negocio

- La cantidad debe ser mayor que cero.
- El precio debe quedar congelado al momento de la compra.
- Se guarda el nombre y SKU del producto para mantener historial aunque el producto cambie después.
- Al generar la orden, el sistema debe descontar stock o reservarlo.

---

## 12. Pagos simulados

### 12.1 Payment

Representa el pago asociado a una orden.

#### Campos principales

```text
id
order
payment_method
status
amount
transaction_code
paid_at
created_at
updated_at
```

#### Valores posibles para `payment_method`

```text
SIMULATED_CARD
SIMULATED_BANK_TRANSFER
CASH_ON_DELIVERY
BUSINESS_ACCOUNT
SIMULATED_MERCADO_PAGO
```

#### Valores posibles para `status`

```text
PENDING
APPROVED
REJECTED
CANCELLED
REFUNDED
```

#### Relaciones

```text
Order 1 ─── 1 Payment
```

#### Reglas de negocio

- El monto del pago debe coincidir con el total de la orden.
- Si el pago es aprobado, la orden puede avanzar.
- Si el pago es rechazado, la orden no debe pasar a preparación.
- El código de transacción puede ser simulado.
- No se deben guardar datos reales de tarjetas.

---

### 12.2 PaymentMethod

Representa métodos de pago simulados guardados por el usuario.

#### Campos principales

```text
id
user
type
alias
last_four_digits
provider
is_default
created_at
updated_at
```

#### Valores posibles para `type`

```text
SIMULATED_CARD
SIMULATED_BANK_TRANSFER
BUSINESS_ACCOUNT
```

#### Relaciones

```text
User 1 ─── N PaymentMethod
```

#### Reglas de negocio

- Este modelo es solo para simulación.
- No se almacenan números completos de tarjeta.
- No se almacenan códigos de seguridad.
- Un usuario puede tener un método marcado como principal.

---

## 13. Envíos

### 13.1 Shipment

Representa el envío asociado a una orden.

#### Campos principales

```text
id
order
tracking_code
status
carrier
estimated_delivery_date
delivered_at
created_at
updated_at
```

#### Valores posibles para `status`

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

#### Relaciones

```text
Order 1 ─── 1 Shipment
Shipment 1 ─── N ShipmentEvent
```

#### Reglas de negocio

- Cada orden debe tener un seguimiento de envío.
- El código de seguimiento puede ser generado por el sistema.
- Solo vendedores, operadores logísticos o administradores pueden actualizar estados de envío.
- El cliente puede consultar el seguimiento.

---

### 13.2 ShipmentEvent

Representa cada evento del seguimiento.

#### Campos principales

```text
id
shipment
status
description
location
created_by
created_at
```

#### Relaciones

```text
Shipment 1 ─── N ShipmentEvent
User 1 ─── N ShipmentEvent
```

#### Reglas de negocio

- Cada cambio importante del envío debe generar un evento.
- Los eventos deben mostrarse ordenados por fecha.
- El último evento determina el estado visible del envío.

---

## 14. Stock

### 14.1 StockMovement

Representa movimientos de stock.

#### Campos principales

```text
id
product
movement_type
quantity
previous_stock
new_stock
reason
created_by
created_at
```

#### Valores posibles para `movement_type`

```text
INITIAL
SALE
RETURN
CANCELLATION
MANUAL_ADJUSTMENT
RESTOCK
RESERVATION
RELEASE_RESERVATION
```

#### Relaciones

```text
Product 1 ─── N StockMovement
User 1 ─── N StockMovement
```

#### Reglas de negocio

- Todo cambio de stock debe generar un movimiento.
- El stock nuevo no puede ser negativo.
- Una venta reduce el stock.
- Una cancelación puede devolver stock.
- Una reposición aumenta stock.
- Un ajuste manual debe indicar motivo.

---

## 15. Promociones y cupones

### 15.1 Promotion

Representa promociones comerciales.

#### Campos principales

```text
id
name
description
discount_type
discount_value
start_date
end_date
is_active
created_at
updated_at
```

#### Valores posibles para `discount_type`

```text
PERCENTAGE
FIXED_AMOUNT
FREE_SHIPPING
```

#### Reglas de negocio

- Una promoción debe tener fecha de inicio y fin.
- Una promoción vencida no debe aplicarse.
- El descuento puede ser porcentual, monto fijo o envío gratis.

---

### 15.2 Coupon

Representa cupones aplicables al checkout.

#### Campos principales

```text
id
code
description
discount_type
discount_value
usage_limit
used_count
start_date
end_date
is_active
created_at
updated_at
```

#### Reglas de negocio

- El código del cupón debe ser único.
- No se puede usar un cupón vencido.
- No se puede superar el límite de uso.
- El descuento debe recalcularse antes de confirmar la orden.

---

## 16. Reclamos

### 16.1 Complaint

Representa reclamos o problemas reportados por clientes.

#### Campos principales

```text
id
user
order
subject
description
status
created_at
updated_at
```

#### Valores posibles para `status`

```text
OPEN
IN_REVIEW
RESOLVED
REJECTED
CLOSED
```

#### Relaciones

```text
User 1 ─── N Complaint
Order 1 ─── N Complaint
```

#### Reglas de negocio

- Un reclamo debe estar asociado a una orden.
- El cliente puede crear reclamos sobre sus compras.
- El administrador puede revisar y resolver reclamos.
- El vendedor puede ver reclamos relacionados con sus ventas.

---

## 17. Notificaciones

### 17.1 Notification

Representa notificaciones internas del sistema.

#### Campos principales

```text
id
user
title
message
notification_type
is_read
created_at
```

#### Valores posibles para `notification_type`

```text
ORDER
PAYMENT
SHIPMENT
QUESTION
REVIEW
PROMOTION
SYSTEM
```

#### Relaciones

```text
User 1 ─── N Notification
```

#### Reglas de negocio

- Las notificaciones pertenecen a un usuario.
- Se generan por eventos relevantes del sistema.
- El usuario puede marcarlas como leídas.

---

## 18. Relaciones principales del sistema

```text
User 1 ─── 1 UserProfile
User 1 ─── N Address
User 1 ─── N Cart
User 1 ─── N Order
User 1 ─── N ProductQuestion
User 1 ─── N ProductReview
User 1 ─── N FavoriteProduct

User 1 ─── 1 SellerProfile
SellerProfile 1 ─── N Product
SellerProfile 1 ─── N OrderItem

Category 1 ─── N Product
Brand 1 ─── N Product
Region 1 ─── N Product

Product 1 ─── N ProductImage
Product 1 ─── N ProductTechnicalSheet
Product 1 ─── N ProductQuestion
Product 1 ─── N ProductReview
Product 1 ─── N StockMovement

Cart 1 ─── N CartItem
Order 1 ─── N OrderItem
Order 1 ─── 1 Payment
Order 1 ─── 1 Shipment
Shipment 1 ─── N ShipmentEvent
```

---

## 19. Reglas de negocio generales

### Productos

- Un producto no puede tener stock negativo.
- Un producto sin stock debe mostrarse como agotado.
- Un producto inactivo no aparece en el catálogo público.
- El precio debe ser mayor o igual a cero.
- El descuento debe ser menor que el precio original.

### Carrito

- El carrito no puede contener productos inactivos.
- El carrito no puede superar el stock disponible.
- El usuario debe estar autenticado para confirmar compra.
- Un producto no debe duplicarse dentro del mismo carrito.

### Pedidos

- Una orden debe tener al menos un producto.
- El total debe calcularse automáticamente.
- Una orden pagada no debería eliminarse.
- Una orden entregada no debería modificarse libremente.
- La orden debe congelar precio, nombre y SKU de los productos comprados.

### Pagos

- El pago debe coincidir con el total de la orden.
- Los pagos son simulados en la primera versión.
- No se almacenan datos bancarios reales.
- Una orden con pago rechazado no avanza a preparación.

### Envíos

- Un pedido confirmado debe tener seguimiento.
- Cada cambio de estado debe generar un evento.
- Solo roles autorizados pueden modificar el envío.

### Reseñas

- Solo quien compró puede reseñar.
- La puntuación debe estar entre 1 y 5.
- Una reseña puede afectar el promedio del producto.

---

## 20. Índices recomendados

Para mejorar búsquedas y rendimiento, se considerarán índices en los siguientes campos:

```text
User.email
Product.slug
Product.sku
Product.name
Product.category
Product.brand
Product.region
Product.status
Product.is_active
Order.order_number
Order.status
Payment.status
Shipment.tracking_code
Coupon.code
```

También se evaluarán índices compuestos para búsquedas frecuentes:

```text
Product(category, region, status)
Product(brand, region, is_active)
Order(user, status)
Order(status, created_at)
```

---

## 21. Restricciones recomendadas

```text
User.email debe ser único.
Product.sku debe ser único.
Product.slug debe ser único.
Category.slug debe ser único.
Brand.slug debe ser único.
Coupon.code debe ser único.
Order.order_number debe ser único.
Shipment.tracking_code debe ser único.
CartItem debe evitar duplicar el mismo producto dentro del mismo carrito.
FavoriteProduct debe evitar duplicar el mismo producto para el mismo usuario.
ProductReview debe evitar múltiples reseñas para el mismo producto comprado.
```

---

## 22. Decisiones de diseño

### Uso de pagos simulados

En la primera versión, los pagos serán simulados para evitar depender de una pasarela externa. Esto permite construir y probar el flujo completo de compra.

En futuras versiones se podrá integrar Mercado Pago, Stripe u otra pasarela real.

### Stock controlado por movimientos

El stock no se modificará sin dejar registro. Cada cambio importante generará un `StockMovement`, lo cual permite auditoría y trazabilidad.

### Orden con datos congelados

Los productos pueden cambiar de precio, nombre o descripción con el tiempo. Por eso, `OrderItem` guarda datos importantes del producto al momento de la compra.

### Región como parte del negocio

La región permite personalizar resultados, calcular envíos, mostrar promociones locales y priorizar vendedores cercanos.

### Fichas técnicas en PDF

Los productos técnicos del sector agrícola suelen requerir información detallada. Por eso se incluye un modelo para almacenar fichas técnicas asociadas a productos.

---

## 23. Modelo mínimo para la primera versión

Para el MVP inicial no será necesario implementar todos los modelos desde el primer día.

### Modelos prioritarios

```text
User
UserProfile
Address
Region
SellerProfile
Category
Brand
Product
ProductImage
Cart
CartItem
Order
OrderItem
Payment
Shipment
ShipmentEvent
StockMovement
```

### Modelos para fases posteriores

```text
ProductTechnicalSheet
ProductQuestion
ProductAnswer
ProductReview
FavoriteProduct
Promotion
Coupon
Complaint
Notification
PaymentMethod
```

---

## 24. Futuras mejoras del modelo

En futuras versiones se podrán agregar:

- Stock por sucursal
- Facturación
- Historial de precios
- Sistema de recomendaciones
- Auditoría avanzada
- Chat entre comprador y vendedor
- Integración real con pagos
- Integración real con empresas de envío
- Multi-moneda
- Productos usados o subastas
- Favoritos por lista
- Comparador de productos

---

## 25. Conclusión

El modelo de datos de AgroNexus está diseñado para representar una plataforma marketplace completa, escalable y orientada a necesidades reales del sector agrícola.

La estructura inicial permite desarrollar un MVP funcional y luego escalar hacia funcionalidades más avanzadas como reputación de vendedores, pagos reales, reportes comerciales, logística avanzada y recomendaciones personalizadas.
