# Sesiones, renovación y cierre de sesión

Cada inicio de sesión crea una `AuthSession` independiente. Los tokens de acceso y de renovación contienen su identificador UUID en el campo `sid`. El servidor guarda el identificador de la sesión, el JTI del refresh vigente, su vencimiento absoluto y su revocación; no guarda tokens completos ni debe escribirlos en los logs.

## Contrato de autenticación

Todas las rutas siguientes usan el prefijo `/api/v1/` y JSON.

| Método y ruta | Entrada | Resultado |
|---|---|---|
| `POST /auth/login/` | `email`, `password` | `200` con `access` y `refresh`; crea una sesión. |
| `POST /auth/refresh/` | `refresh` | `200` con un nuevo `access` y un nuevo `refresh`; consume el refresh anterior. |
| `POST /auth/logout/` | `refresh` | `204` sin cuerpo al revocar esa sesión, incluso si ya estaba revocada. |
| `GET /users/me/` | Cabecera `Authorization: Bearer <access>` | Datos del usuario si el token y la sesión siguen siendo válidos. |

Login, refresh y logout no necesitan un access token previo. En refresh y logout, la credencial requerida es el refresh enviado en el cuerpo. Un token de otro tipo, manipulado o vencido no es una credencial válida.

Un access token firmado también debe pertenecer a una sesión existente, no revocada y no vencida. Esta comprobación se realiza al autenticar cada nueva petición a la API. Por eso cerrar sesión invalida tanto los siguientes usos del access como los del refresh de esa sesión, aunque todavía no haya vencido su JWT. Las peticiones que ya estaban ejecutándose no se deshacen.

Cada login tiene una sesión distinta: cerrar una no cierra otras abiertas mediante otro inicio de sesión. La sesión dura como máximo siete días desde su creación; renovar tokens no desplaza ese límite. Después del vencimiento absoluto hay que volver a ingresar.

Si administración cambia la contraseña del usuario, los access y refresh emitidos con la contraseña anterior dejan de ser aceptados para acceder o renovar, en todas sus sesiones. Esta comprobación usa `CHECK_REVOKE_TOKEN` y también se aplica antes de rotar un refresh. Las filas de `AuthSession` pueden conservarse hasta su vencimiento aunque aquellos tokens ya no permitan autenticar. Un refresh anterior firmado y no vencido todavía permite solicitar logout de su propia sesión; no permite obtener tokens nuevos.

## Rotación y reintentos

El refresh es de un solo uso. El servidor bloquea la fila de la sesión durante la validación y la rotación de su JTI, de modo que dos renovaciones simultáneas no puedan consumir el mismo refresh con éxito. El cliente debe conservar el nuevo par de tokens y dejar de usar el anterior. Repetir un refresh consumido devuelve `401`; no se debe iniciar un bucle de reintentos.

Logout acepta un refresh anterior que haya sido rotado, siempre que su firma, tipo, vencimiento y relación con la sesión sean válidos. Esto permite cerrar la sesión si una renovación acababa de completarse en otra petición. No habilita ese refresh para renovar nuevamente. La revocación se gestiona mediante `AuthSession` y el JTI vigente, sin depender de la aplicación de blacklist de Simple JWT.

El frontend coordina las renovaciones entre pestañas del mismo origen mediante Web Locks cuando el navegador los ofrece. Esta API requiere un contexto seguro, como HTTPS o localhost. También vuelve a leer los tokens después de esperar al bloqueo. En navegadores sin Web Locks, una renovación simultánea entre pestañas puede terminar solicitando un nuevo login; el servidor mantiene la regla de un solo uso.

## Cierre desde el navegador

Al pulsar cerrar sesión, la aplicación borra inmediatamente las credenciales locales y solicita la revocación al backend. Una respuesta tardía de login o refresh no debe restaurar una sesión que el usuario ya cerró.

Si la petición de logout falla por desconexión u otro error de red, el navegador queda desconectado localmente y muestra un aviso. Eso no confirma la revocación en el servidor: no se puede prometer que una copia del token haya dejado de funcionar hasta que el backend reciba y procese el cierre, o hasta que venza la sesión.

## Límites de peticiones

Los endpoints de autenticación aplican estos límites y devuelven `429` cuando se supera el correspondiente umbral:

| Operación | Límite |
|---|---|
| Login por IP | 30 por minuto |
| Login por correo normalizado | 5 por minuto; la clave de caché usa un hash del correo. |
| Refresh por IP | 60 por minuto |
| Registro por IP | 10 por hora |
| Logout por IP | 60 por minuto |

En desarrollo se utiliza `LocMemCache`: sus contadores pertenecen a cada proceso y se pierden al reiniciarlo. No constituyen un límite compartido entre varios workers o contenedores. Un despliegue con varias instancias debe configurar una caché compartida y definir correctamente qué proxies son de confianza antes de basar límites en la IP. Estos límites de aplicación no sustituyen la protección del proxy ni garantizan protección total ante una denegación de servicio.

Los throttles de autenticación usan explícitamente `REMOTE_ADDR` e ignoran `X-Forwarded-For`. Cambiar solamente `NUM_PROXIES` no modifica este comportamiento. Si la aplicación está detrás de un proxy, se debe configurar una estrategia de IP de confianza o aplicar el límite correspondiente en ese proxy; de lo contrario sus usuarios pueden compartir la misma cuota.

## Actualización de una instalación existente

La primera actualización a esta versión exige volver a iniciar sesión: los tokens emitidos antes del cambio no incluyen `sid` y se rechazan. No se convierten tokens antiguos en sesiones nuevas ni se deben copiar tokens a la base para conservarlos. La migración crea el almacenamiento de sesiones; los siguientes logins generan sus registros.

Para actualizar con Docker y PowerShell, seguir la [receta de actualización controlada](cancelaciones-devoluciones.md#actualizar-con-docker-desde-powershell): verificar y actualizar el checkout conservando cambios propios, detener escrituras, respaldar la base, construir la imagen, ejecutar auditoría y migración con comandos explícitos y comprobar el resultado antes de iniciar `web`. El nombre del servicio es `web`; un `python` escrito directamente en PowerShell utiliza el Python de Windows.

La auditoría `audit_aftersales` sigue siendo válida antes de migrar. No es necesario que existan ya las tablas nuevas para que Django descubra el comando; si aparece `Unknown command`, revisar primero el archivo local y las aplicaciones registradas.

Después de actualizar:

1. Iniciar sesión y consultar el perfil.
2. Renovar una vez y comprobar que el refresh anterior ya no renueva.
3. Cerrar sesión y comprobar que el access y el refresh de esa sesión reciben `401` en nuevas peticiones privadas o de renovación.
4. Probar el cierre sin conexión y verificar que la interfaz informa que no pudo confirmar la revocación remota.
5. Con dos sesiones abiertas del mismo usuario, cambiar su contraseña desde Django Admin y comprobar que los access y refresh anteriores de ambas sesiones reciben `401` al acceder o renovar. Verificar que es posible iniciar sesión con la contraseña nueva y cerrar las sesiones anteriores con sus refresh firmados aún no vencidos.
6. Ejecutar la suite del backend y `npm run quality` en el frontend; las carreras entre peticiones requieren PostgreSQL para verificar bloqueos reales.

No pegar tokens, contraseñas ni archivos de entorno completos en incidencias, capturas o registros de pruebas.
