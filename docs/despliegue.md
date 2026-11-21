# Despliegue de AgroNexus

El repositorio contiene una plantilla ejecutable de producción en `ops/`. Sirve el frontend compilado con Nginx y TLS, ejecuta Django con Gunicorn y conserva imágenes, PDFs y estáticos en volúmenes. La base de datos es un PostgreSQL externo con SSL. La plantilla necesita infraestructura, dominios y certificados del responsable de la instalación; no crea hosting ni acredita una publicación existente.

Los pagos, reembolsos y eventos logísticos siguen siendo simulados después de desplegar. Para la instalación local y Docker de desarrollo, consulta el [README](../README.md).

## Componentes

| Archivo | Función |
|---|---|
| `ops/compose.production.yml` | Servicios `web` y `proxy`, volúmenes y puertos |
| `ops/Dockerfile.backend` | Python 3.12 y Gunicorn, sin servidor de desarrollo |
| `ops/Dockerfile.frontend` | `npm ci`, build Vite y Nginx |
| `ops/nginx.conf.template` | TLS, API, SPA, Django Admin, media y estáticos |
| `ops/.env.production.example` | Variables de la instalación, sin claves reales |
| `ops/smoke.sh` | Comprobaciones de lectura por HTTPS |

El Compose de desarrollo en `backend/` monta el código, ejecuta migraciones al arrancar y usa `runserver`. El Compose de producción copia el código a imágenes y deja las migraciones como una acción explícita de cada actualización.

## Preparación

Necesitas Docker con Compose, PostgreSQL accesible desde el contenedor, dos nombres de dominio propios y un certificado TLS cuya cadena cubra ambos nombres. El proveedor de PostgreSQL debe aceptar conexiones SSL y permitir las operaciones de esquema necesarias para las migraciones.

La plantilla diferencia dos orígenes porque React y Django Admin usan `/admin/`:

- `APP_DOMAIN`: aplicación React; `/api/` se envía internamente a Django.
- `API_DOMAIN`: API y Django Admin; `/admin/` se envía a Django.

Los valores `app.example.invalid` y `api.example.invalid` del ejemplo son nombres reservados de documentación. Sustitúyelos por dominios propios. DNS, emisión y renovación del certificado quedan a cargo de la infraestructura elegida.

Desde la raíz del repositorio:

```bash
cp ops/.env.production.example ops/.env.production
mkdir -p ops/tls
```

En PowerShell utiliza `Copy-Item ops/.env.production.example ops/.env.production` y `New-Item -ItemType Directory -Force ops/tls`.

Completa el archivo local y coloca la cadena de certificados en `ops/tls/fullchain.pem` y su clave privada en `ops/tls/privkey.pem`. `.env.production` y `ops/tls/` están ignorados por Git y excluidos del contexto de build. Restringe su acceso al operador y a Docker. No incluyas claves o entornos completos en capturas, incidencias o logs.

## Variables reales del proyecto

| Variable | Uso |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.production`; Compose también lo fuerza para `web` |
| `SECRET_KEY` | Clave aleatoria propia; no usar la clave local ni las cuentas demo |
| `DATABASE_URL` | URL PostgreSQL completa, con credenciales y host del proveedor |
| `ALLOWED_HOSTS` | Los dos dominios, separados por comas, sin esquema ni puerto |
| `CORS_ALLOWED_ORIGINS` | Orígenes HTTPS autorizados, incluido puerto cuando no sea 443 |
| `CSRF_TRUSTED_ORIGINS` | Orígenes HTTPS de aplicación y administración, incluido puerto si corresponde |
| `DEFAULT_FROM_EMAIL` | Remitente propio; no configura por sí solo un servicio SMTP |
| `APP_DOMAIN`, `API_DOMAIN` | Los dos nombres que Nginx atenderá, sin esquema ni puerto |
| `BIND_ADDRESS` | `127.0.0.1` por defecto; permite validar antes de exponer puertos |
| `HTTP_PORT`, `HTTPS_PORT` | `8080` y `8443` por defecto; usa `80` y `443` para exposición directa convencional |
| `RELEASE_TAG` | Identificador único de versión para conservar las imágenes anteriores |

`production.py` fuerza `DEBUG=False`, lee `DATABASE_URL` y exige SSL para PostgreSQL. No utiliza las variables inventadas `DATABASE_NAME`, `DATABASE_USER` o `DATABASE_PASSWORD`. Las variables `DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT` pertenecen al entorno local y de pruebas.

Una URL PostgreSQL tiene la forma `postgresql://USUARIO:CONTRASENA_CODIFICADA@HOST:5432/BASE`. Usa la URL suministrada por el proveedor y codifica los caracteres especiales de las credenciales. La configuración actual exige cifrado mediante SSL; si la infraestructura requiere una política de verificación de CA o cliente TLS adicional, valida su compatibilidad antes de utilizarla.

El frontend usa **`VITE_API_BASE_URL`**, con el sufijo `/api/v1`. La plantilla lo compila como `/api/v1` para consumir la API desde el mismo origen mediante Nginx. Si publicas el frontend por separado, compílalo con su URL API definitiva y configura CORS en Django. Las variables `VITE_*` son públicas y se incorporan durante el build; nunca deben contener secretos.

## Construcción e instalación inicial

Los siguientes comandos se ejecutan desde la raíz. Para abreviar, define una función Bash:

```bash
dc() { docker compose --env-file ops/.env.production -f ops/compose.production.yml "$@"; }
```

En PowerShell:

```powershell
function dc { docker compose --env-file ops/.env.production -f ops/compose.production.yml @args }
```

Valida las variables y construye las dos imágenes:

```bash
dc config --quiet
dc build
```

Evita imprimir `dc config` completo o compartir `docker inspect`: sus salidas pueden incluir credenciales. El build instala Python desde `backend/requirements.txt` y npm desde `frontend/package-lock.json`; no existe `requirements/production.txt` ni un proyecto npm en la raíz.

Si la red de construcción utiliza una CA privada, proporciona su bundle PEM como secreto de BuildKit. La CA se utiliza solo para instalar dependencias durante el build; no se copia a las imágenes ni se desactiva la validación TLS:

```bash
BUILD_CA_FILE=/RUTA/ABSOLUTA/ca-bundle.pem dc -f ops/compose.build-ca.yml build
```

En PowerShell asigna `$env:BUILD_CA_FILE` antes de ejecutar `dc -f ops/compose.build-ca.yml build`. Este override es opcional y no cambia la configuración de PostgreSQL o TLS del servicio.

Con PostgreSQL disponible, ejecuta y revisa cada paso antes de seguir:

```bash
dc run --rm --no-deps web python manage.py check
dc run --rm --no-deps web python manage.py check --deploy --tag security
dc run --rm --no-deps web python manage.py audit_aftersales
dc run --rm --no-deps web python manage.py migrate --noinput
dc run --rm --no-deps web python manage.py audit_aftersales
dc run --rm --no-deps web python manage.py collectstatic --noinput
dc run --rm --no-deps web python manage.py createsuperuser
```

`audit_aftersales` es de lectura y también se puede ejecutar antes del esquema inicial. `migrate` aplica migraciones versionadas: no ejecutes `makemigrations` en producción. No cargues `seed_demo` sobre datos reales ni publiques sus cuentas.

La configuración no activa `SECURE_HSTS_PRELOAD`; el check de seguridad puede informar `security.W021`. La inclusión en la lista de precarga requiere una decisión sobre los dominios reales y su HTTPS permanente. El contrato OpenAPI se comprueba en CI con `python manage.py spectacular --validate --fail-on-warn --file /tmp/agronexus-openapi.yml`. Esa validación debe completarse sin advertencias de esquema; no activa la precarga HSTS.

Inicia y comprueba los servicios:

```bash
dc up -d --wait
dc ps
dc logs --tail=100 web proxy
```

El healthcheck de `web` consulta `/health/` y comprueba que Django responde; no comprueba PostgreSQL. La consulta de catálogo del smoke siguiente sí utiliza la base.

Gunicorn escucha únicamente en la red Docker. Nginx termina TLS y fija los encabezados de proxy. La plantilla publica por defecto solo en loopback; antes de exponerla, revisa dominios, certificados y firewall. Para una publicación directa, asigna intencionalmente `BIND_ADDRESS=0.0.0.0`, `HTTP_PORT=80` y `HTTPS_PORT=443` y recrea `proxy`. Si existe otro proxy o balanceador delante, revisa en conjunto certificados, puertos, IP de origen y encabezados de confianza.

## Medios, estáticos y persistencia

Django escribe media en `/app/media` y `collectstatic` escribe en `/app/staticfiles`. Los volúmenes `media` y `staticfiles` son persistentes; Nginx los monta en modo lectura y sirve `/media/` y `/static/`. `DEBUG=False` no depende de que Django sirva archivos subidos.

Conserva `media` junto con la base en cada respaldo. `staticfiles` puede reconstruirse desde la imagen correspondiente. Detener o recrear servicios conserva los volúmenes; eliminar volúmenes borra los archivos almacenados. El Compose no crea una base de datos local ni respalda automáticamente PostgreSQL externo.

La SPA devuelve `index.html` para rutas de React. Los archivos de `/assets/` que no existen devuelven `404`; no deben responder con HTML. Nginx limita el tamaño de una petición a 20 MiB. Ajusta ese límite y las validaciones de archivos en conjunto si las necesidades del catálogo cambian.

El vendedor gestiona las imágenes y la ficha PDF desde el editor de sus productos, después de guardar sus datos comerciales. El servidor limita cada imagen a 5 MiB, JPEG/PNG/WebP sin animación, 8000 píxeles por dimensión y 20 megapíxeles; permite hasta 12 por producto. La ficha opcional admite hasta 10 MiB. Comprueba contenido y tamaño, genera nombres UUID y autoriza al dueño del producto. Los detalles de peticiones y respuestas están en [endpoints](endpoints.md#imágenes-y-ficha-pdf).

`/media/products/documents/` sirve las fichas como descarga con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`. El servidor de desarrollo Django aplica las mismas cabeceras para ese prefijo cuando `DEBUG=True`. Son documentos públicos del catálogo; no utilices este almacenamiento para información privada. La validación PDF reconoce firma y estructura básica y no equivale a un análisis antivirus.

## Smoke y verificación funcional

Desde un equipo que resuelva ambos dominios y confíe en su certificado:

```bash
APP_ORIGIN=https://TU_DOMINIO_APP API_ORIGIN=https://TU_DOMINIO_API bash ops/smoke.sh
```

En PowerShell asigna `$env:APP_ORIGIN` y `$env:API_ORIGIN` y ejecuta `bash ops/smoke.sh`. Para una CA interna, `CA_CERT` permite indicar el archivo PEM de confianza sin desactivar la verificación TLS. Si utilizas puertos distintos de 443, inclúyelos en ambos orígenes.

El script realiza solo lecturas y verifica HTML, JavaScript compilado, acceso directo a una ruta React, salud por ambos orígenes, consulta del catálogo, archivos estáticos de Django y rechazo de un perfil sin autenticar. No valida credenciales, escritura de media, checkout ni posventa.

En una instalación de pruebas aislada, completa también:

1. Registro, login, renovación, logout y revocación remota de sesión.
2. Desde Usuarios, dar de alta una cuenta como vendedor con sus datos comerciales. Ingresar con esa cuenta, crear un producto, abrir su editor, subir imagen y PDF y comprobarlos desde el catálogo y otro navegador. Recrear `web` y `proxy` conservando volúmenes y verificar los mismos archivos.
3. Comprar productos de dos vendedores; revisar stock, pedidos y seguimiento separado.
4. Confirmar que un cliente y un vendedor no ven recursos ajenos ni rutas administrativas.
5. Cancelar antes y después del despacho, registrar recepción e inspección y comprobar reposición y reembolso simulados sin duplicarlos al reintentar.
6. Revisar el portal React de administración y Django Admin en sus respectivos dominios.

Ejecuta además la calidad frontend, la suite backend sobre PostgreSQL y los E2E con Django según los README. La plantilla y un smoke satisfactorio no demuestran por sí solos que todos los flujos estén correctos en infraestructura real.

## Actualizar y restaurar

Para una instalación con datos, detén escrituras y conserva una copia restaurable de PostgreSQL, los archivos media y el identificador de código e imágenes anteriores. La [guía de actualización y respaldo](cancelaciones-devoluciones.md#actualizar-con-docker-desde-powershell) explica el procedimiento local con `pg_dump` en formato custom y una restauración separada. Para PostgreSQL externo, utiliza la herramienta de copia y recuperación del proveedor y verifica una restauración en una base aislada.

En esta plantilla, detén los servicios antes de aplicar migraciones de una actualización:

```bash
dc stop proxy web
```

Después de respaldar, actualiza el checkout conservando cambios propios, asigna otro `RELEASE_TAG`, construye las imágenes y repite auditoría, migración y recolección de estáticos antes de `dc up -d --wait`. No inicies servicios de aplicación viejos contra un esquema en transformación.

Para retroceder, restaura la base y media del mismo punto de respaldo y ejecuta la versión de código e imágenes que le corresponde. Las migraciones que protegen historial operativo no permiten volver atrás borrando expedientes o asientos: cambiar solo el commit y ejecutar migraciones inversas no es una estrategia suficiente. Conserva las imágenes previas y comprueba el procedimiento de recuperación antes de depender de él.

## Operación y límites

- Revisa `dc logs`, errores 5xx, fallos de conexión PostgreSQL y espacio de los volúmenes. Evita registrar contraseñas, tokens o cuerpos sensibles.
- Programa y prueba respaldos de PostgreSQL y media y la renovación de TLS; la plantilla no instala tareas programadas.
- Nginx aplica a autenticación un límite de 30 peticiones por minuto e IP, con ráfaga de 10. El origen real depende de la topología de proxies.
- Gunicorn inicia un solo worker con cuatro threads. Los límites de Django siguen usando `LocMemCache`, se reinician con el proceso y no se comparten entre instancias. Antes de aumentar workers o réplicas, configura y verifica caché compartida y una política de IP de confianza; consulta [sesiones](sesiones.md#límites-de-peticiones).
- El tamaño, disponibilidad, monitoreo, correo, almacenamiento externo e integraciones reales deben adaptarse a la instalación. No se incluyen cobros ni integración de transporte reales.

## Validación de las imágenes en CI

El job `Production images and HTTPS smoke` construye ambos Dockerfiles y ejecuta `ops/ci-smoke.sh` en un runner efímero. El script comprueba la configuración de seguridad de producción, después inicia las imágenes con una SQLite temporal y ajustes locales para probar el enrutamiento de Nginx, TLS con una CA exclusiva de tests, rutas React, estáticos, catálogo y permisos anónimos. Crea una imagen y un documento de prueba en el volumen de medios y comprueba sus bytes y las cabeceras de descarga desde ambos orígenes. Después elimina y recrea ambos contenedores conservando los volúmenes y repite la lectura de esos archivos.

Ese ensayo verifica la persistencia del volumen y el enrutamiento de estas imágenes; no comprueba PostgreSQL externo con SSL, un dominio publicado ni la restauración de una copia de seguridad. Las pruebas de negocio y concurrencia usan PostgreSQL en otros jobs. `ops/ci-smoke.sh` modifica únicamente el runner y no debe ejecutarse en una instalación real; para una instalación existente utiliza `ops/smoke.sh`, que realiza lecturas.
