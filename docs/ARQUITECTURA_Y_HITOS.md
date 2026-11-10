# Arquitectura y etapas — PaseListo

## Estado verificado de este hito (v0.1)
- Interfaz web responsive (ES) para elegir organización sintética, ver eventos, crear evento, emitir/anular tickets de demostración, validar accesos de un solo uso y observar auditoría por organización.
- Motor de reglas en \`src/domain.mjs\` con aislamiento básico por \`tenantId\`, aforo y doble check-in en **una única sesión de navegador**. Tests en \`tests/domain.test.mjs\`.
- Cero cuentas, pagos, reservas reales, base de datos, firmas QR, datos personales reales o integración externa. Los cambios viven solo en memoria; refrescar restaura el estado.
- El selector de organizaciones permite cambiar libremente: **no es un control de autorización**.
- Uso recomendado: revisión funcional y UX con datos sintéticos antes de diseñar flujos definitivos.

## Arquitectura futura aprobada (no implementada)
1. Next.js/TypeScript y PostgreSQL siguiendo patrones y controles de Digi CRM, **sujeto a ADR y pruebas**. Migraciones versionadas, servicio autenticado y roles owner/admin/taquilla/lector.
2. Multi-tenancy real con \`organization_id\` en las tablas, autorización en servidor, RLS por tenant con rol limitado, operaciones con \`SET LOCAL\` en transacciones y pruebas de acceso cruzado.
3. Transacción de venta/reserva con cupos bloqueados, idempotencia, expiración y liquidación consistente; asegurar aforo también bajo concurrencia y múltiples instancias.
4. Pasarela autorizada con webhooks autenticados, conciliación, anulaciones y reembolsos. Separar claramente el pago del asistente de la **suscripción SaaS del organizador**.
5. Entradas de código único + QR con verificación criptográfica por backend, revocación y consumo atómico. El código PL-* de demo **no tiene seguridad de acceso real**.
6. MFA, invitaciones, niveles de permisos, administración SaaS, planes, límites, backups/restauración, auditoría, datos de compradores protegidos, privacidad y cumplimiento normativo venezolano y otros mercados autorizados.
7. Pruebas de dos organizadores, carga/concurrencia, accesibilidad, exportación segura, eliminación y retención de datos, incidentes y revisión legal antes de producción.

## Aceptación siguiente
- [x] Demo navegable y operaciones locales con validaciones básicas.
- [x] Casos de aislamiento entre dos organizaciones sintéticas cubiertos a nivel de dominio.
- [ ] Autenticación, backend PostgreSQL, autorización real y RLS verificadas.
- [ ] Reservas concurrentes y emisiones transaccionales verificadas.
- [ ] QR firmados y control de acceso sin reutilización bajo concurrencia.
- [ ] Pago autorizado, conciliación, suscripciones y permisos regulatorios verificados.
- [ ] Verificación visual de navegador, pruebas de accesibilidad, seguridad y backups; autorización de despliegue.

## Gobierno del código
Repositorio del producto independiente de RutaTicket. Mantener revisión humana mediante PR, ejecutar CI y evitar exposición de secretos. Este repo aparece público en GitHub al iniciar esta etapa: por tanto no incluir datos privados ni pretender que esté protegido por visibilidad. No cambiar visibilidad ni publicar nueva infraestructura sin autorización.
