# Seguridad — AgroNexus

## 1. Descripción general

Este documento define las principales medidas de seguridad previstas para AgroNexus.

AgroNexus es una plataforma web tipo marketplace donde existen usuarios, vendedores, administradores, productos, pedidos, pagos simulados, envíos, preguntas, reseñas y reportes. Por eso, la seguridad debe proteger tanto los datos de los usuarios como las operaciones críticas del sistema.

El objetivo es aplicar buenas prácticas desde el inicio del proyecto para evitar accesos no autorizados, exposición de datos sensibles, errores de permisos y configuraciones inseguras en producción.

---

## 2. Principios generales de seguridad

El sistema seguirá estos principios:

- Autenticación segura.
- Control de permisos por rol.
- Validación de datos en backend y frontend.
- Protección de información sensible.
- Uso de variables de entorno.
- Separación entre configuración local y producción.
- Manejo seguro de archivos.
- Registro de acciones importantes.
- Uso de HTTPS en producción.
- No almacenar datos bancarios reales.
- No confiar solo en validaciones del frontend.

---

## 3. Autenticación

La autenticación permite verificar la identidad del usuario.

En AgroNexus, los usuarios podrán iniciar sesión para acceder a funcionalidades privadas como carrito, pedidos, perfil, favoritos, portal de vendedor, panel logístico y administración.

### Funciones protegidas por autenticación

- Ver perfil personal.
- Editar datos personales.
- Agregar productos al carrito.
- Confirmar compras.
- Ver pedidos.
- Crear preguntas.
- Crear reseñas.
- Publicar productos como vendedor.
- Actualizar estados de envío.
- Acceder al panel administrativo.

### Reglas principales

- Las contraseñas nunca deben guardarse en texto plano.
- Las contraseñas deben almacenarse usando el sistema de hash seguro de Django.
- El login debe devolver errores genéricos para evitar revelar si un email existe o no.
- Los usuarios inactivos no deben poder iniciar sesión.
- Los endpoints privados deben requerir usuario autenticado.
- Los tokens o sesiones deben configurarse de forma segura.

---

## 4. Autorización y roles

La autorización define qué puede hacer cada usuario según su rol.

| Rol | Permisos generales |
|---|---|
| Visitante | Puede ver productos, buscar y consultar detalles públicos. |
| Cliente | Puede comprar, preguntar, reseñar, guardar favoritos y ver sus pedidos. |
| Vendedor | Puede publicar productos, gestionar stock, responder preguntas y ver ventas propias. |
| Operador logístico | Puede actualizar estados de envío. |
| Administrador | Puede gestionar usuarios, productos, pedidos, pagos, reclamos y reportes. |
| Superadministrador | Tiene control total del sistema. |

### Reglas principales

- Un cliente no puede acceder al panel de vendedor.
- Un vendedor solo puede modificar sus propios productos.
- Un cliente solo puede ver sus propios pedidos.
- Un operador logístico solo puede actualizar estados de envío.
- Solo administradores pueden acceder a reportes generales.
- Solo administradores pueden activar, suspender o verificar vendedores.
- Todo endpoint sensible debe validar permisos desde el backend.

---

## 5. Protección de endpoints

Cada endpoint debe tener permisos definidos.

| Endpoint | Acceso |
|---|---|
| `GET /api/v1/products/` | Público |
| `POST /api/v1/seller/products/` | Vendedor |
| `PATCH /api/v1/seller/products/{id}/` | Vendedor dueño |
| `GET /api/v1/cart/` | Cliente |
| `POST /api/v1/checkout/` | Cliente |
| `PATCH /api/v1/shipments/{id}/status/` | Vendedor/Operador/Admin |
| `GET /api/v1/admin/dashboard/` | Admin |

### Reglas principales

- Todo endpoint privado debe validar autenticación.
- Todo endpoint sensible debe validar permisos.
- Las operaciones sobre recursos propios deben comprobar propiedad.
- Las acciones administrativas deben estar restringidas a administradores.
- Ocultar botones en el frontend no reemplaza permisos en backend.

---

## 6. Protección de datos sensibles

AgroNexus manejará datos personales, direcciones, pedidos y pagos simulados.

### Datos sensibles del usuario

- Email.
- Teléfono.
- Dirección.
- Documento, si se implementa.
- Historial de compras.
- Preferencias.
- Métodos de pago simulados.

### Reglas principales

- No exponer contraseñas en respuestas de la API.
- No exponer datos internos innecesarios.
- No devolver información de otros usuarios.
- No almacenar datos reales de tarjetas.
- No almacenar códigos de seguridad.
- No publicar secretos en GitHub.
- Usar `.env` para claves y configuraciones sensibles.
- Usar serializers separados para respuestas públicas y privadas.

---

## 7. Seguridad en productos y stock

Los productos y el stock son partes críticas del sistema.

### Reglas principales

- Solo vendedores activos pueden publicar productos.
- El vendedor solo puede editar productos propios.
- El stock no puede ser negativo.
- Todo cambio manual de stock debe registrar motivo.
- Toda venta debe generar un movimiento de stock.
- Los productos inactivos no aparecen públicamente.
- El SKU debe ser único.
- El precio y descuento deben validarse en backend.

### Validaciones importantes

```text
price >= 0
stock >= 0
discount_price < price
sku único
```

---

## 8. Seguridad en carrito, checkout y pedidos

El flujo de compra debe validar datos antes de generar una orden.

### Reglas principales

- El carrito no puede estar vacío.
- No se pueden comprar productos inactivos.
- No se puede comprar más cantidad que el stock disponible.
- El stock debe validarse nuevamente en checkout.
- El total debe calcularse en backend.
- El frontend no debe decidir el precio final.
- La orden debe congelar precio, nombre y SKU del producto.
- Una orden entregada no debe modificarse libremente.
- Una orden cancelada no debe avanzar a preparación.

### Riesgos evitados

- Manipulación de precios desde el navegador.
- Compra de productos sin stock.
- Modificación indebida de pedidos.
- Acceso a pedidos de otros usuarios.

---

## 9. Pagos simulados

En la primera versión, AgroNexus usará pagos simulados.

Esto permite representar el flujo de compra sin integrar una pasarela real de pago.

### Reglas de seguridad

- No se guardarán números completos de tarjeta.
- No se guardarán códigos CVV.
- No se procesarán pagos reales.
- Los códigos de transacción serán simulados.
- El pago debe coincidir con el total de la orden.
- Una orden con pago rechazado no debe avanzar a preparación.
- Los cambios manuales de estado de pago deben estar restringidos a administradores.

### Datos permitidos para simulación

```text
Tipo de método de pago
Alias del método
Últimos cuatro dígitos ficticios
Estado del pago
Código de transacción simulado
Fecha del pago
```

---

## 10. Seguridad en envíos y seguimiento

El seguimiento del pedido debe estar protegido por permisos.

### Reglas principales

- El cliente solo puede ver el seguimiento de sus pedidos.
- El vendedor puede ver envíos relacionados con sus ventas.
- El operador logístico puede actualizar estados de envío.
- El administrador puede supervisar todos los envíos.
- Cada cambio de estado debe generar un evento.
- Un envío entregado no debería modificarse sin autorización administrativa.

---

## 11. Seguridad en archivos

AgroNexus manejará imágenes de productos, avatares y fichas técnicas PDF.

### Reglas principales

- Validar tipo de archivo permitido.
- Validar tamaño máximo de archivo.
- No permitir archivos ejecutables.
- Usar nombres de archivo seguros.
- Separar archivos públicos y privados.
- Las fichas técnicas pueden ser públicas si pertenecen a productos publicados.
- Comprobantes o documentos sensibles no deben exponerse públicamente.

### Tipos permitidos iniciales

```text
Imágenes: jpg, jpeg, png, webp
Documentos: pdf
```

---

## 12. Seguridad del frontend

El frontend debe ayudar a prevenir errores, pero la seguridad real se aplica en backend.

### Reglas principales

- No guardar secretos en el frontend.
- No guardar claves privadas en React.
- Validar formularios antes de enviar datos.
- No mostrar rutas privadas a usuarios sin permisos.
- Manejar errores sin exponer información interna.
- No confiar en datos modificables desde el navegador.
- Guardar preferencias visuales sin comprometer datos sensibles.

---

## 13. Variables de entorno

Los valores sensibles deben manejarse mediante variables de entorno.

### Ejemplos

```env
SECRET_KEY=
DEBUG=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_HOST=
DATABASE_PORT=
ALLOWED_HOSTS=
CORS_ALLOWED_ORIGINS=
CSRF_TRUSTED_ORIGINS=
```

### Reglas principales

- No subir archivos `.env` reales al repositorio.
- Usar `.env.example` como plantilla.
- Cambiar claves entre desarrollo y producción.
- No exponer credenciales en README, frontend o commits.

---

## 14. Configuración de producción

Antes del despliegue real, se debe revisar la configuración de producción.

### Checklist mínima

```text
DEBUG=False
SECRET_KEY segura
ALLOWED_HOSTS configurado
Base de datos protegida
HTTPS activo
Variables de entorno configuradas
Permisos revisados
Endpoints privados protegidos
Archivos sensibles no públicos
Logs sin datos sensibles
```

### Configuraciones recomendadas con HTTPS

```python
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
```

Estas opciones deben activarse solo cuando el dominio y HTTPS estén funcionando correctamente.

---

## 15. Seguridad del panel administrativo

El panel administrativo permite controlar partes críticas de la plataforma.

### Reglas principales

- Solo administradores pueden acceder.
- Las acciones críticas deben registrarse.
- El administrador puede moderar productos, preguntas, reseñas y reclamos.
- El administrador puede desactivar usuarios o vendedores.
- No se deben usar credenciales débiles.
- Se recomienda usar cuentas administrativas separadas de cuentas normales.

### Acciones críticas

- Desactivar usuarios.
- Verificar vendedores.
- Modificar pagos.
- Modificar pedidos.
- Desactivar productos.
- Resolver reclamos.
- Cambiar estados de envío.

---

## 16. Logs y auditoría

El sistema debe registrar eventos importantes para trazabilidad.

### Eventos recomendados

- Login exitoso o fallido.
- Creación de pedido.
- Cambio de estado de pago.
- Cambio de estado de envío.
- Movimiento de stock.
- Creación o edición de producto.
- Reclamos abiertos o resueltos.
- Acciones administrativas críticas.

### Reglas principales

- Los logs no deben guardar contraseñas.
- Los logs no deben guardar tokens.
- Los logs no deben guardar datos bancarios.
- Los eventos críticos deben incluir usuario, fecha y acción realizada.

---

## 17. Seguridad mínima para el MVP

Para la primera versión funcional, se priorizará:

```text
Registro e inicio de sesión seguro
Roles y permisos básicos
Protección de endpoints privados
Validación de stock en backend
Validación de precios en backend
Carrito protegido por usuario
Pedidos visibles solo por propietario
Pagos simulados sin datos reales
Panel de vendedor limitado a productos propios
Panel admin protegido
Variables de entorno
DEBUG=False en producción
```

---

## 18. Riesgos principales a evitar

| Riesgo | Medida preventiva |
|---|---|
| Usuario accede a datos de otro usuario | Validar propietario del recurso |
| Vendedor modifica producto ajeno | Permisos por objeto |
| Cliente manipula precio desde frontend | Calcular total en backend |
| Compra supera stock disponible | Validar stock en carrito y checkout |
| Exposición de datos sensibles | Serializers separados y respuestas controladas |
| Archivos peligrosos | Validar extensión, tipo y tamaño |
| Panel admin expuesto | Autenticación fuerte y permisos |
| Secretos en GitHub | Usar `.env` y `.env.example` |

---

## 19. Conclusión

La seguridad de AgroNexus se basará en autenticación, autorización por roles, validaciones en backend, control de acceso por objeto, protección de datos personales, manejo seguro de archivos y configuración correcta para producción.

Este documento servirá como guía para implementar permisos, serializers, endpoints protegidos, validaciones, logs y despliegue seguro del sistema.
