# 💳 habitat-ms-payments-soa — Finanzas SOA, Clientes Cross-Platform y Outbox EDA (`RabbitMQ`)

Microservicio de liquidación financiera, padrón de clientes B2B y mensajería asíncrona:
- **Contratos SOA (`/soa/contract/settlement-policy`)**: Liquidación automática 85% neto al anfitrión y 15% comisión de plataforma.
- **Clientes Cross-Platform (`/api/v2/clientes`)**: Búsqueda e inscripción idempotente por correo o cédula/pasaporte.
- **Transactional Outbox Worker**: Publicador automático hacia **RabbitMQ (`CloudAMQP` — `booking.events`)**.

