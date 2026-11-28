# Frontend AgroNexus

Aplicación React 19 y TypeScript compilada con Vite. Incluye catálogo público, autenticación, cuenta de cliente, compra, portal vendedor y administración. Consume la API Django de `../backend/`; los pagos y el transporte son simulados.

La versión del paquete es `1.1.1`. Consulta el [historial de cambios](../CHANGELOG.md) y la [guía de actualización](../docs/cierre-v1.md).

## Instalación y desarrollo

Requiere Node.js 24 y npm. Ejecuta los comandos desde esta carpeta:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell utiliza `Copy-Item .env.example .env.local`. La aplicación queda en `http://localhost:5173`. Inicia también el backend según el [README principal](../README.md#inicio-local).

El lockfile incluye los binarios de esbuild por plataforma. En npm 12, `allowScripts` controla el script de instalación de esbuild y se usa el binario incluido en las dependencias. La CI comprueba `npm ci` y el build en Windows con npm 12.0.1.

`VITE_API_BASE_URL` define la base de la API, incluido `/api/v1`, por ejemplo `http://127.0.0.1:8000/api/v1`. Si se deja vacío, se utiliza ese mismo valor local. Vite incorpora estas variables al compilar: cambiar el entorno del servidor después del build no cambia la URL compilada. Las variables `VITE_*` son públicas; no deben contener secretos.

`VITE_BACKEND_URL` figura en el archivo de ejemplo, pero el código actual utiliza `VITE_API_BASE_URL` para las peticiones. No se utilizan `VITE_BACKEND_URL` ni `VITE_API_URL` en el cliente actual.

## Comandos

| Comando | Función |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 5173 |
| `npm run quality` | ESLint, TypeScript, pruebas Vitest y build |
| `npm run test:run` | Pruebas unitarias y de componentes |
| `npm run test:coverage` | Cobertura de Vitest en `coverage/` |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Vista previa local de un build existente |
| `npm run e2e` | Build y navegación pública Playwright en escritorio/móvil |
| `npm run e2e:auth` | Build y pruebas de sesiones, compra, vendedor, administración y posventa contra Django real |
| `npm run quality:full` | `quality` y E2E público |

Para Playwright instala Chromium una vez: `npx playwright install --with-deps chromium`. `preview` sirve para inspeccionar el build localmente; la receta de producción usa Nginx.

Las pruebas de componentes simulan respuestas de API. Los E2E públicos verifican navegación y presentación, y pueden ejecutarse sin un backend. La suite con Django realiza peticiones reales y necesita el entorno siguiente.

## Marketplace E2E con backend real

Utiliza una base de demostración aislada; las pruebas registran usuarios, productos, compras y cambios administrativos. La CI utiliza PostgreSQL. Para una ejecución local rápida también puedes crear una SQLite exclusiva.

Primera terminal, desde `backend/`, con las dependencias Python instaladas:

```bash
export DJANGO_SETTINGS_MODULE=config.settings.local
export DB_ENGINE=django.db.backends.sqlite3
export DB_NAME=/tmp/agronexus-auth-e2e.sqlite3
export ALLOWED_HOSTS=localhost,127.0.0.1
export CORS_ALLOWED_ORIGINS=http://127.0.0.1:4176
python manage.py migrate --noinput
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8001 --noreload
```

La ruta `/tmp/` es un ejemplo para Linux/macOS. En PowerShell utiliza una ruta temporal propia y asigna las variables con `$env:NOMBRE="valor"`. Si esa base ya contiene historial demo protegido, crea una base nueva en vez de forzar `seed_demo --reset`.

Segunda terminal, desde `frontend/`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8001/api/v1 npm run e2e:auth
```

En PowerShell: `$env:VITE_API_BASE_URL="http://127.0.0.1:8001/api/v1"` y después `npm run e2e:auth`. Playwright inicia el preview en `127.0.0.1:4176`. Verifica login, refresh, logout, respuestas tardías y coordinación entre pestañas; compra desde catálogo, cambio de precio, recuperación tras perder una respuesta, dirección histórica, vendedor y administración. El recorrido de posventa compra productos de dos vendedores y comprueba cancelación en tránsito, recepción, inspección y reembolso, incluidos reintentos después de perder una respuesta. Consulta [testing](../docs/testing.md) para el alcance de cada suite. No sustituye las pruebas de concurrencia PostgreSQL ni la aceptación de una instalación publicada.

## Vendedor, archivos y administración

Crear un producto guarda una sola vez sus datos comerciales y abre su editor para añadir archivos. Las subidas, los cambios de imagen principal y los borrados tienen operaciones separadas: un fallo al subir una imagen no exige crear de nuevo el producto. Si se pierde la confirmación de una operación, el panel pide actualizar los archivos y revisar el resultado antes de escribir otra vez.

Se admiten hasta 12 imágenes JPEG, PNG o WebP por producto, de hasta 5 MiB cada una, sin animación y dentro de los límites del servidor de 8000 píxeles por dimensión y 20 megapíxeles. La ficha PDF es opcional y puede tener hasta 10 MiB. El navegador ofrece una validación inicial; Django vuelve a comprobar tamaño, contenido y propiedad. Las imágenes y fichas son públicas: no adjuntes documentos privados. La validación PDF reconoce su estructura básica; no es un análisis antivirus. En el catálogo se ofrece descarga solo cuando hay una ficha asociada.

Desde Usuarios, un administrador puede completar el alta comercial al asignar `SELLER`: se requiere un nombre comercial y se puede indicar identificación fiscal y descripción. Un perfil comercial inactivo necesita confirmación explícita de reactivación. El alta no desbloquea una cuenta de usuario bloqueada y la verificación del vendedor es otra operación.

Los dashboards leen las secciones reales de la API y distinguen importe bruto, reembolsos e ingresos netos simulados. Una respuesta incompatible se muestra como error de carga con reintento; no se sustituye por métricas ficticias en cero. Los datos y las respuestas tardías se descartan al cambiar de cuenta o rol.

## Producción y rutas

La plantilla [ops/compose.production.yml](../ops/compose.production.yml) ejecuta `npm ci` dentro de `frontend/`, compila `VITE_API_BASE_URL=/api/v1` y sirve la SPA con Nginx. Las rutas directas, como `/account/orders`, deben devolver `index.html`; las rutas `/api/`, `/media/` y `/static/` tienen tratamiento propio.

React Admin y Django Admin usan `/admin` en orígenes distintos. La plantilla utiliza `APP_DOMAIN` para la aplicación y `API_DOMAIN` para Django Admin y la API. Consulta [despliegue](../docs/despliegue.md) para TLS, medios persistentes y validación.
