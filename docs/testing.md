# Testing — AgroNexus

## 1. Descripción general

Este documento define la estrategia inicial de pruebas para AgroNexus.

El objetivo del testing es verificar que las funcionalidades principales del sistema funcionen correctamente, que las reglas de negocio se cumplan y que los permisos protejan los recursos sensibles.

Las pruebas se implementarán de forma progresiva, comenzando por el MVP y luego ampliándose a módulos avanzados como reseñas, preguntas, promociones, reclamos y reportes.

---

## 2. Objetivos del testing

Las pruebas deben ayudar a garantizar que:

- Los usuarios puedan registrarse e iniciar sesión.
- Los permisos funcionen según el rol.
- Los productos se creen y consulten correctamente.
- El carrito valide cantidades y stock.
- El checkout genere órdenes válidas.
- Los pagos simulados actualicen el estado correctamente.
- Los envíos registren eventos de seguimiento.
- Los usuarios no accedan a datos ajenos.
- Las reglas de negocio críticas se cumplan.

---

## 3. Tipos de pruebas previstas

### Pruebas unitarias

Validan funciones, modelos, servicios y reglas de negocio de forma aislada.

Ejemplos:

- Validar que un producto no pueda tener stock negativo.
- Validar que un descuento no sea mayor que el precio.
- Validar que el total de una orden se calcule correctamente.

### Pruebas de integración

Validan la interacción entre módulos.

Ejemplos:

- Crear una orden desde un carrito.
- Registrar un pago simulado.
- Crear un envío al confirmar una orden.
- Descontar stock cuando se confirma una compra.

### Pruebas de API

Validan endpoints de Django REST Framework.

Ejemplos:

- `GET /api/v1/products/`
- `POST /api/v1/cart/items/`
- `POST /api/v1/checkout/`
- `GET /api/v1/orders/{id}/`

### Pruebas de permisos

Validan que cada rol solo pueda acceder a lo que le corresponde.

Ejemplos:

- Un cliente no puede crear productos.
- Un vendedor no puede editar productos de otro vendedor.
- Un cliente no puede ver pedidos ajenos.
- Un visitante no puede acceder al carrito.

### Pruebas manuales

Validan el comportamiento visual y funcional desde el frontend.

Ejemplos:

- Buscar un producto.
- Agregarlo al carrito.
- Simular una compra.
- Ver seguimiento del pedido.
- Editar perfil de usuario.

---

## 4. Herramientas previstas

### Backend

- Django TestCase
- Pytest
- pytest-django
- Django REST Framework APIClient
- Coverage

### Frontend

- Vitest
- React Testing Library
- Playwright o Cypress para pruebas end-to-end futuras

### Utilidades

- Base de datos de testing separada.
- Fixtures o factories para datos de prueba.
- GitHub Actions para ejecutar pruebas automáticamente.

---

## 5. Módulos a probar

### Usuarios

Pruebas mínimas:

- Registro exitoso.
- Registro con email repetido.
- Login exitoso.
- Login con credenciales inválidas.
- Obtener usuario autenticado.
- Editar perfil propio.
- Impedir acceso a usuario no autenticado.

### Roles y permisos

Pruebas mínimas:

- Visitante puede ver productos públicos.
- Cliente puede comprar.
- Cliente no puede publicar productos.
- Vendedor puede crear productos.
- Vendedor no puede editar productos ajenos.
- Operador puede actualizar envíos.
- Admin puede gestionar usuarios y productos.

### Productos

Pruebas mínimas:

- Crear producto como vendedor.
- No permitir producto sin categoría.
- No permitir precio negativo.
- No permitir stock negativo.
- No permitir SKU duplicado.
- Listar solo productos publicados.
- Filtrar productos por categoría, marca, región y stock.

### Carrito

Pruebas mínimas:

- Crear carrito activo para usuario.
- Agregar producto al carrito.
- Modificar cantidad.
- Eliminar producto.
- No permitir cantidad mayor al stock.
- No permitir agregar productos inactivos.
- No duplicar el mismo producto en el carrito.

### Checkout y pedidos

Pruebas mínimas:

- Crear orden desde carrito válido.
- No crear orden con carrito vacío.
- Validar dirección de envío.
- Congelar precio, nombre y SKU en `OrderItem`.
- Calcular subtotal, descuentos, envío y total.
- Impedir que un usuario vea pedidos ajenos.
- Cancelar pedido solo si el estado lo permite.

### Pagos simulados

Pruebas mínimas:

- Crear pago simulado.
- Validar que el monto coincida con el total de la orden.
- Aprobar pago simulado.
- Rechazar pago simulado.
- Impedir que un pago rechazado avance a preparación.
- No guardar datos reales de tarjetas.

### Envíos

Pruebas mínimas:

- Crear envío al generar orden.
- Actualizar estado de envío.
- Crear evento de seguimiento por cada cambio.
- Impedir que un cliente actualice el envío.
- Permitir que operador o admin actualice el estado.
- Impedir modificaciones no autorizadas sobre envíos entregados.

### Stock

Pruebas mínimas:

- Registrar movimiento inicial.
- Registrar movimiento por venta.
- Registrar reposición.
- Registrar ajuste manual con motivo.
- Impedir stock negativo.
- Validar que una venta descuente stock correctamente.

### Preguntas y reseñas

Pruebas para fase avanzada:

- Cliente puede preguntar sobre un producto.
- Vendedor dueño puede responder.
- Vendedor ajeno no puede responder.
- Cliente puede reseñar un producto comprado.
- Cliente no puede reseñar producto no comprado.
- La calificación debe estar entre 1 y 5.

### Promociones y cupones

Pruebas para fase avanzada:

- Validar cupón activo.
- Rechazar cupón vencido.
- Rechazar cupón inactivo.
- Respetar límite de uso.
- Recalcular descuento antes de confirmar orden.

### Reclamos

Pruebas para fase avanzada:

- Cliente puede reclamar sobre pedido propio.
- Cliente no puede reclamar pedidos ajenos.
- Admin puede cambiar estado del reclamo.
- Vendedor puede ver reclamos relacionados con sus ventas.

---

## 6. Casos críticos de negocio

Estos casos deben tener pruebas obligatorias:

```text
No comprar más stock del disponible.
No modificar precio desde frontend.
No acceder a pedidos de otro usuario.
No editar productos de otro vendedor.
No aprobar pagos con monto incorrecto.
No avanzar pedidos con pago rechazado.
No modificar envíos entregados sin permiso.
No guardar datos bancarios reales.
```

---

## 7. Ejemplo de pruebas de API

### Registro de usuario

```text
POST /api/v1/auth/register/

Resultado esperado:
- Código 201.
- Usuario creado.
- Rol inicial CUSTOMER.
```

### Crear producto como vendedor

```text
POST /api/v1/seller/products/

Resultado esperado:
- Código 201.
- Producto asociado al vendedor autenticado.
```

### Intentar crear producto como cliente

```text
POST /api/v1/seller/products/

Resultado esperado:
- Código 403.
- Mensaje de permisos insuficientes.
```

### Agregar producto al carrito

```text
POST /api/v1/cart/items/

Resultado esperado:
- Código 201.
- Producto agregado.
- Cantidad válida.
```

### Confirmar compra

```text
POST /api/v1/checkout/

Resultado esperado:
- Código 201.
- Orden creada.
- Ítems creados.
- Pago simulado registrado.
- Envío inicial creado.
```

---

## 8. Datos de prueba sugeridos

Para las pruebas se crearán datos ficticios:

```text
Usuario cliente
Usuario vendedor
Usuario operador logístico
Usuario administrador
Región Mendoza
Categoría Repuestos
Marca John Deere
Producto publicado con stock
Producto agotado
Producto inactivo
Carrito activo
Dirección de envío
Orden pendiente
Orden pagada
Envío en preparación
```

---

## 9. Cobertura mínima esperada

Para el MVP se buscará cubrir principalmente:

- Modelos críticos.
- Servicios de negocio.
- Endpoints principales.
- Permisos por rol.
- Flujo de compra.
- Validaciones de stock y precio.

Objetivo inicial recomendado:

```text
Cobertura mínima: 60% - 70%
```

Objetivo posterior:

```text
Cobertura avanzada: 80% o más
```

---

## 10. Testing manual del MVP

Antes de considerar estable el MVP, se realizará una prueba manual completa:

1. Registrar un usuario cliente.
2. Iniciar sesión.
3. Buscar productos.
4. Ver detalle de producto.
5. Agregar producto al carrito.
6. Modificar cantidad.
7. Confirmar checkout.
8. Simular pago.
9. Ver pedido creado.
10. Ver seguimiento del envío.
11. Ingresar como vendedor.
12. Crear producto.
13. Modificar stock.
14. Ingresar como admin.
15. Revisar usuarios, productos y pedidos.

---

## 11. Automatización futura

En fases posteriores se podrá configurar GitHub Actions para ejecutar automáticamente:

```text
Instalación de dependencias
Migraciones de testing
Pruebas del backend
Pruebas del frontend
Revisión de formato
Reporte de cobertura
```

Ejemplo de flujo:

```text
Push a main
        ↓
GitHub Actions
        ↓
Instala dependencias
        ↓
Ejecuta tests
        ↓
Muestra resultado
```

---

## 12. Criterio de aceptación del MVP

El MVP puede considerarse funcional cuando:

- El registro y login funcionan.
- Los roles principales están protegidos.
- Los productos pueden crearse y listarse.
- El carrito funciona.
- El checkout genera órdenes.
- El pago simulado funciona.
- El seguimiento inicial se crea.
- El stock se valida correctamente.
- Los usuarios no pueden acceder a datos ajenos.
- Las pruebas principales pasan.

---

## 13. Conclusión

El testing de AgroNexus permitirá validar que el sistema sea confiable, seguro y mantenible.

La prioridad inicial será probar los flujos críticos del MVP: usuarios, productos, carrito, checkout, pedidos, pagos simulados, stock, envíos y permisos. Luego se incorporarán pruebas para funcionalidades avanzadas como reseñas, preguntas, promociones, reclamos y reportes.
