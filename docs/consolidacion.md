# Actualizar el bloque de consolidación

Este bloque reúne confirmación de compra con cotización e idempotencia, historial de dirección, catálogo paginado, paneles administrativos conectados a la API, dependencias actualizadas y una plantilla de producción. Backend y frontend deben actualizarse juntos porque cambió el contrato de checkout.

Los pagos, reembolsos y movimientos de transporte siguen siendo simulados. Las pruebas cubren los casos implementados; no certifican ausencia universal de errores ni sustituyen una validación de infraestructura real.

## Antes de actualizar

Espera que los checks del PR terminen correctamente, revisa sus cambios e intégralo en GitHub. Conserva una copia restaurable de la base, archivos `media` y la versión de código anterior. Sigue [el procedimiento de respaldo](cancelaciones-devoluciones.md#actualizar-con-docker-desde-powershell). No ejecutes `seed_demo --reset` sobre una base con operaciones propias.

Desde la raíz del proyecto, en PowerShell:

```powershell
git status --short
git switch main
git pull --ff-only
```

Si hay cambios locales, revísalos y guárdalos en un commit propio o mediante `git stash push -u` antes de actualizar. No fuerces el pull ni descartes tus archivos para resolver un conflicto. El PR deja de versionar `node_modules`; las dependencias se regeneran con `npm ci` dentro de `frontend/`. No se reescribe el historial de Git.

## Backend con Docker de desarrollo

Desde `backend/`, con Docker Desktop iniciado y tu `.env.docker` existente:

```powershell
docker compose stop web
docker compose up -d --wait db
docker compose build web
docker compose run --rm --no-deps web python manage.py audit_aftersales
docker compose run --rm --no-deps web python manage.py migrate --noinput
docker compose run --rm --no-deps web python manage.py check
docker compose run --rm --no-deps web python manage.py audit_aftersales
docker compose up -d --wait web
```

Ejecuta cada comando y revisa su resultado antes de seguir. Si la auditoría detecta inconsistencias, conserva su salida y resuélvelas antes de reabrir escrituras. No corrijas stock o reembolsos con SQL improvisado. En la base inicial sin tablas, el comando de auditoría informa esa situación; las migraciones crean el esquema.

La migración de pedidos conserva `LEGACY_UNKNOWN` y una dirección histórica nula para compras anteriores. No reconstruye una dirección antigua a partir del perfil actual. Protege el historial operativo: para revertir una actualización con datos, restaura la copia y el código correspondiente en vez de forzar migraciones inversas.

Para verificar el backend en desarrollo:

```powershell
docker compose run --rm --no-deps web python -m pytest
docker compose run --rm --no-deps web python manage.py spectacular --validate --fail-on-warn --file /tmp/agronexus-openapi.yml
```

Pytest crea una base de tests y necesita permiso PostgreSQL para crearla. No uses credenciales de producción para esta prueba.

## Frontend

Desde `frontend/`, con Node.js 24 actualizado (mínimo 24.15):

```powershell
node -v
npm -v
npm ci
npm run quality
npm audit
npm run dev
```

`npm ci` utiliza el lockfile versionado y vuelve a instalar las dependencias de esa carpeta. No ejecutes `npm audit fix --force` ni actualizaciones independientes de versiones mayores para solucionar avisos: deben revisarse junto con el código y sus pruebas. Las auditorías informan vulnerabilidades conocidas en el momento de ejecutarlas; un aviso futuro requiere una nueva revisión.

Para ejecutar Playwright tras actualizar dependencias, vuelve a instalar la versión de navegador asociada: `npx playwright install --with-deps chromium`. Los E2E con Django requieren una base demo aislada; consulta [frontend](../frontend/README.md#marketplace-e2e-con-backend-real) y [testing](testing.md).

## Recorrido de aceptación

1. Como vendedor, crea y edita un producto; confirma categoría, región, marca opcional, estado y movimientos de stock.
2. Como cliente, revisa una compra antes de confirmarla. Cambiar un precio debe solicitar revisión. Recargar tras perder la confirmación debe permitir recuperar el mismo pedido.
3. Cambia la dirección del perfil y comprueba que el pedido conserve su copia original.
4. Como administrador, consulta usuarios, vendedores, productos, pedidos, pagos y envíos; un cliente o vendedor debe recibir rechazo de esos recursos.
5. Comprueba cancelación, recepción, inspección y reembolso. Las unidades defectuosas no deben volver al stock vendible.

La [plantilla de despliegue](despliegue.md) es independiente del Compose local. Requiere PostgreSQL externo con SSL, dominios, certificados, respaldos y supervisión. La elección de licencia permanece a cargo del autor; este bloque no concede una licencia nueva.
