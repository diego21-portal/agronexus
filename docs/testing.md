# Pruebas de AgroNexus

El repositorio utiliza pytest y pytest-django para la API, Vitest y React Testing Library para componentes y Playwright para navegador. GitHub Actions reproduce la instalación desde los archivos de dependencias versionados. Los tests usan bases aisladas; no deben ejecutarse contra datos de producción.

## Backend

Desde `backend/`, con el entorno Python 3.12 y las variables de una PostgreSQL de pruebas:

```bash
python -m pip install -r requirements.txt
python -m pip check
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py spectacular --validate --fail-on-warn --file /tmp/agronexus-openapi.yml
python -m pytest
```

Con el Compose de desarrollo utiliza `docker compose run --rm --no-deps web` antes de cada comando Python, con `db` saludable. Pytest crea su propia base `test_...`; el usuario de conexión necesita permiso para crearla. No utiliza la base de operaciones como base de tests.

SQLite permite una comprobación rápida, pero las pruebas de bloqueos, concurrencia y restricciones específicas de PostgreSQL se omiten con un motivo explícito. Un resultado SQLite correcto no verifica esas garantías.

La suite comprueba sesiones revocables, límites de peticiones, roles e IDOR, catálogo, historial y transacciones de compra, concurrencia de carrito y checkout, envíos por vendedor, cancelaciones, recepciones, inspecciones, stock y reembolsos. También verifica migraciones históricas y sus protecciones de reversión. Las pruebas administrativas comprueban listas, campos editables, alta comercial con acceso real al portal y protección del último administrador bajo concurrencia. Las pruebas de medios comprueban contenido, tamaño, propiedad, imagen principal, reemplazo y borrado, tratamiento de fallos y referencias históricas.

## Frontend

Desde `frontend/`, con Node.js 24 actualizado:

```bash
npm ci
npm run quality
npm audit
npx playwright install --with-deps chromium
npm run e2e
```

`quality` ejecuta ESLint con cero advertencias permitidas, TypeScript, Vitest y build. Las pruebas de componentes cubren estados de carga, error y reintento, validación de formularios, cambios de cuenta, rutas y respuestas tardías. Incluyen métricas anidadas no nulas, rankings y montos distintos para dashboards, alta comercial y reactivación de perfiles, y archivos con `FormData`, revisión tras un resultado ambiguo y creación de producto sin duplicarla al reintentar una subida. Simulan respuestas de API y por sí solas no prueban la integración con Django.

El E2E público comprueba navegación de escritorio y móvil, acceso directo a rutas, formularios y protección de rutas. Puede ejecutarse sin una API y contiene una omisión explícita de un recorrido duplicado en móvil.

## Navegador contra Django real

El job `Marketplace against Django` crea una PostgreSQL efímera, aplica migraciones, carga `seed_demo` e inicia Django en `127.0.0.1:8001`. El frontend se compila con `VITE_API_BASE_URL=http://127.0.0.1:8001/api/v1` y se sirve en `127.0.0.1:4176`, permitido por CORS.

`npm run e2e:auth` ejecuta `frontend/e2e-auth`. La [guía del frontend](../frontend/README.md#marketplace-e2e-con-backend-real) explica cómo preparar una base local aislada. Las pruebas crean cuentas, productos, pedidos y cambios administrativos; no apuntes esta suite a una base de uso real. Las cuentas demo son exclusivamente de prueba.

Si 8001 está ocupado, `AUTH_E2E_API_BASE_URL` permite indicar otro backend. `VITE_API_BASE_URL` debe usar la misma URL al compilar. La versión de Chromium debe coincidir con Playwright; después de actualizar dependencias vuelve a ejecutar su comando de instalación.

| Suite | Comportamiento que verifica |
|---|---|
| `sessions.spec.ts` | Login, rotación, rechazo de refresh consumido, logout con revocación, otro dispositivo, coordinación de pestañas, respuestas tardías y cierre sin red |
| `checkout.spec.ts` | Catálogo → carrito → revisión → compra, método canónico, dirección histórica, reintento sin duplicar stock o pago, cambio de precio y recuperación de respuesta perdida tras recargar |
| `administration.spec.ts` | Cifras de dashboards contra la API, edición de productos, alta comercial, visibilidad, carga de imágenes, descarga de PDF y lectura de pedidos, pagos y envíos |
| `aftersales.spec.ts` | Compra con dos vendedores, cancelación en tránsito, recepción, inspección con unidades aptas y defectuosas y reembolso; recuperación tras perder respuestas sin duplicar stock o reembolsos |

Las pruebas de sesiones inyectan un `401` o demoran una respuesta para reproducir carreras sin esperar el vencimiento real del token. La emisión, renovación y revocación se realizan contra Django. La compra con respuesta perdida deja que Django confirme la operación y bloquea únicamente la respuesta al navegador, antes de recuperar el mismo pedido. La prueba de posventa aplica el mismo principio a inspección y resolución: las mutaciones de negocio pasan por la UI y Django, y después se consultan los registros para comprobar stock, eventos e importes. La preparación de usuarios y productos usa la API sobre esa base efímera.

## Docker, OpenAPI y dependencias

La CI construye la imagen de desarrollo y comprueba migraciones y descubrimiento de `audit_aftersales`. También construye las dos imágenes de producción y comprueba Nginx con TLS y una base temporal, según [despliegue](despliegue.md#validación-de-las-imágenes-en-ci). Su ensayo de CI escribe archivos de prueba, comprueba sus bytes y cabeceras, recrea ambos contenedores conservando los volúmenes y repite las comprobaciones de persistencia. Utiliza ajustes locales y SQLite; no constituye un ensayo de cobro real, PostgreSQL externo con SSL ni restauración de respaldos. El script `ops/smoke.sh` para una instalación existente mantiene sus consultas de solo lectura.

OpenAPI se exporta y valida con `--fail-on-warn`. La CI instala los pins Python, ejecuta `pip check` y los audita con `pip-audit` en un entorno de herramientas separado. npm audita el lockfile completo, incluidas las dependencias de desarrollo, con umbral `moderate`. Los avisos de seguridad pueden cambiar sin cambios en el repositorio y requieren revisar una actualización; no deben resolverse mediante versiones forzadas sin pruebas.

## Aceptación de una instalación

Después de actualizar ambos servicios, realiza el [recorrido de aceptación de v1.0](cierre-v1.md#recorrido-de-aceptación). Antes de publicar, prueba subida y persistencia de media, PostgreSQL con SSL, dominios, TLS, respaldos y restauración en la infraestructura elegida. Conserva el commit probado, los resultados y el entorno de ejecución junto al registro de la entrega. Las suites automáticas cubren casos concretos; una ejecución satisfactoria no garantiza ausencia de errores en cualquier entorno.
