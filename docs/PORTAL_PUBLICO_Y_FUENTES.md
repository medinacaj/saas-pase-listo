# Portal público PaseListo — diseño, fuentes y derechos

Decisión de diseño: 10 de noviembre de 2026.

## Dos superficies independientes

- **Portal público:** index.html, src/portal.mjs y src/portal.css. Portada editorial, filtros de ciudad/categoría/fecha, búsqueda, favoritos del navegador, fichas con poster/promoción externa, fechas, recintos y enlace al canal de venta.
- **Panel de organizadores DEMO:** organizador.html, src/app.mjs y src/domain.mjs. Un gestor sintético de eventos y entradas de prueba. No vende entradas ni autentica clientes.

## Identidad frente a RutaTicket

PaseListo es un portal cultural editorial: tipografía expresiva, papel cálido, fondo tinta, acentos lima y coral, carteles de gran tamaño, navegación por fichas y sección destacada. No reutilizar el menú lateral ni la visualización de caja, asientos y salidas de RutaTicket. Ambos siguen siendo productos SaaS independientes.

## Datos y procedencia

El archivo data/eventos-editoriales.json guarda diez espectáculos publicados en Chile y consultados en noviembre de 2026. Cada registro conserva:

- Título, subtítulo, ciudad, recinto, género, categoría y fechas confirmadas.
- URL de fuente primaria (organizador, artista, espectáculo o ticketera).
- URL de venta externa verificada, sin atribuir venta a PaseListo.
- URL opcional de afiche promocional servido por su origen, fuente, crédito y estado de licencia.
- Sin precios ni stock no verificados, sin afirmaciones de alianza ni autorizaciones comerciales inexistentes.
- Los eventos finalizados dejan de aparecer en la cartelera principal según fecha de Chile.

Fuentes utilizadas:

| Evento | Fuente primaria |
|---|---|
| Gorillaz 4 dic. 2026 | https://dgmedios.com/proximos-shows/gorillaz-en-chile-2026 |
| Fauna Primavera 26–28 nov. 2026 | https://www.puntoticket.com/faunaprimavera |
| Cirque du Soleil Alegría 6–31 ene. 2027 | https://www.cirquedusoleil.com/es/chile/santiago/alegria/comprar-entradas |
| Camila 20 nov. 2026 | https://www.puntoticket.com/camila |
| Deep Purple 8 dic. 2026 | https://cdnp.puntoticket.com/deep-purple |
| Creamfields 14–15 nov. 2026 | https://www.puntoticket.com/todos |
| Edo Caroe 27–29 nov. 2026 | https://www.puntoticket.com/especiales |
| 31 Minutos 20 dic. 2026 | https://www.puntoticket.com/todos |
| Mägo de Oz 19–20 mar. 2027 | https://www.puntoticket.com/especiales |
| Karol G 28–31 ene. 2027 | https://www.puntoticket.com/todos |

## Uso responsable de afiches

Los carteles originales son obras promocionales de terceros. Publicación en una web ajena **no concede permiso de reproducción comercial**. El prototipo utiliza direcciones externas con créditos para una revisión editorial de diseño, no sube ni copia afiches a GitHub. Todos los permisos de explotación comercial constan como no verificados. Antes de abrir la plataforma comercial se requiere licencia del titular o material aportado y autorizado por cada organizador. Las imágenes externas pueden bloquearse o desaparecer; hay un reemplazo tipográfico rotulado de forma explícita: «CARTEL NO DISPONIBLE».

La versión actual no está afiliada a Ticketmaster, PuntoTicket, Ticketplus, Ticketpro, Passline, Fever ni promotores de la cartelera. No se vende, revende, reserva, cobra ni entrega entradas externas. Siempre dirigir al sitio oficial informado por el organizador. No copiar sus marcas, interfaz ni condiciones.

## Diferenciación de producto propuesta

- Ticketmaster/PuntoTicket: amplio inventario y transacción; PaseListo plantea descubrimiento editorial y fichas legibles.
- Ticketplus/Ticketpro/Passline: catálogo/servicio al productor; PaseListo separa el portal de público del panel SaaS del organizador.
- Fever: selección de experiencias; PaseListo combina música, festivales, familia, comedia y teatro con favoritos locales.

Lo anterior son **enfoques aspiracionales**, no una afirmación medida de superioridad.

## Antes del uso comercial

1. Incorporar organizaciones verificadas, alta de eventos propios y flujo de autorización de imágenes.
2. Backend PostgreSQL transaccional, roles y multi-tenancy real con pruebas de aislamiento.
3. Reserva y emisión de tickets con control concurrente, QR firmado y anti-replay.
4. Pagos y devoluciones mediante proveedores autorizados, impuestos, cargos y conciliación.
5. Backups, seguridad, privacidad, revisión legal, accesibilidad y pruebas reales de navegador.

La página gratuita GitHub Pages publica solo frontend y no ejecuta backend; la API Node local del proyecto es independiente.
