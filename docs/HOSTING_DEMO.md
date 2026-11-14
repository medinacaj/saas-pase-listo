# Publicar PaseListo en un hosting — paquete seguro de demostración

**Este paquete permite probar cartelera, fichas y confirmaciones SIMULADAS. No permite vender entradas, cobrar dinero, emitir tickets/QR válidos, registrar compradores reales ni administrar eventos de terceros con permisos privados.**

## Hosting HTML/cPanel

1. En GitHub Actions, ejecutar el flujo «PaseListo - paquete portable DEMO (sin desplegar)» en la rama preparada.
2. Descargar el artefacto `paselisto-demo-hosting` de una ejecución aprobada y descomprimirlo.
3. Subir su contenido a la carpeta web del subdominio o sitio (por ejemplo `public_html`), conservando las rutas `src`, `assets/event-art` y `data`.
4. Activar HTTPS y comprobar la portada y una ficha `evento.html?id=...` en navegador.
5. **No subir el repositorio completo:** no publicar `server/`, `db/`, `.local/`, `.env`, `tests/` ni `.git/`.

## Vercel

Con una cuenta y proyecto autorizados, conectar la rama preparada y utilizar `vercel.json` para generar `dist/`. Probar en Preview antes de asignar un dominio. Vercel no convierte automáticamente los servidores Node que escuchan en 127.0.0.1 en APIs serverless.

## Límites de este despliegue

- El Centro de Control incluido es una pantalla DEMO local del navegador, no administración protegida.
- Los ejemplos de eventos reales son solo referencias; no existe contrato de venta de entradas ni precios válidos de terceros.
- El backend experimental de compradores, PostgreSQL, pagos y control de aforo no están conectados a este paquete.
- No se procesan tarjetas, entradas válidas ni información personal real.
- Para ventas comerciales faltan cuentas administradoras verificadas/MFA, backend seguro permanente, base PostgreSQL dedicada, reservas temporales, pagos autorizados, conciliación, QR antifraude, backups, contratos y revisión legal.

El desarrollo origen está en [PR #2](https://github.com/medinacaj/saas-pase-listo/pull/2). No fusionar como producto de ventas sin superar sus bloqueos.
