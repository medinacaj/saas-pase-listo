# Requisitos SaaS — Venta de boletos para eventos (#21)

> **Decisión de producto:** herramienta SaaS comercial independiente, aprobada el 9 de noviembre de 2026.  
> **Estado actual:** MVP local de demostración v0.1 en PR (CI de reglas aprobada); aún sin autenticación, base de datos, pagos, clientes reales ni producción.  
> **Ubicación actual:** repositorio de producto verificado `medinacaj/saas-pase-listo`; primera implementación propuesta en https://github.com/medinacaj/saas-pase-listo/pull/2.

## Principios comunes obligatorios
1. Arquitectura SaaS multicliente: organización/operador independiente por cliente con aislamiento de datos efectivo en backend, BD, archivos, reportes y QR.
2. Registro, onboarding e invitaciones; usuarios, roles, MFA acorde al riesgo, revocación y recuperación segura.
3. Planes y suscripciones con límites de uso, facturación del *servicio SaaS*, estados de alta/renovación/suspensión/cancelación; distinguir estos cobros de las operaciones comerciales de cada cliente.
4. Panel independiente del cliente y consola administrativa de la plataforma con separación de privilegios.
5. Auditoría, backups con restauración probada, seguridad, monitorización, protección de datos, exportación y retención/borrado de información.
6. Pruebas automatizadas con **dos clientes independientes** y pruebas negativas de acceso cruzado, concurrencia y permisos. CI, migraciones y puertas de lanzamiento.
7. Integrar pagos solo con operadores/proveedores autorizados cuando corresponda. No asumir custodia de fondos, aprobación regulatoria, acceso a operadores externos ni comercialización ya existente.

## Política de implementación
- Preparar arquitectura y MVP con datos sintéticos, diseñar hitos incrementales y contrastar demanda/precios con clientes reales antes de inversión importante.
- Toda funcionalidad es **prevista** hasta verificarla en código y tests.
- El repositorio es actualmente **público**: no incorporar secretos, código sensible ni datos personales. Evaluar la visibilidad con el propietario antes de código propietario. No desplegar con datos reales, pagos activos ni usuarios externos sin revisión legal, privacidad y autorización.
- Conservar diferenciación entre estos dos negocios de boletería: pueden compartir componentes bajo licencia adecuada, pero **no** fusionarse como producto comercial.
- Repositorio independiente e issue de seguimiento existentes; conservar el vínculo histórico en mediOS y aplicar cambios por PR con CI, revisión y trazabilidad.

## Alcance comercial
- Clientes que pagan por la plataforma: **organizadores, productores y promotores de eventos/espectáculos**.
- Usuarios compradores de entradas: público asistente; no son la misma entidad facturable SaaS.
- Comercialización propuesta: suscripción por organizador y/o comisión por entrada, **sin afirmar rentabilidad validada**.

## Módulos previstos
1. Gestión de organizaciones/eventos, sedes, fechas, aforos, zonas y tipos de entradas.
2. Inventario de boletos, límites, reservas temporales y liberación segura de cupos.
3. Venta de entradas e integración de cobro con proveedor autorizado; reconciliación y gestión de devoluciones/cancelaciones.
4. Boletos digitales únicos con QR firmado/seguro y validación contra duplicados, incluidos intentos simultáneos de acceso.
5. Panel del organizador: ventas, cortes, reportes, invitados, personal de acceso y registro auditable.
6. Precios, promociones, impuestos/cargos de servicio y comunicación con el comprador; evaluar normativa aplicable.
7. Administración SaaS: contratación de planes, renovación, límites y suspensión sin pérdida impropia de datos.

## Condiciones específicas de aceptación
- [ ] Dos organizadores de prueba sin posibilidad de ver eventos, asistentes, órdenes, reportes o QR del otro.
- [ ] Disponibilidad, reservas y aforo mantienen coherencia bajo ventas concurrentes.
- [ ] QR de una entrada no puede reutilizarse; operaciones de check-in auditables con tolerancia a fallas definida.
- [ ] Reembolsos y pagos documentados y ejecutados únicamente por proveedor autorizado cuando corresponda.
- [ ] Estado técnico, seguridad, privacidad y requisitos de comercio de eventos verificados antes de comercializar.

## Fuera de alcance
- Venta de pasajes terrestres o marítimos: corresponde a Boletería Digital — Transporte (#22).


## Identificación del repositorio

Repositorio de producto: `medinacaj/saas-pase-listo`. Fuente histórica: `medinacaj/MediOS/docs/saas/BOLETOS_EVENTOS.md`. Estas instrucciones no demuestran funcionalidades implementadas.


## Evidencia de desarrollo inicial (2026-11-09)

- **PaseListo v0.1:** interfaz local con datos sintéticos, reglas de negocio y pruebas de dominio en [PR #2](https://github.com/medinacaj/saas-pase-listo/pull/2).
- CI Node 22 completado con resultado satisfactorio. Falta validación visual en navegador y pruebas de integración autenticada/concurrencia real.
- El estado de negocio sigue **no operativo**; los requisitos de seguridad, pagos, backend y SaaS multicliente de este documento continúan abiertos.


## Portal público editorial — actualización 2026-11-10

El producto incluye una portada de descubrimiento y fichas editoriales que **no se confunden con el SaaS transaccional del organizador**. Versión: https://medinacaj.github.io/saas-pase-listo/ . Se registró un catálogo curado de 14 eventos de Chile con fuente oficial primaria y enlaces de compra externos, filtros y favoritos locales. Las imágenes promocionales se enlazan a fuentes externas: sus derechos comerciales **no están verificados** y se requiere permiso antes de explotar el portal como negocio. Ver docs/PORTAL_PUBLICO_Y_FUENTES.md.

El backend Node.js local sirve pruebas de aislamiento y concurrencia monoproceso; no constituye SaaS ni se ejecuta en GitHub Pages. La compra real, las credenciales, la BD PostgreSQL y pagos autorizados siguen pendientes. RutaTicket mantiene su propia UX de operador y no debe compartir plantilla de portal cultural.
