# PaseListo — Ticketera centralizada de espectáculos

PaseListo es **la ticketera del propietario**, no un software de autoservicio para que cada productora administre su propia cuenta. El equipo de PaseListo negocia con productores y recintos, administra el catálogo, configura tipos de entradas y comisiones, opera los pedidos y dirige la recaudación y las liquidaciones mediante proveedores autorizados.

## Versiones web publicadas (demostración)

- [Portal público](https://medinacaj.github.io/saas-pase-listo/) — exploración de espectáculos, fichas, categorías y selección de entradas.
- [Centro de Control PaseListo](https://medinacaj.github.io/saas-pase-listo/admin.html) — interfaz **única y central** de administración de todos los eventos, productores, pedidos y tarifas.
- [Enlace antiguo de panel empresarial](https://medinacaj.github.io/saas-pase-listo/organizador.html) — redirige al Centro de Control.
- [Laboratorio técnico antiguo](https://medinacaj.github.io/saas-pase-listo/laboratorio.html) — antigua demo aislada.

**Este es un prototipo público y sin autenticación.** Cualquier persona puede abrir el «Centro de Control» y modificar su propia copia de datos de demostración en el navegador. **No hay acceso exclusivo, usuarios reales, fondos, asientos reservados ni entradas válidas.**

## Dos tipos de espectáculos, sin confundir permisos

1. **Referencias visuales reales:** seis espectáculos anunciados en Chile, con fechas verificadas y afiches promocionales de terceros enlazados externamente: Gorillaz, Fauna Primavera, Camila, Deep Purple, Cirque du Soleil / Alegría y 31 Minutos. Se usan únicamente para mostrar cómo lucirían fichas reales. **No hay contrato de venta con PaseListo, autorización comercial del afiche, precios o cupos nuestros.** Por eso **no tienen botón de compra**.
2. **Eventos de ensayo comercial:** ocho espectáculos y tres productores **inventados**. Estos muestran tipos de entradas y tarifas. El checkout solo se habilita con inicio de sesión verificado por servidor; GitHub Pages bloquea el pedido al no disponer de backend.

Los datos promocionales reales están en `data/eventos-reales-referencia.json` con sus `sourceUrl`, `posterSourceUrl` y `posterCredit`. No copiamos los archivos de afiches a GitHub y su uso comercial está pendiente de autorización. Si alguna imagen externa no carga, se muestra un fallback tipográfico.

## Centro de Control propio de PaseListo

- KPIs globales y distribución simulada de ingresos por venta.
- Catálogo de **todos los eventos** gestionados por PaseListo, con pausa/reactivación DEMO.
- Registro central de eventos ficticios y asociación al productor correspondiente.
- Gestión central de productores y recintos, contratos de ejemplo y participación de comisiones.
- Pedidos simulados de todas las organizaciones y anulaciones de prueba.
- Tarifas de servicio configurables para nuevos pedidos, con importes visibles en el checkout.
- Registro de actividad y lista de puertas de seguridad pendientes.
- Referencias de eventos reales con estatus **«No contratado»** y enlaces a fuentes oficiales (sin comercialización).

**No se ha implementado un panel privado para productores.** La relación B2B es administrada por PaseListo; los productores podrán recibir información y reportes mediante canales contractuales autorizados que se definirán posteriormente.

## Tecnología disponible

- Portal HTML/CSS/JS en `index.html`, `src/marketplace.mjs`, `src/commerce.css`, `src/portal.css`.
- Centro de control en `admin.html`, `src/control.mjs`, `src/control-domain.mjs`, `src/control.css`.
- Reglas de negocio DEMO en `src/commerce-domain.mjs`; los datos del catálogo y panel ficticio persisten en `localStorage` del mismo navegador. **Los pedidos de comprador ya no se escriben desde el navegador**. **No hay backend conectado al portal publicado.**
- API Node experimental en `server/marketplace-api.mjs`, con tokens de demostración por organización, idempotencia y archivo JSON local, **sin autenticación de propietario** y no desplegada públicamente. No utilizar para operaciones reales.
- Pruebas Node.js: `npm run check` (requiere Node 22+).
- Código de desarrollo en [PR #2](https://github.com/medinacaj/saas-pase-listo/pull/2); la rama `gh-pages` contiene solo assets públicos de demostración.

## Modelo de negocio y pendientes críticos

PaseListo firma acuerdos B2B con recintos o promotores y opera una ticketera centralizada. El organizador define precio base y condiciones contractuales; PaseListo puede cobrar cargos de servicio transparentes al comprador y repartirlos según cada acuerdo. Exclusividad, anticipos, precios dinámicos, reventa y analítica de compradores son iniciativas opcionales **pendientes de evaluación legal y comercial**, no funciones activas.

Para vender de verdad falta: control privado del propietario mediante autenticación y MFA, backend y PostgreSQL, inventario concurrente, reservas y expiración, pagos autorizados, conciliación/liquidaciones, QR firmado y antifraude, permisos comerciales de afiches, contratos con organizadores, derechos del consumidor y privacidad. No se venden datos personales.

Consulta también [Modelo de negocio](docs/MODELO_B2B2C.md) y [Requisitos SaaS](docs/REQUISITOS_SAAS.md).


## Regla obligatoria de compra: cuenta con correo y contraseña

**No se puede comprar como invitado ni utilizar alias ficticios.** El flujo correcto es:

1. Seleccionar un evento y tipo de entrada.
2. **Ingresar con correo electrónico y contraseña**, o crear una cuenta que quede verificada por el backend.
3. El servidor confirma una sesión vigente y solo entonces habilita el checkout.
4. Todo pedido se envía al servidor con la sesión asociada al comprador. El servidor revalida cantidad, tipo de entrada, cupo e idempotencia.
5. El envío de entradas reales, el pago, el restablecimiento de contraseña, verificación de correo y antifraude se incorporarán en la etapa productiva.

**GitHub Pages no dispone de un servidor de autenticación:** allí el usuario puede ver la interfaz de acceso, pero **no escribir credenciales ni completar un pedido**. No se almacena una contraseña en `localStorage`, no se inventan sesiones y no se ofrece el alias anterior.

### Pruebas locales de registro e ingreso

Con Node.js 22 o superior, ejecuta `npm run api:buyers` y abre **http://127.0.0.1:8082**. Solo utiliza un correo ficticio de pruebas y una contraseña exclusiva creada para la demo de al menos 12 caracteres; no uses contraseñas reales.

El servidor de prueba utiliza `scrypt` con sal aleatoria para derivar el hash de la contraseña, sesiones HttpOnly/SameSite con expiración, límites de intentos, comprobación de origen y escritura local en `.local/buyer-demo.json`. Los pedidos se vinculan al identificador de usuario de la sesión, no a un alias suministrado por el formulario.

**No es una solución productiva.** No tiene verificación de correo, recuperación de cuenta, MFA, cifrado TLS ni alta disponibilidad. PostgreSQL es opcional y experimental; no existe persistencia SQL productiva. No exponer el puerto a Internet ni usar datos reales. Para el despliegue definitivo, integrar autenticación administrada y una base de datos segura en un hosting de backend.


## Persistencia PostgreSQL experimental (solo DEMO local)

Existe una modalidad opcional con PostgreSQL para probar concurrencia de pedidos y sesiones compartidas entre varias instancias. **No es una solución productiva de boletería**: sus cuentas son ficticias y no cuenta con MFA, TLS público, verificación de correo, pagos, conciliación ni tickets válidos.

1. Usa Node.js 22+ y una base PostgreSQL **dedicada y descartable**. Instala dependencias mediante `npm install`.
2. Aplica **las tres migraciones en orden**: `psql "$PASELISTO_DEMO_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/001_demo_inventory_orders.sql`, después `psql "$PASELISTO_DEMO_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/002_demo_buyers_sessions.sql` y finalmente `psql "$PASELISTO_DEMO_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/003_demo_shared_login_limits.sql`. Se utiliza PostgreSQL 16 en CI.
3. Configura `PASELISTO_DEMO_DATABASE_URL` con la URL de conexión de esa base **de desarrollo**, sin compartir la contraseña.
4. Ejecuta `npm run api:buyers` y abre `http://127.0.0.1:8082`.

Sin `PASELISTO_DEMO_DATABASE_URL`, el servidor conserva el modo anterior `JSON` en `.local/buyer-demo.json`. Con PostgreSQL, **cuentas, hashes scrypt, sesiones (solo hash del token), pedidos e inventario** se almacenan en la base de desarrollo; no se crea un archivo JSON para compradores. **No existe una migración automática** entre ambos modos: las cuentas, sesiones y pedidos anteriores no se trasladan. No intercambies modos sobre datos que necesites preservar.

La modalidad PostgreSQL utiliza las tablas `demo_ticket_stock`, `demo_orders`, `demo_buyers`, `demo_buyer_sessions` y `demo_buyer_login_attempts`: el inventario se modifica dentro de la misma transacción que inserta el pedido, bloqueando la fila con `FOR UPDATE`, y una restricción única protege `(buyer_id, request_id)`. Los reintentos con la misma solicitud devuelven el registro anterior y las solicitudes distintas compiten por los cupos. **No modificar directamente `sold` ni `capacity` en entornos reales**; los cambios de aforo requieren un flujo administrativo seguro aún no implementado.

Para correr las pruebas de integración con PostgreSQL se necesita la variable `PASELISTO_DEMO_DATABASE_URL`. Las pruebas **vacían las tablas DEMO** antes de ejecutarse; jamás usar una base con información que deba conservarse. GitHub Actions levanta un contenedor PostgreSQL descartable para esas pruebas.

**Limitaciones pendientes:** protección avanzada contra abuso (el límite por correo está compartido en SQL, pero no hay límites por IP/dispositivo ni servicio de gestión antifraude), verificación de correo, MFA, recuperación de cuenta, gestión autenticada de propietarios, pagos y conciliación, reservas con expiración, claves/QR firmados, controles tributarios y protección de datos. Esta etapa prepara operaciones SQL transaccionales pero no habilita ventas reales.


## Fichas individuales de eventos (cartelera pública)

Seleccionar cualquier tarjeta o el afiche destacado lleva a `evento.html?id=<ID>`. Cada ID único identifica una ficha que puede abrirse y compartirse directamente. Esto es una **ruta/página individual**, no un subdominio DNS. Para implementar `evento.paselisto.cl` (o subdominios por evento) sería necesario disponer de un dominio propio, DNS y un hosting compatible con wildcard hosts y certificados TLS; GitHub Pages no ofrece por sí solo ese comportamiento dinámico.

Las fichas muestran fecha, hora cuando esté confirmada, recinto, ciudad, organizador, descripción y condiciones de venta. Para eventos DEMO indican precios por categoría, cargo por servicio y total, y solo muestran un enlace a checkout si funciona el servidor local; en GitHub Pages los pedidos siguen bloqueados. Para espectáculos reales de referencia no se publican precios, aforos ni venta no autorizados, y se retiró el enlace externo «Ver fuente oficial de la fecha y recinto».

La sección de clima usa geocodificación y pronóstico por **ciudad** de Open-Meteo, con atribución. Solo consulta el pronóstico cuando la fecha está a 0–13 días en el futuro; para fechas posteriores avisa que aún no se dispone de una previsión fiable. No asume que el pronóstico municipal represente las condiciones de un recinto concreto. Las API públicas de Open-Meteo son para usos no comerciales bajo sus términos: evaluar una licencia comercial antes de lanzar el producto de pago.

Las fichas de eventos ficticios creados en `localStorage` únicamente se comparten con navegadores que tengan esa misma información guardada; un URL no publica un evento en una base de datos. En producción haría falta un catálogo público en el backend central y rutas estables asociadas a los IDs.


### Mapa cromático de zonas del recinto (DEMO)

En `evento.html?id=<ID>`, las fichas de eventos ficticios presentan un esquema del escenario y las categorías de entrada diferenciadas por colores. Cada sector y su leyenda son seleccionables: resaltan la categoría correspondiente en el desglose de tarifas y muestran el precio total por entrada. Se puede utilizar la leyenda con teclado y los sectores con Enter o Espacio.

**Importante:** el dibujo es **ilustrativo**, no un plano de butacas, un mapa geográfico, una garantía de ubicación ni una asignación de asientos. Ordena las categorías por precio de mayor a menor exclusivamente como referencia visual. Los eventos reales que se muestran como referencias no tienen un plano oficial verificado ni tarifas contratadas: en ellos aparece un esquema neutro de «sin plano verificado», sin fingir zonas, cupos o precios.

Para un uso comercial futuro debe existir una configuración de recinto aprobada por el organizador, con geometrías de sectores y categorías asignadas, accesibilidad, aforos reales y precios respaldados por el servidor, además de una revisión previa de publicación.


### Encabezado: eventos de la semana

La navegación pública muestra una franja compacta **«Esta semana»** bajo el menú principal, tanto en `index.html` como en `evento.html`. Usa las semanas de lunes a domingo y la fecha local de `America/Santiago`; muestra hasta cuatro eventos futuros o aún en curso, con enlace a su propia ficha y etiqueta explícita **Referencia** o **DEMO**.

Si no hay espectáculos esta semana, indica **«Sin eventos esta semana»** y ofrece los próximos del catálogo, sin presentar sus fechas como si fueran de la semana actual. La franja se calcula desde los datos existentes (sin eventos inventados) y es desplazable horizontalmente en móviles. La cartelera y el hero de inicio no se reemplazan. Su módulo es `src/week-events.mjs`.


#### Verificación del catálogo semanal (10/11/2026)

La primera franja semanal solo leía seis referencias de diseño y ocho eventos ficticios de 2027; por eso mostraba erróneamente «Sin eventos esta semana». Se añadieron **16 eventos reales de referencia** para el 10–15 de noviembre de 2026, contrastando fecha y recinto contra la cartelera de PuntoTicket (`https://www.puntoticket.com/Landing/ListadoEventosTodos`) y la cartelera regional TodoEnConce (`https://www.todoenconce.cl/panoramas/`). La agenda incluye espectáculos en Santiago, Valparaíso, Curicó, Concepción y Talcahuano.

El encabezado permite recorrer las referencias de la semana en una única fila horizontal. Los nuevos registros tienen IDs internos únicos, URL de la fuente, fecha de verificación y aviso de que **no existe contrato, inventario ni venta en PaseListo**. Para estos nuevos eventos se usan tarjetas tipográficas, sin copiar afiches promocionales ni publicar precios de terceros.

**Importante:** la comprobación se hizo en la fecha indicada, no es una sincronización automática ni una verificación futura de disponibilidad. Para operación real debe existir una ingesta periódica de eventos mediante fuentes autorizadas, revisión de modificaciones/cancelaciones y contratos comerciales antes de poner entradas a la venta.
