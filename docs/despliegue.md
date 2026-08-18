# Despliegue — AgroNexus

## 1. Objetivo del despliegue

El objetivo del despliegue es publicar la plataforma AgroNexus en un entorno accesible para usuarios reales, garantizando seguridad, estabilidad, rendimiento básico y facilidad de mantenimiento.

El sistema deberá poder ejecutarse en un entorno productivo con:

- Backend Django configurado para producción.
- Frontend React compilado para producción.
- Base de datos PostgreSQL.
- Archivos estáticos correctamente servidos.
- Variables sensibles protegidas mediante variables de entorno.
- Migraciones aplicadas de forma controlada.
- Sistema preparado para monitoreo, logs y mantenimiento.

---

## 2. Entornos del proyecto

El proyecto contempla tres entornos principales:

| Entorno | Uso principal | Características |
|---|---|---|
| Desarrollo | Programación local | `DEBUG=True`, base local, datos de prueba |
| Testing | Validación automática | Base temporal, tests automatizados |
| Producción | Uso real | `DEBUG=False`, seguridad activa, dominio real |

---

## 3. Requisitos previos

Antes de desplegar el proyecto se debe contar con:

- Python instalado.
- Node.js instalado para compilar el frontend.
- Dependencias del backend definidas en requirements.
- Dependencias del frontend definidas en `package.json`.
- Base de datos PostgreSQL configurada.
- Variables de entorno disponibles.
- Servidor o plataforma de despliegue.
- Dominio o URL pública.
- Archivos estáticos configurados.
- Migraciones revisadas y aplicadas.

---

## 4. Variables de entorno necesarias

Las configuraciones sensibles no deben escribirse directamente en el código.

### Backend

```env
SECRET_KEY=clave-secreta-segura
DEBUG=False
ALLOWED_HOSTS=agronexus.com,www.agronexus.com
DATABASE_NAME=agronexus_db
DATABASE_USER=agronexus_user
DATABASE_PASSWORD=password_seguro
DATABASE_HOST=localhost
DATABASE_PORT=5432
CSRF_TRUSTED_ORIGINS=https://agronexus.com,https://www.agronexus.com
CORS_ALLOWED_ORIGINS=https://agronexus.com,https://www.agronexus.com
```

### Frontend

```env
VITE_API_URL=https://api.agronexus.com/api/v1
```

En desarrollo puede existir un archivo `.env`, pero este archivo no debe subirse al repositorio.

Debe agregarse al `.gitignore`:

```text
.env
__pycache__/
*.pyc
db.sqlite3
media/
staticfiles/
node_modules/
dist/
```

---

## 5. Configuración básica de producción

En producción deben aplicarse las siguientes configuraciones:

```python
DEBUG = False

ALLOWED_HOSTS = [
    "agronexus.com",
    "www.agronexus.com",
]
```

También se recomienda separar la configuración por entorno:

```text
config/
├── settings/
│   ├── base.py
│   ├── local.py
│   ├── production.py
│   └── testing.py
```

Esto permite mantener ordenada la configuración según el contexto de ejecución.

---

## 6. Base de datos en producción

La base de datos recomendada para producción es PostgreSQL.

Ejemplo usando variables de entorno:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DATABASE_NAME"),
        "USER": env("DATABASE_USER"),
        "PASSWORD": env("DATABASE_PASSWORD"),
        "HOST": env("DATABASE_HOST"),
        "PORT": env("DATABASE_PORT"),
    }
}
```

Antes de publicar, se deben aplicar las migraciones:

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 7. Archivos estáticos y media

Los archivos estáticos son recursos usados por Django y el frontend:

```text
CSS
JavaScript
Imágenes del sitio
Íconos
Archivos de diseño
```

Configuración sugerida para Django:

```python
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
```

Antes del despliegue:

```bash
python manage.py collectstatic
```

Los archivos subidos por usuarios, como imágenes de productos o fichas técnicas PDF, deben manejarse con cuidado. En producción pueden almacenarse en:

- El servidor.
- Un volumen persistente.
- Un servicio externo de almacenamiento.
- Un bucket tipo S3, si el proyecto escala.

---

## 8. Frontend en producción

El frontend se compilará con Vite.

Comandos orientativos:

```bash
cd frontend
npm install
npm run build
```

El resultado se generará normalmente en:

```text
frontend/dist/
```

Opciones de publicación:

- Desplegar frontend y backend por separado.
- Servir el frontend desde una plataforma como Vercel, Netlify, Render o similar.
- Servir el frontend desde el mismo servidor usando Nginx.
- Integrar el build del frontend dentro del backend en una etapa posterior.

Si frontend y backend usan dominios distintos, debe configurarse correctamente CORS en Django.

---

## 9. Servidor de aplicación

En desarrollo se usa:

```bash
python manage.py runserver
```

En producción no debe usarse `runserver`.

Para producción se puede usar Gunicorn:

```bash
gunicorn config.wsgi:application
```

Ejemplo más completo:

```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

Si el módulo principal del proyecto tiene otro nombre, reemplazar `config` por el nombre correcto.

---

## 10. Flujo general de despliegue

El despliegue debería seguir este orden:

1. Clonar el repositorio en el servidor o plataforma.
2. Crear entorno virtual.
3. Instalar dependencias del backend.
4. Instalar y compilar dependencias del frontend.
5. Configurar variables de entorno.
6. Configurar la base de datos.
7. Aplicar migraciones.
8. Recolectar archivos estáticos.
9. Crear superusuario si corresponde.
10. Levantar el servidor de aplicación.
11. Validar funcionamiento general.

Comandos orientativos:

```bash
git clone https://github.com/usuario/agronexus-marketplace.git
cd agronexus-marketplace/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements/production.txt
python manage.py migrate
python manage.py collectstatic
python manage.py createsuperuser
gunicorn config.wsgi:application
```

En Windows, la activación del entorno virtual puede ser:

```bash
venv\Scripts\activate
```

---

## 11. Opciones de despliegue

### Opción 1: Plataforma como servicio

Ejemplos:

```text
Render
Railway
Fly.io
Heroku
PythonAnywhere
```

Ventajas:

- Más fácil de configurar.
- Menos administración del servidor.
- Buena opción para portfolio.

Desventajas:

- Menos control avanzado.
- Puede tener límites en planes gratuitos.

### Opción 2: VPS propio

Ejemplos:

- DigitalOcean
- Hetzner
- AWS EC2
- Google Cloud
- Azure

Ventajas:

- Mayor control.
- Mejor para aprender despliegue real.
- Permite configurar Nginx, Gunicorn, PostgreSQL y SSL manualmente.

Desventajas:

- Requiere más mantenimiento.
- Mayor responsabilidad sobre seguridad.

---

## 12. Seguridad mínima en producción

Antes de publicar el sistema, revisar:

```text
DEBUG=False
SECRET_KEY protegida
ALLOWED_HOSTS configurado
Contraseñas fuera del código
HTTPS activo
Cookies seguras
Protección CSRF activa
CORS configurado correctamente
Permisos de usuarios revisados
Panel admin protegido
Validación de formularios
Restricción de acceso según roles
Backups de base de datos
```

Configuración recomendada cuando se usa HTTPS:

```python
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
```

También puede configurarse:

```python
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

Estas opciones deben activarse solo cuando el dominio y HTTPS estén correctamente funcionando.

---

## 13. Checklist previo al despliegue

Antes de publicar, verificar:

- El proyecto inicia sin errores.
- Las migraciones están aplicadas.
- Existe un superusuario administrativo.
- `DEBUG` está en `False`.
- `ALLOWED_HOSTS` contiene el dominio correcto.
- Las variables sensibles no están en GitHub.
- Los archivos estáticos se cargan correctamente.
- Las imágenes de productos funcionan.
- El login y registro funcionan.
- El carrito funciona.
- Las órdenes se generan correctamente.
- Los permisos por rol funcionan.
- El panel admin está protegido.
- Los tests principales pasan.
- Existe un plan de backup.

---

## 14. Pruebas posteriores al despliegue

Después de desplegar, realizar una prueba manual completa:

1. Entrar a la página principal.
2. Buscar productos.
3. Ver detalle de un producto.
4. Registrarse como usuario.
5. Iniciar sesión.
6. Agregar productos al carrito.
7. Simular una compra.
8. Revisar historial de órdenes.
9. Ingresar al panel administrativo.
10. Crear o editar un producto.
11. Verificar imágenes y archivos PDF.
12. Cerrar sesión.

---

## 15. Logs y monitoreo

En producción es importante revisar errores y eventos del sistema.

Se deben monitorear:

```text
Errores 500
Fallos de login
Problemas de conexión a base de datos
Errores en carga de imágenes
Fallos en generación de órdenes
Problemas de permisos
Tiempos de respuesta lentos
```

Ejemplo básico de logging en Django:

```python
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "file": {
            "level": "ERROR",
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs/errors.log",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["file"],
            "level": "ERROR",
            "propagate": True,
        },
    },
}
```

---

## 16. Backups

El sistema debe contar con copias de seguridad periódicas de la base de datos.

Ejemplo con PostgreSQL:

```bash
pg_dump -U usuario -d agronexus_db > backup_agronexus.sql
```

Restauración:

```bash
psql -U usuario -d agronexus_db < backup_agronexus.sql
```

También se deben respaldar los archivos media si se almacenan localmente.

---

## 17. Rollback

Si una versión desplegada falla, debe existir una forma de volver a una versión anterior.

Estrategia básica:

1. Identificar el error.
2. Detener la versión actual.
3. Volver al commit estable anterior.
4. Reinstalar dependencias si cambiaron.
5. Aplicar migraciones necesarias.
6. Reiniciar el servicio.
7. Validar funcionamiento.

Ejemplo:

```bash
git log --oneline
git checkout <commit_estable>
pip install -r requirements/production.txt
python manage.py migrate
python manage.py collectstatic
```

---

## 18. Criterio de despliegue exitoso

El despliegue se considera exitoso cuando:

- El sitio es accesible desde la URL pública.
- No aparecen errores críticos.
- Los usuarios pueden registrarse e iniciar sesión.
- Los productos se muestran correctamente.
- El carrito y las órdenes funcionan.
- El panel administrativo está operativo.
- Los archivos estáticos y media cargan correctamente.
- La base de datos mantiene la información.
- Las pruebas principales pasan correctamente.

---

## 19. Conclusión

El despliegue de AgroNexus debe realizarse de forma controlada, separando desarrollo, testing y producción. Para el MVP se recomienda usar una plataforma simple de despliegue y luego avanzar hacia una configuración más completa con Docker, CI/CD, dominio propio, HTTPS y monitoreo.
