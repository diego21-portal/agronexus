# Arquitectura del Proyecto — AgroNexus

## 1. Descripción general

AgroNexus es una plataforma web fullstack tipo marketplace orientada al sector agrícola y agroindustrial. El sistema permite comprar, vender y gestionar maquinaria, repuestos, insumos técnicos y productos especializados para el campo.

La plataforma se divide en dos grandes partes:

- **Backend:** encargado de la lógica de negocio, base de datos, autenticación, permisos, productos, pedidos, pagos simulados, stock, reportes y administración.
- **Frontend:** encargado de la interfaz visual, experiencia del usuario, catálogo, carrito, checkout, paneles, formularios y comunicación con la API.

El objetivo de la arquitectura es separar responsabilidades para que el proyecto sea escalable, mantenible y profesional.

---

## 2. Tipo de arquitectura

El proyecto utilizará una arquitectura cliente-servidor:

```text
Usuario
   ↓
Frontend React
   ↓
API REST
   ↓
Backend Django + Django REST Framework
   ↓
Base de datos PostgreSQL
```

### Responsabilidades principales

| Capa | Responsabilidad |
|---|---|
| Frontend | Interfaz visual, navegación, formularios, carrito, filtros, paneles y consumo de API. |
| Backend | Reglas de negocio, validaciones, autenticación, permisos, pedidos, pagos, stock y reportes. |
| Base de datos | Persistencia de usuarios, productos, pedidos, pagos, envíos, reseñas y movimientos de stock. |
| Servicios externos | Imágenes, archivos PDF, emails, pagos reales futuros y despliegue. |

---

## 3. Stack tecnológico

### Backend

- Python
- Django
- Django REST Framework
- PostgreSQL
- JWT Authentication
- Django Admin
- Celery
- Redis
- Pytest
- Swagger / OpenAPI

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- Zustand o Redux Toolkit
- React Hook Form
- Zod

### Infraestructura

- Docker
- Docker Compose
- GitHub Actions
- PostgreSQL en producción
- Cloudinary o S3 para imágenes y archivos
- Render, Railway, Fly.io o VPS para despliegue
- Variables de entorno
- HTTPS en producción

---

## 4. Estructura general del repositorio

```text
agronexus-marketplace/
│
├── backend/
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── local.py
│   │   │   ├── production.py
│   │   │   └── testing.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   │
│   ├── apps/
│   │   ├── users/
│   │   ├── sellers/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── carts/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── shipments/
│   │   ├── reviews/
│   │   ├── questions/
│   │   ├── promotions/
│   │   ├── reports/
│   │   └── core/
│   │
│   ├── requirements/
│   │   ├── base.txt
│   │   ├── local.txt
│   │   ├── production.txt
│   │   └── testing.txt
│   │
│   ├── manage.py
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── Dockerfile
│
├── docs/
│   ├── arquitectura.md
│   ├── modelo-datos.md
│   ├── endpoints.md
│   ├── roles-permisos.md
│   ├── seguridad.md
│   ├── flujos-negocio.md
│   ├── testing.md
│   └── despliegue.md
│
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
```

---

## 5. Arquitectura del backend

El backend se construirá con Django y Django REST Framework. Su función principal será exponer una API REST consumida por el frontend.

### Aplicaciones principales

```text
apps/
├── users/
├── sellers/
├── products/
├── categories/
├── carts/
├── orders/
├── payments/
├── shipments/
├── reviews/
├── questions/
├── promotions/
├── reports/
└── core/
```

### Responsabilidad de cada app

| App | Responsabilidad |
|---|---|
| users | Usuarios, perfiles, autenticación, direcciones y preferencias. |
| sellers | Perfil de vendedores, reputación y gestión comercial. |
| products | Productos, imágenes, fichas técnicas, stock y precios. |
| categories | Categorías, marcas y clasificación de productos. |
| carts | Carrito de compras y productos seleccionados. |
| orders | Órdenes de compra, estados y detalle de pedidos. |
| payments | Pagos simulados y estados de pago. |
| shipments | Seguimiento de envíos y eventos logísticos. |
| reviews | Reseñas, calificaciones de productos y vendedores. |
| questions | Preguntas al vendedor y respuestas públicas. |
| promotions | Promociones, descuentos y cupones. |
| reports | Métricas comerciales, ventas y reportes administrativos. |
| core | Funciones comunes, utilidades, modelos base y configuración compartida. |

---

## 6. Arquitectura del frontend

El frontend se construirá con React, TypeScript y Tailwind CSS. Su objetivo será ofrecer una experiencia moderna, responsive y similar a un marketplace profesional.

### Estructura inicial del frontend

```text
frontend/
└── src/
    ├── assets/
    ├── components/
    ├── features/
    ├── hooks/
    ├── layouts/
    ├── pages/
    ├── routes/
    ├── services/
    ├── store/
    ├── types/
    └── utils/
```

### Responsabilidad de cada carpeta

| Carpeta | Responsabilidad |
|---|---|
| assets | Imágenes, íconos y recursos estáticos. |
| components | Componentes reutilizables como botones, cards, modales y formularios. |
| features | Módulos funcionales como productos, carrito, usuarios o pedidos. |
| hooks | Hooks personalizados. |
| layouts | Estructuras visuales generales como layout público, cliente, vendedor y admin. |
| pages | Páginas principales de la aplicación. |
| routes | Configuración de rutas públicas y privadas. |
| services | Comunicación con la API. |
| store | Estado global de la aplicación. |
| types | Tipos e interfaces de TypeScript. |
| utils | Funciones auxiliares. |

---

## 7. Comunicación frontend-backend

La comunicación entre frontend y backend se realizará mediante una API REST.

```text
React
  ↓ HTTP request
Django REST Framework
  ↓ Query / lógica de negocio
PostgreSQL
  ↓ Respuesta JSON
React
```

### Ejemplo de flujo

1. El usuario busca "filtro hidráulico".
2. El frontend envía una petición `GET` a la API.
3. El backend recibe filtros y parámetros.
4. Django consulta PostgreSQL.
5. La API devuelve productos paginados.
6. React muestra los resultados en pantalla.

Ejemplo de endpoint:

```http
GET /api/v1/products/?search=filtro-hidraulico&region=mendoza&in_stock=true
```

---

## 8. Autenticación y autorización

El sistema tendrá usuarios con diferentes roles:

- Visitante
- Cliente
- Vendedor
- Operador logístico
- Administrador
- Superadministrador

### Autenticación

El usuario podrá registrarse, iniciar sesión y acceder a funcionalidades privadas.

### Autorización

El sistema deberá controlar qué puede hacer cada rol.

Ejemplos:

- Un cliente puede comprar productos.
- Un vendedor puede publicar productos propios.
- Un operador logístico puede actualizar envíos.
- Un administrador puede gestionar toda la plataforma.

---

## 9. Gestión de productos

Los productos serán uno de los módulos centrales del sistema.

Cada producto podrá tener:

```text
Nombre
Slug
SKU
Marca
Categoría
Vendedor
Precio
Descuento
Stock
Región
Unidad de venta
Descripción
Tabla técnica
Imágenes
Ficha técnica PDF
Garantía
Estado de disponibilidad
Calificación promedio
```

---

## 10. Gestión de stock

El stock no debe manejarse como un simple número sin control. El sistema deberá registrar movimientos de stock para mantener trazabilidad.

Movimientos previstos:

- Alta inicial
- Ajuste manual
- Venta
- Devolución
- Cancelación
- Reposición
- Reserva
- Liberación de reserva

Ejemplo:

```text
Producto: Filtro hidráulico X100
Movimiento: Venta
Cantidad: -2
Stock anterior: 15
Stock nuevo: 13
Usuario responsable: sistema
```

---

## 11. Flujo general de compra

```text
1. El cliente busca productos.
2. Revisa el detalle del producto.
3. Agrega productos al carrito.
4. El sistema valida disponibilidad.
5. El cliente inicia checkout.
6. Selecciona dirección.
7. Selecciona forma de pago.
8. El sistema valida stock, precios y datos.
9. Se genera una orden.
10. Se registra un pago simulado.
11. Se inicia el seguimiento del envío.
12. El cliente recibe el producto.
13. El pedido queda marcado como entregado.
```

---

## 12. Pagos simulados

En la primera versión, los pagos serán simulados para representar el flujo de compra sin integrar una pasarela real.

Métodos previstos:

- Tarjeta simulada
- Transferencia bancaria simulada
- Pago contra entrega
- Cuenta corriente para empresas
- Mercado Pago simulado

Estados posibles:

- Pendiente
- Aprobado
- Rechazado
- Cancelado
- Reembolsado

---

## 13. Seguimiento de envíos

Cada pedido tendrá seguimiento mediante estados y eventos.

Estados posibles:

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

Cada cambio de estado deberá registrarse como un evento del envío.

Ejemplo:

```text
Pedido: #1001
Estado: En camino
Fecha: 2026-05-07
Descripción: El producto salió del centro de distribución.
```

---

## 14. Paneles del sistema

El sistema tendrá diferentes paneles según el tipo de usuario.

### Panel del cliente

- Perfil
- Direcciones
- Métodos de pago simulados
- Favoritos
- Mis compras
- Seguimiento de pedidos
- Preguntas realizadas
- Reseñas publicadas
- Preferencias

### Panel del vendedor

- Dashboard de ventas
- Productos publicados
- Nuevo producto
- Stock
- Pedidos recibidos
- Preguntas pendientes
- Promociones
- Reportes

### Panel administrativo

- Usuarios
- Vendedores
- Productos
- Categorías
- Marcas
- Regiones
- Pedidos
- Pagos
- Envíos
- Reseñas
- Preguntas
- Reclamos
- Reportes

---

## 15. Archivos e imágenes

El sistema manejará archivos multimedia:

- Imágenes de productos
- Imágenes de perfil
- Fichas técnicas en PDF
- Comprobantes simulados
- Archivos administrativos futuros

En desarrollo local, los archivos podrán guardarse en el sistema de archivos del proyecto. En producción, se evaluará usar un servicio externo como Cloudinary o S3.

---

## 16. Reportes

El sistema deberá generar reportes para administradores y vendedores.

Reportes previstos:

- Ventas totales
- Ventas por período
- Productos más vendidos
- Productos con bajo stock
- Productos agotados
- Pedidos pendientes
- Pedidos cancelados
- Vendedores con más ventas
- Clientes con más compras
- Ingresos simulados
- Productos mejor calificados

---

## 17. Seguridad general

El sistema deberá considerar:

- Autenticación segura
- Control de permisos por rol
- Protección de rutas privadas
- Validación de datos
- Manejo seguro de variables de entorno
- Configuración distinta para desarrollo y producción
- Protección de archivos sensibles
- Uso de HTTPS en producción
- Revisión de configuración antes del despliegue

---

## 18. Escalabilidad futura

La arquitectura permitirá agregar funcionalidades futuras como:

- Integración real con Mercado Pago
- Emails automáticos
- Notificaciones en tiempo real
- Recomendaciones de productos
- Sistema de reclamos avanzado
- Auditoría completa
- Multi-vendedor avanzado
- Stock por sucursal
- Facturación
- App móvil
