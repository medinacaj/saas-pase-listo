# PaseListo · modelo de negocio B2B2C de ticketing

Actualización aprobada por el propietario: 10 de noviembre de 2026.

## Posicionamiento corregido

**PaseListo no es un portal de noticias ni un agregador de conciertos de terceros.** Es una infraestructura comercial para que productores, recintos y promotores contratados puedan publicar y vender entradas al público en la misma plataforma. Mantiene una estética editorial diferenciada, pero sirve a la venta, no a la derivación de tráfico a otras tiqueteras.

El flujo objetivo es:
1. Empresa firma contrato B2B y acredita identidad, derechos de publicación, relación con el evento/recinto y autorización para la venta.
2. Organizador configura evento, recintos, fechas, tipos de entradas, inventario, precio base, afiches autorizados y condiciones de cancelación.
3. Público descubre el evento en PaseListo y selecciona entradas.
4. Checkout presenta **precio final con cargos obligatorios visibles** (precio base + cargo de servicio + demás cobros aplicables debidamente definidos).
5. Pasarela autorizada confirma pago por webhook verificado e idempotente; entonces el backend transaccional emite entradas digitales seguras con QR validable y envía confirmación.
6. El organizador consulta ventas, conciliación, liquidaciones, reportes y validación de accesos en su panel privado.

## Modelo comercial configurable

Primero: **cargo por servicio por entrada**, aplicado al comprador y mostrado desde la selección. El productor controla el precio base. El contrato define porcentajes, monto fijo, promociones y si el cargo se reparte con el recinto. Esta participación debe modelarse separada de los costos de procesamiento bancario, impuestos, devoluciones y retenciones que correspondan, de acuerdo con el proveedor de pagos y la ley aplicable.

Otras vías sujetas a evaluación, no implementadas:
- **Alianzas y exclusividad con recintos** por plazos y alcances razonables; revisar libre competencia antes de exigir exclusividad o comprometer anticipos.
- **Planes B2B o cargos reducidos por volumen** cuando corresponda a segmentos de productores.
- **Precios dinámicos**, solo si el organizador los habilita bajo reglas claras y previamente informadas; precio confirmado no debe variar después de la aceptación del consumidor.
- **Reventa regulada** exclusivamente para boletos propios con verificación de titularidad y límites, antifraude, control normativo y anulaciones; no activarla por defecto.
- **Marketing y analítica**: informes agregados para las empresas; tratamientos de datos personales bajo finalidad, minimización, transparencia, base legal y consentimiento cuando se requiera. **No vender datos de compradores**.

## Código funcional de demostración

- Datos **100% ficticios**: `data/eventos-clientes-demo.json` incluye ocho espectáculos inventados de tres empresas sintéticas y sus recintos. El archivo anterior `data/eventos-editoriales.json` se mantiene solo como antecedente histórico en la rama de desarrollo, **no debe publicarse en la tienda comercial**.
- Tienda pública en `index.html` + `src/marketplace.mjs`: portada exclusiva, cartelera por productoras ficticias, ficha comercial con tipos de entradas, disponibilidad de prueba, total **CLP** con comisión desglosada, checkout y confirmación de **PEDIDO SIMULADO** sin pagar.
- Panel comercial en `organizador.html` + `src/gestion.mjs`: elige organización ficticia, publica eventos de prueba, configura precios, cupo y afiche opcional con declaración de derechos, muestra pedidos, métricas y ejemplo de reparto de cargo. **No hay autenticación; el selector es demostrativo.**
- `src/commerce-domain.mjs` calcula tarifa transparente y distribución del cargo; impide sobrepasar cupo en **un navegador** y restringe consultas por `organizerId` dentro de su API de dominio. Estado guardado en localStorage para demostración en el mismo navegador.
- Poster genérico tipográfico de muestra rotulado **EVENTO DEMO**; un organizador real debe aportar material propio con derechos de uso acreditados y revisión previa. No presentar afiches ajenos como propios ni espectáculos reales sin contratos.
- Servidor Node local de desarrollo previo en `server/` y su evolución experimental se mantienen aparte; **GitHub Pages no ejecuta backend ni autentica compradores**.

## Control de precios y derecho del consumidor chileno

El sitio deberá respetar información de precio total con cargos incluidos, stock disponible, responsabilidades, formas de contacto y política de cambios/reembolsos antes de iniciar operaciones. Fuentes públicas consultadas:
- SERNAC: https://www.sernac.gob.cl/portal/604/w3-article-65050.html
- SERNAC Artículo 30: https://www.sernac.cl/portal/609/w3-article-52753.html
- Referencia de condiciones de ticketing: https://www.ticketmaster.cl/static/terminos-y-condiciones/

La nueva normativa de protección de datos Ley 21.719 figura con entrada en vigencia diferida al 1 de diciembre de 2026 en el texto vigente de BCN, pero existe una iniciativa legislativa para postergarla. Se debe verificar el estado exacto al implementar: https://www.bcn.cl/leychile/Navegar?idNorma=1209272

**Las comisiones de demostración no incluyen cálculo fiscal, costos del adquirente ni una liquidación bancaria real.** Nunca presentar cifras simuladas como facturas o cobros.

## Ruta técnica para venta real

1. Frontend público B2C + consola del organizador B2B + consola de administración de PaseListo.
2. Registro de organizaciones verificadas, cuentas, MFA, roles y permisos separados por tenant.
3. PostgreSQL transaccional con restricciones de stock, compras concurrentes, reservas con expiración, órdenes idempotentes y antifraude.
4. Pasarela de pago autorizada con webhooks firmados, estado de órdenes por evento, conciliación, facturación y liquidaciones, devolución y chargeback.
5. Boletos firmados/QR dinámicos o seguros, validación atómica en puerta, dispositivo de control, escáner y revocación.
6. Política de inventario, colas de espera, límites anti-bots y protección frente a sobreventa.
7. Contratos B2B, derechos de propiedad intelectual, libre competencia, privacidad y protección al consumidor, luego pilotos controlados y aprobación de operación.

**La demo no recauda dinero, no reserva inventario real, no autentica vendedores ni emite boletos válidos.** No colocar datos personales reales.


## Corrección operativa: quién controla la plataforma (10/11/2026)

**PaseListo es el operador central y controla toda la ticketera**. Productoras, promotores y recintos son contrapartes comerciales B2B, **no usuarios propietarios de paneles de gestión por defecto**. El equipo autorizado de PaseListo administra publicación, stock, tarifas, pedidos, validación de entradas, conciliación y liquidaciones según el contrato. El portal público es la superficie de venta al comprador (B2C).

En el prototipo `admin.html` y `src/control.mjs` implementan una demostración central de operaciones de **todas las empresas a la vez**. `organizador.html` redirige a `admin.html`. Esta simulación es completamente pública y carece de login; en producción deberá exigirse backend autenticado con roles de propietario y operadores.

Para poblar visualmente el portal existen **seis eventos reales con afiches promocionales originales de terceros** de muestra, verificados en fuentes primarias pero no autorizados para vender ni con permiso comercial acreditado para los afiches. No hay precio, comisión ni inventario de PaseListo para ellos. Los ocho eventos ficticios sí permiten simular el checkout. Esta separación seguirá siendo obligatoria hasta la firma de acuerdos.
