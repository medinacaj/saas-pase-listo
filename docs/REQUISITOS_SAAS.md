# Requisitos SaaS — Venta de boletos para eventos (#22)

> **Decisión de producto:** herramienta SaaS comercial independiente, aprobada el 9 de noviembre de 2026.  
> **Estado actual:** concepto por validar; no se afirma implementación, base de datos, clientes, pagos ni producción.  
> **Ubicación actual:** especificación provisional en MediOS; el repositorio independiente de la herramienta no se ha identificado entre los repositorios GitHub accesibles. No crear ni asociar otro sin verificar la URL.

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
- Mantener el producto privado y no desplegarlo con datos reales, pagos activos ni usuarios externos sin evaluación legal, privacidad y autorización del propietario.
- Conservar diferenciación entre estos dos negocios de boletería: pueden compartir componentes bajo licencia adecuada, pero **no** fusionarse como producto comercial.
- Tras identificar el repositorio independiente correspondiente, trasladar allí este documento, abrir issue de ejecución y dejar en MediOS el vínculo histórico.

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
- Venta de pasajes terrestres o marítimos: corresponde a Boletería Digital — Transporte (#23).


## Identificación del repositorio

Repositorio de producto: `medinacaj/saas-pase-listo`. Fuente histórica: `medinacaj/MediOS/docs/saas/BOLETOS_EVENTOS.md`. Estas instrucciones no demuestran funcionalidades implementadas.
