# PaseListo · SaaS de boletería de eventos

**Estado: primer MVP de demostración local (v0.1). No es un SaaS operativo ni un sistema de cobro habilitado.**

Interfaz web para productores/organizadores de eventos, independiente de RutaTicket (transporte). Mantiene el alcance aprobado en [requisitos SaaS](docs/REQUISITOS_SAAS.md).

## Disponible en esta primera entrega
- Panel de eventos para **dos organizaciones ficticias** con vista separada por organización.
- Alta de eventos sintéticos, aforo, precio referencial en VES y listado de eventos.
- Emisión y anulación de entradas DEMO con códigos de prueba y validación de acceso de un solo uso.
- Indicadores, actividad y mensajes de estado; vista adaptable a móviles.
- Pruebas de dominio de organización ajena, aforo, anulaciones y doble uso en una sesión.
- Sin servicios externos, dependencias de producción, anuncios, telemetría ni despliegue.

**Limitaciones importantes:** todos los datos existen únicamente en memoria del navegador y se pierden al refrescar. El selector de organización **no es autenticación ni aislamiento SaaS real**. Sin control simultáneo entre dispositivos, pasarela, QR firmados, base de datos, cuentas, pedidos legales o tickets con validez comercial. No introducir datos reales.

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
