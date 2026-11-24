# Cierre del MVP v1.0

La versión `1.0.0` consolidó el catálogo, la compra, la cuenta, el portal vendedor, la administración y la posventa con operaciones simuladas. Las mejoras posteriores están en el [historial de cambios](../CHANGELOG.md). Esta guía reúne el recorrido de aceptación y la receta de actualización con Docker.

## Alcance de la entrega

| Flujo | Resultado esperado |
|---|---|
| Dashboards | Cifras, rankings y ventas mensuales de la API; bruto, reembolsos y neto separados; error visible ante un contrato inválido |
| Alta vendedor | Rol y perfil comercial requeridos en una transacción; reactivación de perfil inactivo explícita; cuenta bloqueada permanece bloqueada |
| Productos y archivos | Crear una vez el producto y abrir su editor para imágenes/PDF; controlar propiedad, tipos, tamaños y principal |
| Compra e historial | Revisar cotización antes de confirmar, recuperar un intento sin duplicar compra y conservar la dirección original |
| Posventa | Cancelar en tránsito, recibir, inspeccionar, reponer solo unidades aptas y registrar el reembolso simulado sin duplicarlo al reintentar |
| Entrega técnica | Migraciones, tests, OpenAPI, builds y guías coherentes; archivos persistentes en los volúmenes previstos |

El rol logístico existe, pero no se incluye un portal de operador propio. Los pagos, reembolsos y movimientos de transporte continúan siendo simulados. Las integraciones reales, el alojamiento público y el escalado no son requisitos añadidos para cerrar este MVP.

## Actualizar con Docker desde PowerShell

Esta receta corresponde al Compose de desarrollo en `backend/`, con Docker Desktop iniciado y tu `.env.docker` existente. Comprueba el resultado de cada comando antes de continuar. Actualiza backend y frontend juntos.

Antes de cambiar el código, revisa la copia local. Desde la raíz:

```powershell
git status --short
git log -1 --oneline
cd backend
docker compose stop web
docker compose up -d --wait db
```

Detén además cualquier otro proceso que escriba en esa base. Conserva la versión anterior, una copia restaurable de PostgreSQL y todos los archivos `media`. Crea y comprueba el respaldo con [la receta de PowerShell](cancelaciones-devoluciones.md#actualizar-con-docker-desde-powershell); no basta con copiar solo la base, porque las imágenes y PDF se almacenan por separado. Si tienes cambios locales, guárdalos y revísalos antes del pull; no los descartes para forzar la actualización.

Cuando el PR esté revisado e integrado en GitHub y el respaldo esté disponible, desde `backend/`:

```powershell
cd ..
git switch main
git pull --ff-only
cd backend
docker compose build web
docker compose run --rm --no-deps web python manage.py audit_aftersales
docker compose run --rm --no-deps web python manage.py migrate --noinput
docker compose run --rm --no-deps web python manage.py check
docker compose run --rm --no-deps web python manage.py audit_aftersales
docker compose run --rm --no-deps web python manage.py spectacular --validate --fail-on-warn --file /tmp/agronexus-openapi.yml
docker compose up -d --wait web
```

Si la auditoría informa inconsistencias, conserva su salida y resuélvelas antes de reabrir escrituras. No ajustes importes, stock o reembolsos con SQL improvisado. Una base inicial sin esquema recibe el aviso correspondiente; `migrate` crea sus tablas. No ejecutes `makemigrations` para instalar una versión: aplica las migraciones ya versionadas.

Desde `frontend/`, con Node.js 24 actualizado:

```powershell
npm ci
npm run quality
npm audit
npm run dev
```

Ejecuta los comandos dentro de `frontend/`; no existe un proyecto npm en la raíz. No uses `npm audit fix --force` para resolver avisos sin revisar el cambio y sus pruebas. Si ejecutas Playwright después de actualizar sus dependencias, instala el Chromium asociado mediante `npx playwright install --with-deps chromium`.

## Migración de archivos y datos existentes

`products.0004_product_media` añade la referencia opcional a la ficha PDF y la restricción de una única imagen principal por producto. Conserva los archivos y filas de imágenes existentes y elige una principal de forma determinista cuando haya ninguna o varias. No inventa fichas PDF para productos antiguos ni cambia sus importes o stock.

La reversión de esa migración se rechaza si hay productos con referencias PDF, para no retirar silenciosamente el campo que las conserva. Las protecciones de compra y posventa anteriores siguen vigentes. Para retroceder después de operar con datos nuevos, restaura el respaldo completo y su versión de código; no fuerces una migración inversa ni borres referencias para hacerla pasar.

El alta comercial no convierte automáticamente todas las cuentas antiguas en vendedores operativos. En Usuarios, utiliza **Completar alta comercial** o **Reactivar perfil vendedor** cuando corresponda y confirma los datos. Una cuenta bloqueada necesita además su activación propia. El flujo autorizado de la API evita dejar un nuevo cambio de rol incompleto; no reemplaza la responsabilidad de las escrituras técnicas desde ORM o Django Admin.

`seed_demo` se reserva para bases de demostración aisladas. No uses `seed_demo --reset` sobre datos propios ni para resolver una actualización; crea una base nueva si necesitas repetir una demostración desde cero.

## Verificación técnica

En el entorno de desarrollo con PostgreSQL y permiso para crear la base de tests, desde `backend/`:

```powershell
docker compose run --rm --no-deps web python -m pytest
```

Pytest crea una base de tests separada. No uses credenciales de producción para esta comprobación. SQLite sirve para verificaciones rápidas, pero omite explícitamente las pruebas que necesitan funciones de PostgreSQL.

Para el frontend, `npm run quality` comprueba lint, tipos, componentes y build. `npm run e2e` comprueba navegación pública; `npm run e2e:auth` necesita una base demo aislada y Django preparado, según [frontend](../frontend/README.md#marketplace-e2e-con-backend-real) y [testing](testing.md). Esa suite cambia usuarios, productos y operaciones de prueba.

El PR debe tener sus checks aprobados sobre el commit que se integra. Guarda el identificador del commit, los resultados de las pruebas y el entorno utilizado como evidencia de aceptación. El número de pruebas puede cambiar; el resultado vigente está en los logs de esa ejecución.

## Recorrido de aceptación

Realiza este recorrido con cuentas y datos de prueba:

1. Entra como administrador, consulta las métricas y contrástalas con usuarios, productos y operaciones existentes. Un fallo de red debe mostrar error y reintento, sin cifras inventadas en cero.
2. Registra una cuenta de prueba y dale de alta como vendedor desde Usuarios. Completa el nombre comercial, ingresa con esa cuenta y comprueba que pueda utilizar el portal. Prueba también cancelar el alta y la reactivación explícita de un perfil inactivo.
3. Crea un producto, confirma que se abre su editor y añade dos imágenes válidas. Cambia la principal, el texto alternativo y el orden; borra una y comprueba el catálogo. Prueba un archivo inválido y verifica que el producto no se vuelva a crear.
4. Adjunta una ficha PDF válida, descárgala, reemplázala y retírala. Sin ficha, el catálogo no debe mostrar un enlace ficticio. Un vendedor no debe poder cambiar los archivos de otro.
5. Compra productos de dos vendedores. Revisa la cotización y confirma; verifica el stock y los envíos separados. Cambiar el precio exige otra revisión y recuperar una respuesta perdida debe devolver el mismo pedido.
6. Cambia la dirección del perfil y comprueba que el pedido conserve la dirección aceptada al comprar.
7. Lleva una parte de la compra a tránsito y solicita su cancelación como comprador. Recibe e inspecciona como vendedor, separa unidades aptas y defectuosas y completa la resolución administrativa. Verifica reposición solo de aptas, importe original conservado, reembolso simulado y estado independiente de la otra parte.
8. Revisa el resultado antes de repetir una operación cuya respuesta se haya perdido. La recuperación de compra y los reintentos de posventa cubiertos no deben duplicar stock, pedidos ni reembolsos.
9. En la instalación con volúmenes, recrea `web` y `proxy` conservando esos volúmenes y comprueba que las imágenes y fichas sigan disponibles.

## Criterio de cierre y publicación

El MVP puede darse por aceptado cuando el alcance anterior funciona en el entorno elegido, los checks del commit están aprobados y no quedan incidencias críticas conocidas de esos flujos. Una prueba satisfactoria no garantiza ausencia de errores en cualquier escenario futuro.

Una demo pública requiere además completar [despliegue](despliegue.md): PostgreSQL externo con SSL, dominios, TLS, almacenamiento y permisos, persistencia de archivos, supervisión y un ensayo de restauración de respaldo. El smoke de CI utiliza una SQLite temporal y ajustes locales, aunque construye las imágenes de producción y verifica TLS y persistencia de sus volúmenes; no acredita esa infraestructura externa.

La integración del PR prepara el código para la entrega. Publicar una release o etiqueta y escoger una licencia son decisiones separadas del autor; este bloque no crea una licencia ni anuncia un hosting existente.
