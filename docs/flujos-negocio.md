# Flujos de Negocio — AgroNexus

## 1. Descripción general

Este documento describe los principales flujos de negocio de AgroNexus, una plataforma web tipo marketplace orientada al sector agrícola y agroindustrial.

Los flujos explican cómo interactúan los usuarios con el sistema, cómo se procesan las compras, cómo se gestionan los productos, cómo se controlan los pagos simulados, cómo se realiza el seguimiento de pedidos y cómo participan clientes, vendedores, operadores logísticos y administradores.

El objetivo de este documento es servir como guía funcional para el desarrollo del backend, frontend, endpoints, permisos y validaciones del sistema.

---

## 2. Actores principales

| Actor | Descripción |
|---|---|
| Visitante | Usuario no autenticado que puede explorar productos. |
| Cliente | Usuario registrado que puede comprar, preguntar, reseñar y guardar favoritos. |
| Vendedor | Usuario autorizado para publicar productos y gestionar ventas. |
| Operador logístico | Usuario encargado de actualizar estados de envío. |
| Administrador | Usuario con permisos para gestionar la plataforma completa. |

---

## 3. Flujo de registro de usuario

### Objetivo

Permitir que una persona cree una cuenta en la plataforma para comprar productos, guardar favoritos, hacer preguntas y gestionar pedidos.

### Actor principal

Cliente.

### Pasos

1. El usuario ingresa a la página de registro.
2. Completa sus datos básicos: nombre, email y contraseña.
3. El sistema valida que el email no exista previamente.
4. El sistema crea la cuenta del usuario.
5. Se genera un perfil asociado al usuario.
6. El usuario puede iniciar sesión y acceder a su panel personal.

### Reglas de negocio

- El email debe ser único.
- La contraseña debe cumplir requisitos mínimos de seguridad.
- Todo usuario nuevo se registra inicialmente como cliente.
- El usuario puede completar sus direcciones y preferencias después del registro.

### Resultado final

El usuario queda registrado como cliente y puede operar dentro de la plataforma.

---

## 4. Flujo de inicio de sesión

### Objetivo

Permitir que un usuario registrado acceda a su cuenta y a las funcionalidades según su rol.

### Actor principal

Cliente, vendedor, operador logístico o administrador.

### Pasos

1. El usuario ingresa email y contraseña.
2. El sistema valida las credenciales.
3. Si los datos son correctos, el sistema permite el acceso.
4. El usuario es redirigido a su panel correspondiente.
5. El sistema aplica permisos según el rol del usuario.

### Reglas de negocio

- Un usuario inactivo no puede iniciar sesión.
- Las credenciales inválidas deben mostrar un error genérico.
- El rol determina qué secciones puede ver y usar el usuario.

### Resultado final

El usuario accede a la plataforma con los permisos correspondientes a su rol.

---

## 5. Flujo de búsqueda de productos

### Objetivo

Permitir que visitantes y clientes encuentren productos agrícolas, repuestos, maquinaria o insumos técnicos de forma rápida y precisa.

### Actor principal

Visitante o cliente.

### Pasos

1. El usuario ingresa una palabra clave en el buscador.
2. El sistema consulta productos activos y publicados.
3. El usuario puede aplicar filtros por categoría, marca, región, precio, stock y calificación.
4. El sistema muestra resultados paginados.
5. El usuario puede ordenar los resultados por precio, relevancia, fecha o calificación.
6. El usuario selecciona un producto para ver más detalles.

### Reglas de negocio

- Solo deben mostrarse productos activos y publicados.
- Los productos agotados pueden mostrarse, pero indicando su disponibilidad.
- La región seleccionada puede modificar la prioridad de los resultados.
- Los filtros deben poder combinarse.

### Resultado final

El usuario obtiene una lista de productos relevantes según su búsqueda y filtros.

---

## 6. Flujo de detalle de producto

### Objetivo

Mostrar toda la información necesaria para que el usuario pueda evaluar un producto antes de comprarlo.

### Actor principal

Visitante o cliente.

### Pasos

1. El usuario ingresa a la página de detalle del producto.
2. El sistema muestra imágenes, precio, stock, descripción y vendedor.
3. El sistema muestra información técnica, ficha PDF, garantía y envío.
4. El usuario puede revisar preguntas y respuestas existentes.
5. El usuario puede ver reseñas y calificaciones.
6. El sistema muestra productos relacionados.
7. El usuario puede agregar el producto al carrito o guardarlo como favorito.

### Reglas de negocio

- Si el producto está agotado, no debe permitir compra directa.
- Si el producto está inactivo, no debe mostrarse públicamente.
- Solo usuarios autenticados pueden preguntar, reseñar o guardar favoritos.
- La ficha técnica debe estar disponible solo si fue cargada por el vendedor.

### Resultado final

El usuario comprende las características del producto y puede decidir si comprarlo.

---

## 7. Flujo de carrito

### Objetivo

Permitir que el cliente seleccione productos antes de confirmar una compra.

### Actor principal

Cliente.

### Pasos

1. El cliente agrega un producto al carrito.
2. El sistema valida que el producto esté activo y tenga stock.
3. El cliente puede modificar cantidades o eliminar productos.
4. El sistema recalcula subtotal, descuentos y costos estimados.
5. El cliente continúa al checkout.

### Reglas de negocio

- No se puede agregar un producto inactivo.
- No se puede superar el stock disponible.
- La cantidad debe ser mayor que cero.
- El carrito debe recalcular precios antes de confirmar la compra.
- Un usuario debe tener un solo carrito activo.

### Resultado final

El cliente tiene un carrito válido y preparado para iniciar la compra.

---

## 8. Flujo de compra

### Objetivo

Procesar una orden de compra a partir de los productos seleccionados en el carrito.

### Actor principal

Cliente.

### Pasos

1. El cliente ingresa al checkout.
2. Selecciona o carga una dirección de envío.
3. Selecciona un método de pago simulado.
4. El sistema valida stock, precios, dirección y datos del pedido.
5. El sistema calcula subtotal, descuentos, envío y total.
6. El cliente confirma la compra.
7. El sistema genera una orden.
8. El sistema crea los ítems de la orden.
9. El sistema registra el pago simulado.
10. El sistema inicia el seguimiento del envío.

### Reglas de negocio

- El carrito no puede estar vacío.
- La orden debe tener al menos un producto.
- El stock debe validarse nuevamente antes de confirmar.
- El precio del producto debe quedar congelado en la orden.
- Si el pago es aprobado, la orden puede avanzar.
- Si el pago es rechazado, la orden queda pendiente o cancelada.

### Resultado final

Se genera una orden de compra con pago simulado y seguimiento inicial.

---

## 9. Flujo de pago simulado

### Objetivo

Representar el proceso de pago sin integrar una pasarela real en la primera versión del proyecto.

### Actor principal

Cliente.

### Pasos

1. El cliente selecciona un método de pago.
2. El sistema recibe la solicitud de pago.
3. El sistema genera un resultado simulado.
4. El pago puede quedar aprobado, pendiente o rechazado.
5. El sistema actualiza el estado de la orden según el resultado.
6. Si el pago es aprobado, el pedido puede pasar a preparación.

### Reglas de negocio

- No se almacenan datos bancarios reales.
- El monto del pago debe coincidir con el total de la orden.
- Un pago rechazado no debe permitir avanzar el pedido.
- Un pago aprobado debe quedar registrado con código de transacción simulado.

### Resultado final

El sistema registra un pago simulado y actualiza el estado de la orden.

---

## 10. Flujo de seguimiento de pedido

### Objetivo

Permitir que el cliente conozca el estado de su compra desde la confirmación hasta la entrega.

### Actor principal

Cliente, vendedor y operador logístico.

### Pasos

1. El sistema crea un envío asociado a la orden.
2. El pedido inicia en estado de preparación.
3. El vendedor o el operador logístico actualiza el estado del envío.
4. Cada cambio genera un evento de seguimiento.
5. El cliente puede ver el historial del envío.
6. Cuando el producto llega, el pedido se marca como entregado.
7. El cliente puede confirmar recepción o iniciar un reclamo.

### Estados posibles

```text
Compra realizada
Pago confirmado
Pedido en preparación
Producto despachado
En camino
En centro de distribución
En reparto
Entregado
Problema con la entrega
Cancelado
```

### Reglas de negocio

- Cada cambio de estado debe generar un evento.
- Solo roles autorizados pueden actualizar el envío.
- El cliente solo puede consultar el seguimiento.
- Una orden entregada no debe modificarse libremente.
- Si existe un problema, el pedido puede pasar a estado de reclamo.

### Resultado final

El cliente puede seguir el estado completo de su pedido.

---

## 11. Flujo de publicación de producto

### Objetivo

Permitir que un vendedor publique maquinaria, repuestos, insumos o productos técnicos.

### Actor principal

Vendedor.

### Pasos

1. El vendedor ingresa a su panel.
2. Selecciona la opción de crear producto.
3. Completa nombre, categoría, marca, precio, stock y región.
4. Carga imágenes del producto.
5. Opcionalmente carga ficha técnica en PDF.
6. Agrega descripción general y detalles técnicos.
7. Define disponibilidad, garantía y opciones de envío.
8. El sistema valida los datos.
9. El producto queda guardado como borrador o publicado.

### Reglas de negocio

- Solo vendedores activos pueden publicar productos.
- El producto debe tener precio válido.
- El stock no puede ser negativo.
- El SKU debe ser único.
- Un producto publicado y activo puede aparecer en el catálogo.
- Un producto en borrador no aparece públicamente.

### Resultado final

El vendedor publica o guarda un producto dentro de la plataforma.

---

## 12. Flujo de preguntas al vendedor

### Objetivo

Permitir que los clientes consulten dudas sobre un producto antes de comprar.

### Actor principal

Cliente y vendedor.

### Pasos

1. El cliente ingresa al detalle del producto.
2. Escribe una pregunta.
3. El sistema registra la pregunta asociada al producto.
4. El vendedor recibe la consulta.
5. El vendedor responde desde su panel.
6. La respuesta queda visible en la página del producto.

### Reglas de negocio

- Solo usuarios autenticados pueden preguntar.
- Solo el vendedor dueño del producto puede responder.
- Un administrador puede moderar preguntas.
- Las preguntas públicas ayudan a otros compradores.

### Resultado final

El producto muestra preguntas y respuestas útiles para los usuarios.

---

## 13. Flujo de reseña de producto

### Objetivo

Permitir que los clientes califiquen productos comprados.

### Actor principal

Cliente.

### Pasos

1. El cliente recibe el producto.
2. El pedido queda marcado como entregado.
3. El sistema habilita la opción de reseñar.
4. El cliente califica el producto de 1 a 5 estrellas.
5. Puede agregar un comentario.
6. El sistema registra la reseña.
7. El promedio del producto se actualiza.

### Reglas de negocio

- Solo quien compró el producto puede reseñarlo.
- La calificación debe estar entre 1 y 5.
- Un cliente no debería reseñar dos veces el mismo ítem comprado.
- Las reseñas pueden afectar la reputación del producto y del vendedor.

### Resultado final

El producto obtiene una calificación visible para futuros compradores.

---

## 14. Flujo de reclamo

### Objetivo

Permitir que el cliente reporte problemas relacionados con una compra o entrega.

### Actor principal

Cliente y administrador.

### Pasos

1. El cliente ingresa al detalle de su pedido.
2. Selecciona la opción de iniciar reclamo.
3. Describe el problema.
4. El sistema registra el reclamo.
5. El administrador revisa el caso.
6. El vendedor puede ser notificado si corresponde.
7. El reclamo se resuelve, rechaza o cierra.

### Reglas de negocio

- El reclamo debe estar asociado a una orden.
- Solo el comprador puede iniciar reclamos sobre sus pedidos.
- El administrador puede cambiar el estado del reclamo.
- Los reclamos pueden afectar la reputación del vendedor.

### Resultado final

El sistema registra y gestiona un problema relacionado con una compra.

---

## 15. Flujo administrativo

### Objetivo

Permitir que el administrador controle la plataforma completa.

### Actor principal

Administrador.

### Acciones principales

- Gestionar usuarios.
- Gestionar vendedores.
- Revisar productos publicados.
- Administrar categorías y marcas.
- Supervisar pedidos.
- Revisar pagos simulados.
- Controlar envíos.
- Moderar preguntas y reseñas.
- Gestionar reclamos.
- Consultar reportes comerciales.

### Reglas de negocio

- Solo administradores pueden acceder al panel general.
- Las acciones críticas deben quedar registradas.
- El administrador puede activar, pausar o bloquear elementos del sistema.
- El panel debe mostrar métricas relevantes del negocio.

### Resultado final

El administrador puede mantener el control operativo de AgroNexus.

---

## 16. Resumen general del ciclo de compra

```text
Usuario busca producto
        ↓
Revisa detalle técnico
        ↓
Agrega al carrito
        ↓
Confirma dirección y pago
        ↓
Sistema valida stock
        ↓
Se genera la orden
        ↓
Se registra pago simulado
        ↓
Se inicia el envío
        ↓
Cliente sigue el pedido
        ↓
Producto entregado
        ↓
Cliente puede reseñar o reclamar
```

---

## 17. Conclusión

Los flujos de negocio de AgroNexus permiten entender cómo interactúan los usuarios con la plataforma y cómo se conectan los módulos principales del sistema.

Este documento servirá como base para diseñar endpoints, permisos, validaciones, pantallas del frontend, pruebas automatizadas y lógica de negocio del backend.
