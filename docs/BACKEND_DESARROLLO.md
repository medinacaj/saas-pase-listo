# Backend de desarrollo — PaseListo

**Uso exclusivo de pruebas locales con datos sintéticos. No utilizar para emisión ni venta real.**

## Arranque

Node.js 22 o superior. Desde la raíz del repositorio:

1. Genera **dos claves aleatorias diferentes de al menos 24 caracteres** y configura una variable de entorno `TICKETING_DEMO_KEYS` en formato JSON con las organizaciones del proyecto:

```sh
export TICKETING_DEMO_KEYS='{"org-andes":"REEMPLAZAR_CON_TOKEN_ALEATORIO_UNO_DE_32_CHARS","org-oriente":"REEMPLAZAR_CON_TOKEN_ALEATORIO_DOS_DE_32_CHARS"}'
node server/index.mjs
```

2. Abre http://127.0.0.1:8080 para ver el frontend estático. Este frontend sigue siendo **modo navegador**, independiente de la API. Para probar la API usa una herramienta HTTP y envía `Authorization: Bearer <token del tenant>`.
3. Comprueba `GET /api/v1/health` (sin token) y `GET /api/v1/snapshot` (token obligatorio).

## Endpoints

- `POST /api/v1/events`: `{title, venue, startsAt, capacity, price}`.
- `POST /api/v1/tickets`: `{eventId, alias}`.
- `POST /api/v1/checkins`: `{code}`.
- `POST /api/v1/cancellations`: `{code}`.

Todos los POST aceptan el encabezado opcional `Idempotency-Key` (8 a 128 caracteres) para responder al reintento sin repetir una operación. Si se reutiliza con otro cuerpo, se rechaza con 409. El registro se mantiene en el JSON del servicio (máximo 2000 operaciones guardadas).

## Datos y límites

Los datos de desarrollo viven en `.local/` (excluida de Git), se escriben a un archivo temporal y luego se renombran. Las mutaciones se serializan **en un proceso único**: esto no equivale a transacciones multiinstancia, HA, bloqueo SQL ni un sistema comercial. No hay HTTPS ni recuperación de credenciales; el servidor solo escucha en loopback. No usar nombres de pasajeros reales, datos bancarios, documentos tributarios ni pasarela.

## Pruebas

```sh
npm run check
```

Incluye casos HTTP de autenticación por organización, aislamiento, operaciones concurrentes en un proceso y cierre/check-in según la plataforma. La vista Pages y la API tienen estados distintos: no sincronizan ni deben confundirse.
