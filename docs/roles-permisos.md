# Roles y permisos de AgroNexus

La autorización se comprueba en Django. React controla qué portales y opciones se muestran, pero una ruta oculta no sustituye los permisos de la API. Este documento describe el alcance implementado del MVP; [endpoints](endpoints.md) contiene las rutas existentes.

## Roles y alcance

| Rol o situación | Acceso implementado |
|---|---|
| Visitante | Catálogo publicado, filtros, detalle y actividad social pública |
| Usuario autenticado | Su cuenta, direcciones, carrito, compras y posventa propias, favoritos, preguntas, notificaciones y reseñas elegibles |
| `SELLER` con perfil comercial activo | Portal vendedor y operaciones de sus productos, archivos, inventario, ventas, preguntas y posventa |
| `ADMIN` | Portal administrativo, métricas y recursos globales de las rutas administrativas |
| `SUPER_ADMIN` | Administración de plataforma y operaciones de roles protegidos que requieren superadministrador |
| `LOGISTICS_OPERATOR` | Rol definido en el modelo; el MVP no incluye un portal operativo propio ni un flujo de asignación de envíos para este rol |

Las rutas de compra exigen autenticación y propiedad de los recursos; no conceden acceso a compras ajenas por tener un rol administrativo. La administración consulta recursos globales mediante sus rutas específicas. El estado de la cuenta y el estado comercial del vendedor son controles distintos.

## Alta comercial de vendedores

Desde Usuarios en el portal administrativo, asignar `SELLER` a una cuenta sin perfil requiere completar el alta comercial. La API recibe `role: "SELLER"` y `seller_profile` en el mismo `PATCH /api/v1/admin/users/{id}/` y realiza ambos cambios dentro de una transacción. Un fallo no debe dejar un rol vendedor utilizable sin los datos comerciales requeridos.

- Un perfil nuevo o sin nombre requiere `business_name` de 2 a 160 caracteres. La identificación fiscal y descripción son opcionales.
- Un perfil comercial activo y completo permite promover con solo `role`.
- Un perfil inactivo requiere `seller_profile.is_active: true` explícito para reactivarlo. La UI solicita confirmación.
- El alta puede completar una cuenta antigua que ya tenga `SELLER` y carezca de perfil comercial válido.
- Dar de alta o reactivar el perfil comercial no activa una cuenta de usuario bloqueada. Esta debe activarse por su operación administrativa propia.
- `is_verified` no pertenece al alta: verificar al vendedor es una operación separada y no reemplaza estos controles.

La respuesta administrativa del usuario incluye el resumen `seller_profile` o `null`, de modo que la UI conoce si necesita solicitar datos. El nombre comercial no se inventa a partir del correo o del usuario. El detalle de los campos está en [alta comercial](endpoints.md#alta-comercial-de-vendedor).

Estas garantías se aplican al servicio de alta de la API y su formulario. No son una restricción global que cree perfiles automáticamente para cualquier escritura ORM o cambio técnico realizado desde Django Admin.

## Productos y archivos

El portal vendedor exige `role=SELLER` y un perfil comercial activo. El servidor comprueba además que cada producto, imagen y operación pertenezca a ese vendedor. Las escrituras de medios vuelven a comprobar el acceso al persistir el cambio.

El vendedor puede crear y editar sus productos, ajustar inventario mediante las operaciones autorizadas, elegir una imagen principal, ordenar o borrar sus imágenes y subir, reemplazar o retirar su ficha PDF. Los archivos se cargan por rutas dedicadas con validación de bytes y límites; el JSON general del producto no sirve para sustituir archivos o trasladar imágenes entre productos.

Las imágenes y fichas del catálogo son públicas. Para publicar y vender se requiere un perfil comercial activo y una cuenta activa con rol `SELLER`. Si administración cambia el rol, los productos del perfil dejan de aparecer en el catálogo y las nuevas compras se rechazan, incluso con una cotización anterior. El perfil comercial y las operaciones históricas se conservan. Los límites, tipos de archivo y respuestas están en [imágenes y ficha PDF](endpoints.md#imágenes-y-ficha-pdf).

## Administración y superadministración

El identificador canónico es `SUPER_ADMIN`. Un superusuario Django informa ese rol efectivo para la autorización administrativa aunque su campo `role` conserve otro valor. Una cuenta inactiva no obtiene acceso administrativo y `is_staff` por sí solo no concede permisos de la plataforma.

La API y el portal React permiten listar usuarios, vendedores, productos, pedidos, pagos y envíos. Las escrituras generales se limitan a `role` e `is_active` del usuario, los datos de alta comercial junto al rol vendedor, `is_verified` del vendedor e `is_active` del producto. Los campos Django `is_staff` e `is_superuser`, contraseñas y datos de identidad no se editan desde estos formularios.

Un administrador ordinario no puede crear ni modificar superadministradores. El servicio reautoriza al actor dentro de la transacción, mantiene un orden estable de bloqueos y protege al último administrador activo y al último superadministrador activo cuando ya existe. No permite desactivar la propia cuenta desde el panel. Un superusuario Django conserva la protección de sus privilegios.

Pedidos, pagos y envíos son de consulta en estos listados. Sus cambios se realizan mediante las operaciones de negocio autorizadas de envío y posventa. Las direcciones e importes históricos de una compra no se sobrescriben desde los formularios generales ni desde Django Admin. Un superadministrador no obtiene automáticamente un perfil comercial o acceso a las rutas de vendedor por su rol de plataforma.

La gestión técnica de Django Admin es distinta de las operaciones del portal React. La definición de un rol no implica que exista una pantalla o endpoint para todas las funciones previstas en planes antiguos, como promociones o asignaciones logísticas.

## Privacidad de compra y posventa

| Destinatario | Información de reclamos y devoluciones |
|---|---|
| Comprador | Sus propios registros y la resolución comunicada, sin notas internas ni correo del administrador |
| Vendedor | Registros de sus productos y de las órdenes en las que participa, sin notas internas ni correo del administrador |
| Administrador | Registros globales, incluidas notas internas y datos de resolución administrativa |

En una compra con varios vendedores, un reclamo asociado a un ítem solo aparece para el vendedor de ese ítem. Los reclamos generales, sin un ítem específico, aparecen para los vendedores participantes. La recepción o inspección de una parte no modifica la entrega ni el stock de otra. Las cantidades defectuosas no regresan al stock vendible por solicitar una cancelación o devolución.

## Datos privados en React

Los paneles descartan datos y respuestas tardías al cambiar de cuenta o rol. Los dashboards muestran las métricas que devuelve Django; una respuesta incompatible produce un error con reintento, no un resumen ficticio en cero. Los detalles administrativos también separan el estado por pedido, para no mostrar la respuesta de una ruta anterior.

Cambiar el rol propio mediante una operación permitida actualiza la sesión de la UI. La autorización del servidor sigue dependiendo del estado actual de la cuenta, incluso si el navegador conserva una pantalla anterior.

## Verificación

Las pruebas de permisos, alta comercial, medios y posventa comprueban estas reglas mediante API, componentes y navegador. Consulta [testing](testing.md) para las suites y [cierre de v1.0](cierre-v1.md) para el recorrido de aceptación. La migración `users.0003_normalize_super_admin_role` conserva la compatibilidad de los datos antiguos con `SUPER_ADMIN`; las migraciones deben aplicarse al actualizar.
