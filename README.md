# PaseListo — Ticketera B2B2C para espectáculos y recintos

**Modelo de negocio:** empresas productoras, recintos y promotores contratan PaseListo para publicar espectáculos y vender entradas al público **en la propia plataforma**. PaseListo opera tecnología, distribución, cobro de cargos de servicio, emisión futura de boletos y control de acceso.

## Abrir las dos superficies web desde GitHub Pages

- **Tienda para compradores (demostración):** https://medinacaj.github.io/saas-pase-listo/
- **Consola B2B para organizadores (demostración):** https://medinacaj.github.io/saas-pase-listo/organizador.html
- Laboratorio técnico histórico de entradas: https://medinacaj.github.io/saas-pase-listo/laboratorio.html

**¡Importante!** Este prototipo es **100% ficticio**: ocho eventos inventados, tres organizadores sintéticos, afiches gráficos DEMO, tarifas y acuerdos ilustrativos. **No se cobran fondos, no se aceptan tarjetas, no se emiten entradas reales, no hay reservas ni autenticación segura.** Los datos se guardan en el localStorage del navegador y los cambios son visibles entre ambas páginas **solo en el mismo navegador/dispositivo**.

El portal no es un diario de eventos, un agregador de noticias ni un afiliado a otros vendedores. La lista anterior de espectáculos reales de terceros fue retirada de la versión web para evitar aparentar que existe un contrato con sus productores.

## Qué permite probar ahora

**Comprador:**
- Buscar eventos y filtrar por ciudad, categoría o fecha.
- Abrir ficha, consultar recinto, productor, fecha y tipos de entradas.
- Seleccionar hasta seis entradas ficticias, ver cupos demo y **precio final en pesos chilenos**, separando precio base y cargo de servicio.
- Ejecutar un **pedido de prueba** con alias ficticio, sin pagos, datos de tarjeta ni emisión válida.

**Productor o recinto:**
- Elegir una empresa **ficticia** en el panel empresarial (no es un login).
- Publicar un evento inventado con ciudad, recinto, fecha, categoría, aforo, precio y color del afiche. Puede incorporar URL de imagen propia indicando que tiene derechos, aunque la demo **no verifica** esas autorizaciones.
- Consultar pedidos simulados, métricas, tarifa de servicio y participación ilustrativa del recinto.
- Anular pedidos ficticios, que liberan inventario local.
- Probar toda la operación entre el panel y la tienda del mismo navegador.

**Tecnología:**
- Motor independiente de negocio en `src/commerce-domain.mjs`; tests de comisiones, inventario, aislamiento lógico y operaciones DEMO.
- **API Node.js de desarrollo** en `server/marketplace-api.mjs`: tokens separados por organizador, endpoints HTTP autenticados, archivo JSON local, idempotencia y serialización de transacciones **solo en un proceso**, con tests. No desplegada públicamente.
- Código y evidencia de pruebas en la solicitud de cambios [PR #2](https://github.com/medinacaj/saas-pase-listo/pull/2).

## Ejecutar localmente

Para visualizar solo la tienda y panel: con Python 3 ejecuta `python3 -m http.server 8080` y abre http://localhost:8080.

Para verificar la aplicación, con Node 22+: `npm run check`.

Para probar el **servidor local de comercio**, configura la variable `PASELISTO_DEMO_KEYS` como un objeto JSON con tres tokens aleatorios distintos de al menos 24 caracteres, bajo `org-aurora`, `org-escena` y `org-nexo`. Luego ejecuta `npm run api:commerce`. Escucha únicamente en `127.0.0.1:8081`; la tienda estática aún no está conectada a ese servicio.

El servidor anterior `npm run api:dev` conserva el laboratorio de tickets; no corresponde a ventas comerciales.

## Próximos hitos imprescindibles

1. Contratos B2B reales y validación de organizadores, recintos, derechos de afiches e identidad.
2. PostgreSQL + RLS, autenticación, MFA, permisos por empresa, inventario transaccional, reservas con expiración y multiinstancia.
3. Procesador de pagos autorizado con webhook firmado, idempotencia, reembolsos, conciliación, liquidaciones, impuestos y contabilidad verificables.
4. Emisión de entradas con QR firmado, transferencias/validación en puerta y prevención de reutilización.
5. Políticas de privacidad y consentimiento, protección al comprador, condiciones de espectáculo, cumplimiento legal y despliegue seguro.
6. Reservas, preventas, paquetes, promociones, mapas de asientos y analítica empresarial. Exclusividad, precios dinámicos y reventa solamente tras validación legal y de producto.

Consulta [Modelo B2B2C](docs/MODELO_B2B2C.md) y [Requisitos SaaS](docs/REQUISITOS_SAAS.md).

**GitHub Pages solo sirve frontend estático. No es hosting de backend comercial.** No introducir datos reales en esta demostración.
