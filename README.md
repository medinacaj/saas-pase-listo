# PaseListo · Portal de espectáculos y SaaS para organizadores
## Estado actual — noviembre de 2026

**Frontend público editorial disponible en GitHub Pages:** https://medinacaj.github.io/saas-pase-listo/

- Portada de cultura en vivo con identidad independiente de RutaTicket; ficha y afiche promocional de eventos.
- **14 eventos referenciados** de fuentes oficiales en Santiago, Concepción, Valparaíso, Antofagasta y Pichilemu.
- Buscador, categorías, filtro de ciudad y fecha, favoritos locales, fichas con procedencia del cartel y enlaces a la venta oficial.
- Los carteles proceden de enlaces externos; su **licencia de reproducción comercial está pendiente de verificar**. No se presentan imágenes inexistentes como oficiales.
- Panel privado de demostración funcional disponible en https://medinacaj.github.io/saas-pase-listo/organizador.html; no tiene autenticación real.
- Backend experimental Node.js local en server/, con JSON en disco y pruebas HTTP; **no está desplegado ni conectado al portal GitHub Pages**.
- Para diseño, fuentes, derechos y criterios de lanzamiento consultar [PORTAL_PUBLICO_Y_FUENTES.md](docs/PORTAL_PUBLICO_Y_FUENTES.md).

**No somos vendedor ni representante de los eventos de terceros listados.** Las compras se realizan exclusivamente en sus respectivas páginas de venta oficial. No hay pasarela, tickets válidos, pagos ni venta operativa por PaseListo.

---

**Estado: primer MVP de demostración local (v0.1). No es un SaaS operativo ni un sistema de cobro habilitado.**

Interfaz web para productores/organizadores de eventos, independiente de RutaTicket (transporte). Mantiene el alcance aprobado en [requisitos SaaS](docs/REQUISITOS_SAAS.md).

## Disponible en esta primera entrega
- Panel de eventos para **dos organizaciones ficticias** con vista separada por organización.
- Alta de eventos sintéticos, aforo, precio referencial en VES y listado de eventos.
- Emisión y anulación de entradas DEMO con códigos de prueba y validación de acceso de un solo uso.
- Indicadores, actividad y mensajes de estado; vista adaptable a móviles.
- Pruebas de dominio de organización ajena, aforo, anulaciones y doble uso en una sesión.
- Sin servicios externos, dependencias de producción, anuncios, telemetría ni despliegue.

**Limitaciones importantes:** todos los datos existen únicamente en el almacenamiento local del navegador (solo en este dispositivo y sujeto a reinicio mediante el botón). El selector de organización **no es autenticación ni aislamiento SaaS real**. Sin control simultáneo entre dispositivos, pasarela, QR firmados, base de datos, cuentas, pedidos legales o tickets con validez comercial. No introducir datos reales.

## Ejecutar localmente

Requiere Python 3 y navegador actual:

```sh
python3 -m http.server 8080
```

Abrir **http://localhost:8080**. No abrir index.html con file:// por tratarse de módulos ES.

## Validar reglas

Requiere Node.js 20 o superior (sin npm install):

```sh
npm test
npm run check
```

El CI ejecuta las pruebas en PR y cambios en main. La interfaz no se ha verificado en un navegador real en esta entrega.

## Próximos hitos
Leer [Arquitectura y etapas](docs/ARQUITECTURA_Y_HITOS.md): autenticación segura, backend PostgreSQL/RLS, emisión atómica, QR firmado, cobros autorizados, suscripciones SaaS, privacidad y validación legal. No activar ventas ni desplegar comercialmente sin revisión y aprobación.


## Abrir la versión web desde GitHub (sin dominio)

**[Abrir PaseListo en GitHub Pages](https://medinacaj.github.io/saas-pase-listo/)**. GitHub Pages publicó el frontend de demostración a partir de la rama exclusiva `gh-pages`, sin incorporar `server/` ni datos privados.

La web funciona en el navegador, guarda únicamente datos **ficticios** en `localStorage` de ese dispositivo y permite restablecerlos. **No hay autenticación real ni sincronización entre dispositivos.** Usar alias inventados, nunca datos de compradores o pasajeros reales.

## API backend de desarrollo (Node.js, local; no disponible en GitHub Pages)

Se añadió un servidor HTTP funcional en `server/index.mjs` con:

- Endpoints JSON `/api/v1/health`, `/api/v1/snapshot` y operaciones de gestión/boletos según el producto.
- Autorización DEMO por token Bearer distinto para cada organización, sin aceptar el tenant indicado por el navegador.
- Mutaciones serializadas en un proceso Node.js, protección de doble uso/asiento y claves de idempotencia opcionales; persiste datos sintéticos mediante escritura atómica en `.local/`.
- Pruebas HTTP automatizadas, aislamiento de operadores y transacciones de demostración.

**No es un backend de producción:** usa JSON en disco en vez de PostgreSQL, tiene credenciales de desarrollo, no resuelve consistencia entre varios servidores, no admite cuentas reales ni cumple aún requisitos regulatorios de boletería. El frontend de GitHub Pages utiliza almacenamiento local y **todavía no consume esta API**, que queda preparada para la integración segura posterior.

Para usar el backend en tu ordenador, configura dos tokens aleatorios largos en `TICKETING_DEMO_KEYS` y ejecuta `npm run api:dev`. El servidor escucha **solo en 127.0.0.1:8080**. Consulta el ejemplo de configuración en [backend de desarrollo](docs/BACKEND_DESARROLLO.md).
