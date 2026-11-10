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
2. **Eventos de ensayo comercial:** ocho espectáculos y tres productores **inventados**. Estos permiten recorrer el checkout DEMO (precio base + cargo por servicio + total), generar pedidos ficticios, modificar cupos y controlar comisiones en el mismo navegador.

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
- Reglas de negocio DEMO en `src/commerce-domain.mjs`; los datos ficticios solo persisten en `localStorage` del mismo navegador. **No hay backend conectado al portal publicado.**
- API Node experimental en `server/marketplace-api.mjs`, con tokens de demostración por organización, idempotencia y archivo JSON local, **sin autenticación de propietario** y no desplegada públicamente. No utilizar para operaciones reales.
- Pruebas Node.js: `npm run check` (requiere Node 22+).
- Código de desarrollo en [PR #2](https://github.com/medinacaj/saas-pase-listo/pull/2); la rama `gh-pages` contiene solo assets públicos de demostración.

## Modelo de negocio y pendientes críticos

PaseListo firma acuerdos B2B con recintos o promotores y opera una ticketera centralizada. El organizador define precio base y condiciones contractuales; PaseListo puede cobrar cargos de servicio transparentes al comprador y repartirlos según cada acuerdo. Exclusividad, anticipos, precios dinámicos, reventa y analítica de compradores son iniciativas opcionales **pendientes de evaluación legal y comercial**, no funciones activas.

Para vender de verdad falta: control privado del propietario mediante autenticación y MFA, backend y PostgreSQL, inventario concurrente, reservas y expiración, pagos autorizados, conciliación/liquidaciones, QR firmado y antifraude, permisos comerciales de afiches, contratos con organizadores, derechos del consumidor y privacidad. No se venden datos personales.

Consulta también [Modelo de negocio](docs/MODELO_B2B2C.md) y [Requisitos SaaS](docs/REQUISITOS_SAAS.md).
