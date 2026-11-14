# Centro de Control PaseListo — estado y contratos de datos (14/11/2026)

## Diagnóstico corregido

El portal calcula la cartelera visible de referencias futuras con `posterUrl` HTTPS y descripción editorial de al menos 40 caracteres. El panel antes mostraba la métrica de eventos DEMO publicados como si representara eventos de tienda; adicionalmente tenía un fallo al intentar iterar `querySelector()` con `.forEach()`, lo cual interrumpía la inicialización de sus acciones.

Los módulos `src/catalog-ops.mjs`, `src/operations-dashboard.mjs` y `src/marketplace.mjs` comparten la misma regla de visibilidad. El panel ahora desglosa referencias visibles, referencias vencidas, fichas incompletas, eventos internos DEMO, estados y total combinado. La tienda y el panel muestran el mismo número de **referencias visibles**, no confunden referencias con inventario de venta.

## Módulos disponibles (solo demostración pública)

- Inventario unificado: búsqueda, filtros de estado/origen, ordenación y vistas tabla, tarjetas y calendario. Las referencias no permiten mutaciones comerciales; eventos ficticios se pueden pausar o reactivar **solo en este navegador**.
- Analítica: gráficos de distribución de referencias y estados, totales de pedidos/volumen **simulados**.
- Clientes: estado del módulo de compradores y listado de identificadores ficticios de órdenes locales, si existen. No hay datos personales ni cuentas productivas.
- Empresas: productores sintéticos ya existentes en la demostración, cuotas y participación teórica, sin contratos verdaderos.
- Proveedores: categorías de integración y servicios no contratados; no inventa proveedores.
- Base de datos: inventario explícito de fuentes JSON/localStorage y estado real de conectividad: **PostgreSQL no conectado al panel**.

## Puertas técnicas para pasar a sistema operativo

1. Autenticación privada de operadores con MFA y separación de permisos; las vistas administrativas públicas no deben utilizar ni revelar información confidencial.
2. PostgreSQL administrado con esquema versionado para empresas, clientes, proveedores, recintos, eventos, categorías, inventario, reservas, pedidos, pagos, liquidaciones, tickets y auditoría, con roles mínimos y aislamiento de datos.
3. API transaccional que permita al panel y a la tienda consultar **la misma fuente de datos**, no `localStorage`; pruebas de lectura/escritura e invalidación de cache.
4. Reglas claras por estado de evento: borrador, revisión comercial, aprobado, publicado, pausado, finalizado y cancelado. Ninguna referencia de terceros debe poder habilitar venta sin derechos y contratos.
5. Pagos autorizados, conciliación, reembolsos y emisión/validación de tickets QR con control de duplicados y límites de entrada, seguidos de pruebas E2E, backup/restore y revisión legal.

**No habilitar ventas ni recolectar información real de clientes en este panel.** La API Node instalada en Namecheap por el propietario actualmente es una prueba de conectividad, no administra compradores.
