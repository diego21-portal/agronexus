# Roles y Permisos — AgroNexus

## 1. Descripción general

Este documento define los roles principales de AgroNexus y las acciones permitidas para cada tipo de usuario.

El objetivo es establecer una base clara para implementar permisos en el backend con Django REST Framework y proteger correctamente las rutas privadas del sistema.

---

## 2. Roles principales

AgroNexus tendrá los siguientes roles:

| Rol | Descripción |
|---|---|
| Visitante | Usuario no autenticado que puede explorar la plataforma. |
| Cliente | Usuario registrado que puede comprar, preguntar, reseñar y gestionar su perfil. |
| Vendedor | Usuario autorizado para publicar productos, gestionar stock y responder consultas. |
| Operador logístico | Usuario encargado de actualizar estados de envío. |
| Administrador | Usuario con permisos para gestionar la plataforma completa. |
| Superadministrador | Usuario con control total del sistema y configuración avanzada. |

---

## 3. Permisos por rol

### Visitante

Puede realizar acciones públicas sin iniciar sesión:

- Ver la página principal.
- Buscar productos.
- Ver detalle de productos publicados.
- Ver categorías y marcas.
- Ver preguntas públicas.
- Ver reseñas públicas.
- Ver promociones públicas.

No puede:

- Comprar productos.
- Guardar favoritos.
- Preguntar al vendedor.
- Crear reseñas.
- Acceder al carrito.
- Acceder a paneles privados.

---

### Cliente

Puede operar como comprador dentro de la plataforma:

- Iniciar sesión.
- Editar su perfil.
- Gestionar sus direcciones.
- Buscar productos.
- Agregar productos al carrito.
- Confirmar compras.
- Elegir método de pago simulado.
- Ver sus pedidos.
- Ver el seguimiento de sus envíos.
- Guardar productos favoritos.
- Hacer preguntas al vendedor.
- Crear reseñas sobre productos comprados.
- Crear reclamos sobre sus propias órdenes.
- Configurar preferencias de región y tema visual.

No puede:

- Publicar productos.
- Editar productos ajenos.
- Acceder al panel de vendedor.
- Acceder al panel administrativo.
- Ver pedidos de otros usuarios.

---

### Vendedor

Puede operar como proveedor dentro de la plataforma:

- Acceder al portal de vendedor.
- Crear productos.
- Editar productos propios.
- Pausar o desactivar productos propios.
- Subir imágenes de productos.
- Subir fichas técnicas PDF.
- Gestionar stock de productos propios.
- Ver pedidos relacionados con sus productos.
- Responder preguntas de clientes.
- Consultar reseñas recibidas.
- Crear promociones propias si el sistema lo permite.
- Ver reportes de ventas propias.

No puede:

- Editar productos de otros vendedores.
- Ver ventas de otros vendedores.
- Modificar usuarios.
- Resolver reclamos globales.
- Acceder a reportes administrativos generales.

---

### Operador logístico

Puede gestionar información relacionada con envíos:

- Ver envíos asignados o autorizados.
- Actualizar estados de envío.
- Registrar eventos de seguimiento.
- Marcar problemas de entrega.
- Consultar datos necesarios para la entrega.

No puede:

- Modificar productos.
- Cambiar precios.
- Crear pedidos.
- Modificar pagos.
- Acceder a reportes comerciales.
- Gestionar usuarios.

---

### Administrador

Puede gestionar la plataforma completa a nivel operativo:

- Gestionar usuarios.
- Activar o desactivar usuarios.
- Verificar vendedores.
- Gestionar productos.
- Moderar preguntas y reseñas.
- Gestionar categorías y marcas.
- Revisar pedidos.
- Revisar pagos simulados.
- Supervisar envíos.
- Gestionar reclamos.
- Consultar reportes generales.
- Configurar regiones y promociones.
- Desactivar productos o vendedores si corresponde.

No debería:

- Compartir credenciales.
- Usar cuentas administrativas para operaciones normales de cliente.
- Modificar datos críticos sin justificación.

---

### Superadministrador

Tiene control total del sistema.

Puede:

- Crear administradores.
- Gestionar configuraciones críticas.
- Acceder al panel completo.
- Ejecutar tareas de mantenimiento.
- Modificar permisos avanzados.

Este rol debe usarse con cuidado y solo para administración técnica o control principal de la plataforma.

---

## 4. Matriz resumida de permisos

| Acción | Visitante | Cliente | Vendedor | Operador | Admin |
|---|---|---|---|---|---|
| Ver productos publicados | Sí | Sí | Sí | Sí | Sí |
| Buscar productos | Sí | Sí | Sí | Sí | Sí |
| Ver detalle de producto | Sí | Sí | Sí | Sí | Sí |
| Agregar al carrito | No | Sí | No | No | Sí |
| Confirmar compra | No | Sí | No | No | Sí |
| Ver pedidos propios | No | Sí | Sí, solo ventas propias | No | Sí |
| Publicar productos | No | No | Sí | No | Sí |
| Editar productos propios | No | No | Sí | No | Sí |
| Gestionar stock propio | No | No | Sí | No | Sí |
| Responder preguntas | No | No | Sí | No | Sí |
| Crear reseñas | No | Sí | No | No | Sí |
| Actualizar estados de envío | No | No | Parcial | Sí | Sí |
| Gestionar usuarios | No | No | No | No | Sí |
| Ver reportes generales | No | No | No | No | Sí |
| Ver reportes propios | No | No | Sí | No | Sí |
| Resolver reclamos | No | No | Parcial | No | Sí |

---

## 5. Reglas generales de autorización

- Los permisos deben validarse siempre en el backend.
- El frontend puede ocultar opciones, pero no reemplaza la seguridad real.
- Cada usuario solo debe acceder a sus propios datos.
- Los vendedores solo pueden modificar productos propios.
- Los clientes solo pueden ver pedidos propios.
- Los operadores solo pueden actualizar información logística autorizada.
- Los administradores pueden acceder a datos globales necesarios para operar la plataforma.
- Las acciones críticas deben quedar registradas.

---

## 6. Permisos mínimos para el MVP

Para la primera versión del proyecto, se priorizarán estos permisos:

```text
Visitante:
- Ver productos
- Buscar productos
- Ver detalle

Cliente:
- Registrarse
- Iniciar sesión
- Editar perfil
- Gestionar direcciones
- Usar carrito
- Confirmar compra
- Ver pedidos propios
- Ver seguimiento

Vendedor:
- Crear productos
- Editar productos propios
- Gestionar stock propio
- Ver pedidos relacionados con sus productos

Admin:
- Gestionar usuarios
- Gestionar productos
- Gestionar pedidos
- Ver dashboard básico
```

---

## 7. Conclusión

La definición de roles y permisos permite proteger los recursos del sistema y mantener una separación clara entre clientes, vendedores, operadores y administradores.

Este documento servirá como guía para implementar permisos personalizados en Django REST Framework y para definir rutas protegidas en el frontend.
