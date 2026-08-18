# AgroNexus

**AgroNexus** es un backend profesional para un marketplace agroindustrial orientado a la compra, venta y gestión de maquinaria, repuestos, insumos técnicos y productos especializados para el sector agrícola.

El proyecto está desarrollado con **Django REST Framework**, **PostgreSQL**, **Docker**, **JWT**, **Swagger/OpenAPI**, tests automatizados y GitHub Actions.

---

## Objetivo del proyecto

El objetivo de AgroNexus es construir una plataforma digital especializada para productores, vendedores, proveedores y administradores del sector agroindustrial.

La aplicación permite gestionar productos técnicos, stock, ventas, pedidos, pagos simulados, envíos, reseñas, preguntas al vendedor, reclamos, devoluciones, notificaciones internas y dashboards de control.

Este proyecto fue desarrollado como aplicación backend profesional para portfolio.

---

## Funcionalidades implementadas

### Autenticación y usuarios

* Registro de usuarios.
* Login con JWT.
* Refresh token.
* Roles de usuario:

  * Cliente
  * Vendedor
  * Operador logístico
  * Administrador
  * Superadministrador
* Perfil de usuario.
* Direcciones de envío.
* Preferencias de usuario.

### Catálogo

* Listado público de productos.
* Detalle de producto.
* Filtros por búsqueda, categoría, marca, región, precio y stock.
* Productos destacados.
* Categorías.
* Marcas.
* Regiones.

### Portal de vendedor

* Creación de productos.
* Edición de productos.
* Archivado de productos.
* Gestión de stock.
* Movimientos de stock.
* Pedidos recibidos.
* Actualización de estados de envío.
* Preguntas recibidas.
* Reclamos y devoluciones relacionados con sus productos.
* Dashboard completo del vendedor.

### Carrito y checkout

* Carrito activo por usuario.
* Agregar productos al carrito.
* Modificar cantidades.
* Eliminar productos.
* Validación de stock.
* Checkout transaccional.
* Creación de orden.
* Descuento de stock.
* Creación de pago simulado.
* Creación de envío.
* Registro de movimiento de stock.

### Órdenes, pagos y envíos

* Historial de órdenes del cliente.
* Detalle de orden.
* Pago simulado.
* Estados de envío.
* Eventos de seguimiento.
* Tracking de pedido.

### Reseñas y calificaciones

* Reseñas de productos comprados.
* Validación de pedido entregado.
* Una reseña por ítem comprado.
* Actualización automática del promedio de calificación del producto.

### Preguntas al vendedor

* Clientes pueden preguntar en productos.
* Vendedores pueden responder preguntas de sus productos.
* Preguntas respondidas visibles públicamente.
* Preguntas pendientes visibles para el vendedor.

### Favoritos

* Guardar productos favoritos.
* Listar favoritos del usuario.
* Quitar productos favoritos.
* Consultar si un producto está en favoritos.

### Reclamos y devoluciones

* Clientes pueden crear reclamos sobre órdenes.
* Clientes pueden solicitar devoluciones sobre productos entregados.
* Vendedores pueden ver reclamos y devoluciones relacionados con sus productos.
* Administradores pueden revisar y resolver reclamos.
* Administradores pueden aprobar, rechazar o cerrar devoluciones.

### Notificaciones internas

* Notificaciones por compras.
* Notificaciones por preguntas.
* Notificaciones por respuestas.
* Notificaciones por cambios de envío.
* Notificaciones por reclamos.
* Notificaciones por devoluciones.
* Notificaciones por stock bajo.
* Marcar una notificación como leída.
* Marcar todas como leídas.
* Eliminar notificaciones.

### Dashboards

#### Dashboard vendedor

Incluye:

* Resumen del vendedor.
* Productos publicados.
* Productos sin stock.
* Productos con stock bajo.
* Ventas.
* Ingresos.
* Pedidos recientes.
* Productos más vendidos.
* Preguntas pendientes.
* Reseñas.
* Reclamos.
* Devoluciones.
* Movimientos recientes de stock.
* Ventas mensuales.

#### Dashboard administrador

Incluye:

* Usuarios.
* Vendedores.
* Productos.
* Órdenes.
* Ventas.
* Pagos.
* Envíos.
* Stock crítico.
* Preguntas.
* Reseñas.
* Reclamos.
* Devoluciones.
* Top productos.
* Top vendedores.
* Órdenes recientes.
* Ventas mensuales.

---

## Tecnologías utilizadas

* Python
* Django
* Django REST Framework
* PostgreSQL
* Docker
* Docker Compose
* JWT Authentication
* Simple JWT
* drf-spectacular
* Swagger / OpenAPI
* Pytest
* Pytest-Django
* GitHub Actions
* Python Decouple
* CORS Headers

---

## Estructura del backend

```text
backend/
├── apps/
│   ├── carts/
│   ├── categories/
│   ├── complaints/
│   ├── core/
│   ├── dashboards/
│   ├── favorites/
│   ├── notifications/
│   ├── orders/
│   ├── payments/
│   ├── products/
│   ├── questions/
│   ├── regions/
│   ├── reviews/
│   ├── sellers/
│   ├── shipments/
│   └── users/
│
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
│
├── tests/
├── manage.py
├── requirements.txt
├── pytest.ini
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Instalación con Docker

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd agronexus-marketplace/backend
```

### 2. Crear archivo `.env.docker`

Crear un archivo llamado `.env.docker` dentro de `backend/` con el siguiente contenido:

```env
DEBUG=True
SECRET_KEY=django-insecure-local-docker-key

ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,web

DB_ENGINE=django.db.backends.postgresql
DB_NAME=agronexus_db
DB_USER=agronexus_user
DB_PASSWORD=agronexus_password
DB_HOST=db
DB_PORT=5432
```

### 3. Levantar los contenedores

```bash
docker compose up --build
```

El backend queda disponible en:

```text
http://127.0.0.1:8000/
```

Swagger queda disponible en:

```text
http://127.0.0.1:8000/api/v1/docs/
```

Django Admin queda disponible en:

```text
http://127.0.0.1:8000/admin/
```

---

## Comandos útiles con Docker

### Ejecutar migraciones

```bash
docker compose exec web python manage.py migrate
```

### Crear superusuario

```bash
docker compose exec web python manage.py createsuperuser
```

### Ejecutar tests

```bash
docker compose exec web pytest
```

### Entrar al shell de Django

```bash
docker compose exec web python manage.py shell
```

### Apagar contenedores

```bash
docker compose down
```

### Apagar contenedores y borrar la base de datos

```bash
docker compose down -v
```

---

## Seed demo

El proyecto incluye un comando para crear datos de demostración.

Ejecutar:

```bash
docker compose exec web python manage.py seed_demo --reset
```

Este comando crea:

* Usuario administrador
* Usuario cliente
* Usuario vendedor
* Regiones
* Categorías
* Marcas
* Productos
* Dirección demo
* Carrito demo
* Órdenes demo
* Pagos simulados
* Envíos
* Preguntas
* Reseñas
* Favoritos
* Reclamos
* Devoluciones
* Notificaciones

### Usuarios demo

```text
Admin:
email: admin@agronexus.com
password: Demo123456

Cliente:
email: cliente@agronexus.com
password: Demo123456

Cliente 2:
email: cliente2@agronexus.com
password: Demo123456

Vendedor:
email: vendedor@agronexus.com
password: Demo123456
```

Estas credenciales son solo para entorno local/demo.

---

## Instalación local sin Docker

### 1. Crear entorno virtual

```bash
python -m venv .venv
```

### 2. Activar entorno virtual

En Windows PowerShell:

```bash
.\.venv\Scripts\Activate.ps1
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno

Crear archivo `.env` dentro de `backend/`:

```env
DEBUG=True
SECRET_KEY=django-insecure-local-key

ALLOWED_HOSTS=localhost,127.0.0.1

DB_ENGINE=django.db.backends.postgresql
DB_NAME=agronexus_db
DB_USER=agronexus_user
DB_PASSWORD=agronexus_password
DB_HOST=localhost
DB_PORT=5433
```

### 5. Ejecutar migraciones

```bash
python manage.py migrate
```

### 6. Levantar servidor

```bash
python manage.py runserver
```

---

## Tests

El proyecto usa `pytest` y `pytest-django`.

Ejecutar tests localmente:

```bash
pytest
```

Ejecutar tests dentro de Docker:

```bash
docker compose exec web pytest
```

Los tests cubren:

* Autenticación
* Catálogo
* Carrito
* Checkout
* Órdenes
* Pagos
* Envíos
* Stock
* Reseñas
* Favoritos
* Preguntas
* Reclamos
* Devoluciones
* Notificaciones
* Dashboards
* Permisos

---

## GitHub Actions

El proyecto incluye workflows de GitHub Actions para:

* Instalar dependencias.
* Levantar PostgreSQL.
* Ejecutar `python manage.py check`.
* Verificar migraciones pendientes.
* Ejecutar tests.
* Validar build de Docker.

---

## Endpoints principales

### Autenticación

```http
POST /api/v1/auth/register/
POST /api/v1/auth/login/
POST /api/v1/auth/refresh/
```

### Catálogo

```http
GET /api/v1/products/
GET /api/v1/products/{slug}/
GET /api/v1/categories/
GET /api/v1/brands/
GET /api/v1/regions/
```

### Carrito y checkout

```http
GET    /api/v1/cart/
POST   /api/v1/cart/items/
PATCH  /api/v1/cart/items/{id}/
DELETE /api/v1/cart/items/{id}/delete/
POST   /api/v1/checkout/
```

### Órdenes

```http
GET /api/v1/orders/
GET /api/v1/orders/{id}/
GET /api/v1/orders/{id}/tracking/
```

### Portal vendedor

```http
GET    /api/v1/seller/products/
POST   /api/v1/seller/products/
PATCH  /api/v1/seller/products/{id}/
DELETE /api/v1/seller/products/{id}/
GET    /api/v1/seller/orders/
GET    /api/v1/seller/dashboard/
```

### Preguntas

```http
GET  /api/v1/products/{slug}/questions/
POST /api/v1/products/{slug}/questions/
GET  /api/v1/seller/questions/
PATCH /api/v1/seller/questions/{id}/answer/
```

### Reseñas

```http
GET  /api/v1/products/{slug}/reviews/
POST /api/v1/products/{slug}/reviews/
PATCH /api/v1/reviews/{id}/
DELETE /api/v1/reviews/{id}/
```

### Favoritos

```http
GET    /api/v1/favorites/
POST   /api/v1/favorites/add/
DELETE /api/v1/favorites/{id}/
GET    /api/v1/products/{slug}/favorite/status/
POST   /api/v1/products/{slug}/favorite/
DELETE /api/v1/products/{slug}/favorite/
```

### Reclamos y devoluciones

```http
GET  /api/v1/users/me/complaints/
POST /api/v1/orders/{id}/complaints/
GET  /api/v1/users/me/returns/
POST /api/v1/order-items/{id}/returns/
GET  /api/v1/admin/complaints/
PATCH /api/v1/admin/complaints/{id}/status/
GET  /api/v1/admin/returns/
PATCH /api/v1/admin/returns/{id}/status/
```

### Notificaciones

```http
GET    /api/v1/notifications/
GET    /api/v1/notifications/unread/
PATCH  /api/v1/notifications/{id}/read/
PATCH  /api/v1/notifications/read-all/
DELETE /api/v1/notifications/{id}/
```

### Dashboard administrador

```http
GET /api/v1/admin/dashboard/
```

---

## Seguridad

* Autenticación basada en JWT.
* Separación de permisos por rol.
* Clientes solo acceden a sus propios recursos.
* Vendedores solo gestionan productos y pedidos propios.
* Administradores acceden a recursos globales.
* Variables sensibles fuera del repositorio.
* `.env` y `.env.docker` ignorados por Git.
* Validación de stock en checkout.
* Operaciones críticas protegidas con transacciones.

---

## Estado del proyecto

Backend funcional en versión 1.0.

Implementado:

* API REST
* PostgreSQL
* Docker
* Autenticación JWT
* Swagger
* Tests automatizados
* GitHub Actions
* Seed demo
* Módulos principales de marketplace

---

## Próximos pasos

* Frontend con React y TypeScript.
* Deploy del backend.
* Configuración de producción.
* Almacenamiento externo de imágenes.
* Mejoras de performance.
* Paginación avanzada.
* Filtros más completos.
* Sistema real de pagos.
* Integración logística real.
* Celery y Redis para tareas asíncronas.


cosas de superadministrador:
email:admin@agronexus.com
name:admin
password:port1529

email:admin@agronexus.com
name:diegoportal
password:were1529