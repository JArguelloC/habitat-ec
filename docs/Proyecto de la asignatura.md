# **Proyecto de la asignatura: Booking Prototipo** 

# **1. Nombre del proyecto** 

**Booking Prototipo: plataforma de integración multi-sistemas con enfoque APIfirst, microservicios y experiencia web/móvil** 

# **2. Descripción general del proyecto** 

El proyecto integrador de la asignatura consiste en el diseño, desarrollo, despliegue e integración de un ecosistema digital tipo **marketplace** , denominado **Booking Prototipo** , inspirado en plataformas como Booking, pero adaptado al contexto académico de la materia de **Integración de Sistemas** . 

La propuesta contempla la construcción de un entorno compuesto por varios **sistemas de información independientes** , desarrollados por los estudiantes, y una plataforma central denominada **Booking Prototipo** , administrada por un grupo específico de estudiantes responsables de la integración global. 

Cada estudiante desarrollará su propio **sistema de información orientado a ventas** , el cual deberá incluir obligatoriamente: 

- un **sistema de administración** ; 

- una **página tipo marketplace** para publicación, consulta y venta de productos o servicios; 

- un conjunto de **APIs preparadas para interoperar** con otros sistemas; 

- despliegue público en Internet para su validación y presentación. 

De manera paralela, un grupo de **cuatro estudiantes** asumirá el desarrollo del sistema central **Booking Prototipo** , que también contará con: 

- un **módulo de administración** ; 

- una **interfaz tipo marketplace** ; 

- las capacidades de integración necesarias para consumir e interoperar con los sistemas de información construidos por sus compañeros. 

Durante el desarrollo del proyecto, los estudiantes deberán evolucionar desde una arquitectura inicial centrada en APIs y despliegue web, hacia una arquitectura basada en **microservicios** , integración síncrona y asíncrona, contratos, seguridad, observabilidad, resiliencia e interoperabilidad, culminando con una experiencia móvil en **Flutter** o **React Native** , según sorteo. 

# **3. Propósito formativo del proyecto** 

Este proyecto busca que el estudiante aplique de manera integrada los conocimientos de la asignatura para diseñar soluciones interoperables, escalables y desplegables en entornos reales, poniendo en práctica principios de: 

- **Integración de sistemas** ; 

- **API-first** ; 

- **REST, gRPC y GraphQL** ; 

- **SOA, ESB, EDA y microservicios** ; 

- **API Gateway y contratos de integración** ; 

- **seguridad en integraciones** ; 

- **pruebas, observabilidad y resiliencia** ; 

- **interoperabilidad multi-dominio** ; 

- **despliegue web y móvil** . 

El proyecto no se limita a construir interfaces, sino que exige diseñar una solución técnicamente consistente, con una evolución arquitectónica alineada a los contenidos del sílabo. 

# **4. Organización general del proyecto** 

# **4.1. Estructura colaborativa** 

El curso trabajará sobre un ecosistema común compuesto por dos niveles: 

# **a) Sistemas de información individuales** 

Cada estudiante desarrollará un sistema de información propio, enfocado en la comercialización de productos o servicios mediante una página tipo marketplace. 

# **b) Sistema central Booking Prototipo** 

Cuatro estudiantes serán responsables del desarrollo del sistema integrador central, denominado **Booking Prototipo** , cuya función será centralizar, consultar, mostrar e integrar la información de los diferentes sistemas desarrollados por sus compañeros. 

# **4.2. Condiciones obligatorias** 

Todos los sistemas, tanto individuales como el Booking Prototipo, deberán cumplir con las siguientes condiciones: 

- tener **backend expuesto mediante APIs** ; 

- contar con **módulo administrativo** ; 

- disponer de **frontend tipo marketplace** ; 

- estar **desplegados en Internet** en cada reto para su presentación; 

- evolucionar arquitectónicamente según el avance del curso; 

- documentar contratos, endpoints, arquitectura, decisiones técnicas y despliegue. 

# **5. Estructura del proyecto por retos** 

# **RETO 1: Construcción base API-first sin integración** 

**Semanas: 1 a 6** 

# **Propósito del reto** 

En este primer reto, cada estudiante deberá construir la primera versión funcional de su sistema de información y el equipo responsable del **Booking Prototipo** desarrollará la primera versión de la plataforma central. En esta fase **todavía no existirá integración** 

**entre sistemas** , pero sí deberán quedar listas las bases técnicas y contractuales para que dicha integración pueda ocurrir en el siguiente reto. 

# **Alcance funcional del reto** 

Cada sistema individual deberá entregar: 

- sistema de administración funcional; 

- frontend tipo marketplace funcional; 

- APIs documentadas y listas para futura integración; 

- base de datos operativa; 

- despliegue público del sistema. 

El equipo de **Booking Prototipo** deberá entregar: 

- sistema de administración del Booking; 

- frontend tipo marketplace del Booking; 

- APIs iniciales del Booking; 

- despliegue público del sistema. 

# **Condición arquitectónica del reto** 

Para este reto se acepta que cada sistema trabaje con una **sola base de datos** y una arquitectura más simple. No se exige aún una migración a microservicios, pero sí una **preparación explícita para integrar** . 

# **Tecnologías permitidas para frontend** 

- Angular, o 

- React, o 

- Vue 

# **Alineación con los contenidos del sílabo (Semanas 1 a 6)** 

# **Semana 1. Introducción a la Integración de Sistemas y Enfoque API-first** 

Los estudiantes deberán definir el problema, alcance del sistema, actores, contexto de integración y enfoque API-first de su solución. Aplicación al reto: 

- definición del dominio del negocio; 

- identificación de datos, procesos y aplicaciones a integrar en el futuro; 

- diseño inicial de contratos de integración. 

# **Semana 2. REST avanzado: diseño de recursos y versionamiento** 

Se deberá diseñar la API REST principal del sistema y documentarla correctamente. Aplicación al reto: 

- diseño de recursos; 

- URIs, verbos HTTP y códigos de estado; 

- versionamiento inicial de la API; 

- documentación con Swagger o Redoc. 

# **Semana 3. gRPC y Protocol Buffers** 

Aunque la implementación principal del reto podrá mantenerse en REST, cada equipo deberá analizar qué componentes podrían beneficiarse de gRPC en una futura evolución. 

Aplicación al reto: 

- definición preliminar de servicios internos susceptibles de migrar a gRPC; 

- identificación de interacciones de alto rendimiento entre componentes. 

# **Semana 4. GraphQL y federación de servicios** 

Los estudiantes deberán analizar cómo un modelo de consulta flexible podría beneficiar al marketplace y al futuro Booking Prototipo. Aplicación al reto: 

- diseño conceptual de consultas agregadas; 

- evaluación de escenarios donde GraphQL podría complementar REST. 

# **Semana 5. SOA práctica, ESB y mensajería empresarial** 

En esta etapa se introducirá el concepto de servicios desacoplados y mensajería empresarial como preparación para la futura integración. Aplicación al reto: 

- identificación de operaciones que pueden exponerse como servicios; 

- modelado inicial de eventos del sistema; 

- primera aproximación a colas o tópicos. 

# **Semana 6. Arquitectura Orientada a Eventos (EDA)** 

Los estudiantes deberán incorporar el diseño conceptual de eventos del sistema, aun cuando la integración completa todavía no esté activa. Aplicación al reto: 

- definición de eventos de negocio relevantes; 

- preparación para desacoplamiento futuro; 

- 

- diseño preliminar de trazabilidad de eventos. 

# **Entregables del Reto 1** 

1. Sistema desplegado en Internet. 

2. Backend funcional con APIs documentadas. 

3. Sistema de administración funcional. 

4. Marketplace web funcional. 

5. Base de datos operativa. 

6. Documento técnico con: 

   - arquitectura inicial; 

   - modelo de datos; 

   - contratos API; 

   - identificación de futuros puntos de integración; 

   - propuesta de evolución hacia microservicios. 

# **RETO 2: Integración web con migración a microservicios** 

# **Semanas: 7 a 11** 

# **Propósito del reto** 

En este segundo reto se deberá realizar la **integración efectiva** entre los sistemas de información individuales y el **Booking Prototipo** . A partir de este punto, tanto los sistemas de información de cada estudiante como el Booking deberán **migrar a una arquitectura de microservicios** . 

# **Alcance funcional del reto** 

Cada sistema individual deberá: 

- migrar de una arquitectura monolítica o simple a una arquitectura de **microservicios** ; 

- exponer servicios desacoplados para integración; 

- permitir que el Booking consulte o consuma información relevante; 

- mantener su sistema de administración y su marketplace web; 

- desplegar la nueva versión en Internet. 

# El equipo del **Booking Prototipo** deberá: 

- integrar los sistemas de información de sus compañeros; 

- consumir APIs y/o eventos de los sistemas externos; 

- presentar información agregada en su marketplace; 

- gestionar procesos de consulta, disponibilidad, publicación o venta según la lógica definida; 

- desplegar la nueva versión integrada. 

# **Condición arquitectónica del reto** 

Desde este reto, **todos los sistemas deben migrar a microservicios** . Esto aplica tanto al Booking Prototipo como a los sistemas de información individuales. 

# **Tecnologías permitidas para frontend** 

- Angular, o 

- React, o 

- Vue 

# **Alineación con los contenidos del sílabo (Semanas 7 a 11)** 

# **Semana 7. Esquemas, compatibilidad y gestión de contratos** 

Aplicación al reto: 

- definición formal de contratos entre servicios; 

- control de versiones; 

- compatibilidad hacia atrás; 

- validación de esquemas JSON, Avro o Protobuf según corresponda. 

# **Semana 8. API Gateways y Service Mesh** 

Aplicación al reto: 

- incorporación de un **API Gateway** para exponer servicios de forma controlada; 

- diseño de patrón BFF, Proxy o Aggregator donde sea pertinente; 

- análisis de políticas de seguridad y enrutamiento. 

# **Semana 9. Pruebas de integración y contract testing** 

Aplicación al reto: 

- pruebas de integración entre Booking y sistemas individuales; 

- contract testing provider-consumer; 

- mocking de servicios cuando haga falta; 

- automatización básica de pruebas. 

# **Semana 10. Observabilidad y trazas distribuidas** 

Aplicación al reto: 

- incorporación de logs estructurados; 

- definición de métricas; 

- trazabilidad entre llamadas distribuidas; 

- análisis de latencia y errores de integración. 

# **Semana 11. Seguridad en integraciones** 

Aplicación al reto: 

- autenticación y autorización en APIs; 

- uso de JWT, roles y scopes; 

- protección de endpoints; 

- auditoría básica de eventos y operaciones críticas. 

# **Entregables del Reto 2** 

1. Arquitectura migrada a microservicios. 

2. Integración funcional entre los sistemas individuales y Booking Prototipo. 

3. Marketplace web integrado y desplegado. 

4. Sistema de administración operativo en arquitectura distribuida. 

5. API Gateway configurado. 

6. Contratos versionados y documentados. 

7. Evidencia de pruebas de integración. 

8. Evidencia de seguridad, observabilidad y trazabilidad. 

9. Documento técnico actualizado con: 

   - arquitectura de microservicios; 

   - diagrama de integración; 

   - contratos entre servicios; 

   - estrategia de pruebas; 

   - estrategia de seguridad. 

# **RETO 3: Integración multi-dominio con experiencia móvil** 

# **Semanas: 12 a 16** 

# **Propósito del reto** 

En este último reto se consolidará la arquitectura final del proyecto, manteniendo la integración lograda en el reto 2, pero evolucionando la experiencia de usuario hacia una aplicación móvil desarrollada en **Flutter** o **React Native** , según sorteo. Además, se deberán incorporar criterios más maduros de interoperabilidad, integración de datos, resiliencia y fiabilidad. 

# **Alcance funcional del reto** 

Cada sistema individual deberá: 

- mantener su arquitectura de microservicios; 

- conservar la integración con Booking; 

- migrar el frontend tipo marketplace a **Flutter** o **React Native** ; 

- mantener operativo el módulo administrativo; 

- reforzar aspectos de interoperabilidad, resiliencia y confiabilidad; 

- desplegar públicamente la solución. 

# El equipo del **Booking Prototipo** deberá: 

- mantener y fortalecer la integración multi-sistema; 

- ofrecer frontend móvil del marketplace; 

- consolidar el ecosistema final con seguridad, monitoreo y pruebas; 

- • presentar una arquitectura híbrida y técnicamente defendible. 

# **Condición tecnológica del reto** 

En este reto, los frontends del marketplace deberán desarrollarse en: 

- **Flutter** , o 

- **React Native** , 

según el resultado del sorteo definido para cada equipo o estudiante. 

# **Alineación con los contenidos del sílabo (Semanas 12 a 16)** 

# **Semana 12. Interoperabilidad y estándares** 

Aplicación al reto: 

- diseño de interoperabilidad técnica, sintáctica y semántica; 

- normalización de intercambio de datos; 

- definición de buenas prácticas para comunicación entre dominios heterogéneos. 

# **Semana 13. ESB vs Microservicios: cuándo y cómo** 

Aplicación al reto: 

- justificación técnica de la arquitectura adoptada; 

- comparación argumentada entre integración centralizada y distribuida; 

- defensa de decisiones de diseño del proyecto. 

# **Semana 14. Integración de datos y ETL/ELT** 

Aplicación al reto: 

- incorporación conceptual o práctica de mecanismos de sincronización de datos; 

- análisis de consistencia, calidad y flujo de información entre servicios; 

- tratamiento de datos integrados provenientes de múltiples sistemas. 

# **Semana 15. Resiliencia, tolerancia a fallos y patrones de fiabilidad** 

Aplicación al reto: 

- idempotencia; 

- reintentos; 

- circuit breaker; 

- fallback; 

- manejo de errores en integraciones; 

- robustez frente a fallos de servicios. 

# **Semana 16. Proyecto Final: Integración multi-dominio** 

Aplicación al reto: 

- consolidación de microservicios + API Gateway + Event Bus; 

- integración móvil; 

- seguridad; 

- monitoreo; 

- pruebas automáticas; 

- defensa técnica final del proyecto. 

# **Entregables del Reto 3** 

1. Arquitectura final basada en microservicios. 2. Integración completa operativa. 

3. Frontend móvil del marketplace en Flutter o React Native. 

4. Sistema de administración operativo. 5. Despliegue público de la solución final. 6. Evidencia de seguridad, monitoreo, trazabilidad y resiliencia. 7. Documento final de arquitectura con: 

   - arquitectura híbrida definitiva; 

   - diagrama de microservicios; 

   - API Gateway; 

   - eventos y contratos; 

   - estrategia de interoperabilidad; 

   - estrategia de resiliencia; 

   - lecciones aprendidas. 

8. Presentación técnica y defensa final. 

# **6. Evolución arquitectónica esperada** 

# **En el Reto 1** 

- Arquitectura inicial API-first. 

- Se acepta una sola base de datos por sistema. 

- • No existe integración aún. 

- Deben quedar listas las APIs y contratos. 

# **En el Reto 2** 

- Migración obligatoria a microservicios. 

- Integración efectiva entre los sistemas y Booking. 

- Uso de API Gateway, pruebas, seguridad y observabilidad. 

# **En el Reto 3** 

- Consolidación de microservicios. 

- Frontend móvil. 

- Integración robusta, resiliente e interoperable. 

- Despliegue final y defensa técnica. 

# **7. Requisitos mínimos obligatorios para todos los retos** 

Todos los retos deberán cumplir con lo siguiente: 

- sistema desplegado en Internet; 

- acceso funcional para demostración; 

- backend expuesto mediante APIs; 

- documentación técnica mínima; 

- módulo administrativo; 

- frontend marketplace; 

- evidencia de funcionamiento; 

- coherencia entre arquitectura, código y despliegue. 

# **8. Resultados esperados del proyecto** 

Al finalizar el curso, se espera que el estudiante sea capaz de: 

- diseñar soluciones de integración bajo enfoque API-first; 

- construir APIs interoperables y documentadas; 

- evolucionar de una arquitectura simple a microservicios; 

- integrar sistemas heterogéneos mediante mecanismos síncronos y asíncronos; 

- • aplicar seguridad, pruebas, observabilidad y resiliencia; 

- desplegar soluciones reales accesibles en Internet; 

- defender técnicamente decisiones de arquitectura e integración. 

