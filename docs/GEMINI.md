# Directrices de Desarrollo y Seguridad para Antigravity / Gemini — Hábitat EC

Este documento establece las instrucciones operativas, restricciones de seguridad y directrices de arquitectura que el agente autónomo (Antigravity / Gemini) debe acatar obligatoriamente en cada interacción, generación y refactorización de código dentro del proyecto **Hábitat EC**.

---

## 1. Seguridad Estricta y Manejo de Secretos (Zero Hardcoded Secrets)

1. **Prohibición Total de Credenciales en Código:**
   - **NUNCA** incrustar contraseñas, URLs completas de bases de datos, tokens JWT, llaves privadas ni secrets en archivos de código fuente (`.ts`, `.js`, `.json`, `.sql`, etc.).
   - Toda variable sensible debe obtenerse exclusivamente desde variables de entorno a través de `ConfigService` o `process.env`.
2. **Archivos de Entorno (`.env`):**
   - Asegurar que `.env` esté permanentemente listado en `.gitignore`.
   - Si se requiere documentar variables nuevas, agregarlas en `.env.example` con valores ficticios y descriptivos (ejemplo: `DATABASE_URL=postgresql://user:password@host/db`).
3. **Manejo de Errores e Información Expuesta:**
   - No exponer mensajes internos del motor de base de datos ni *stack traces* en respuestas de error dirigidas al cliente HTTP. Toda excepción debe filtrarse por el `HttpExceptionFilter`.

---

## 2. Optimización y Economía de Tokens

1. **Ediciones Quirúrgicas y Localizadas:**
   - No reescribir archivos completos cuando solo se requiere modificar una función, interfaz o bloque específico. Proporcionar solo las líneas o bloques afectados indicando su contexto o usando *diffs* precisos.
2. **Exclusión de Archivos y Carpetas Grandes:**
   - Ignorar explícitamente en el contexto de lectura: `node_modules/`, `dist/`, `.git/`, volcados de base de datos grandes (`.sql` de datos de prueba), archivos de bloqueo (`package-lock.json`), y artefactos de compilación.
3. **Respuestas Concisas y al Grano:**
   - Evitar explicaciones teóricas extensas a menos que el usuario lo solicite expresamente. Priorizar el código exacto, los comandos directos de ejecución y el impacto en la arquitectura.

---

## 3. Reglas Técnicas Inquebrantables del Backend (NestJS + TypeORM)

1. **Resolución de Módulos ESM (Extensión `.js` Obligatoria):**
   - **TODA** importación local entre archivos del proyecto debe incluir explícitamente la extensión `.js` al final de la ruta:
     ```typescript
     // Correcto:
     import { AuthService } from './auth.service.js';
     import { CrearAlojamientoDto } from './dto/crear-alojamiento.dto.js';

     // Prohibido:
     import { AuthService } from './auth.service';
     ```
2. **Protección del Esquema de Base de Datos en Neon (5FN):**
   - Mantener siempre `synchronize: false` en `TypeOrmModule`. Bajo ninguna circunstancia activar sincronización automática para evitar la alteración o pérdida del esquema normalizado en 5FN, triggers y stored procedures.
3. **Tipado Estricto en Bloques `catch` (TypeScript `useUnknownInCatchVariables`):**
   - No acceder directamente a `error.message`. Validar siempre la instancia:
     ```typescript
     } catch (error) {
       const mensaje = error instanceof Error ? error.message : 'Error desconocido';
       throw new InternalServerErrorException(mensaje);
     }
     ```
4. **Resiliencia de Conexión a Neon Serverless:**
   - La configuración de conexión con PostgreSQL debe contemplar `ssl: { rejectUnauthorized: false }` y parámetros en `extra` (`keepAlive: true`, `connectionTimeoutMillis: 15000`) para evitar errores `ETIMEDOUT` por hibernación de Neon o problemas de resolución TLS.

---

## 4. Alineación Arquitectónica (API-First y 5FN)

1. **Fidelidad al Contrato:**
   - Toda API, DTO, código de respuesta HTTP y encabezado debe reflejar exactamente lo definido en `contracts/habitat-ec-v1.yaml`.
2. **Integridad 5FN:**
   - Respetar la relación ternaria descompuesta entre Alojamiento, Canal y Política de Cancelación, interactuando con la vista `vw_contratos_5fn_validos` y los Stored Procedures transaccionales (`sp_generar_order_preview`, `sp_crear_orden_idempotente`, `sp_cancelar_orden_idempotente`).
3. **Control de Acceso Basado en Roles (RBAC):**
   - Proteger endpoints usando `@UseGuards(JwtAuthGuard, RolesGuard)` y el decorador `@Roles(...)` para los roles `SUPERADMIN`, `ADMIN` y `CLIENTE`.

---

## 5. Checklist de Verificación para el Agente Antes de Cada Respuesta

- [ ] ¿Hay credenciales o cadenas de conexión en texto plano? *(Debe ser NO)*.
- [ ] ¿Todas las importaciones relativas locales terminan en `.js`? *(Debe ser SÍ)*.
- [ ] ¿Se manejaron los bloques `catch` con `error instanceof Error`? *(Debe ser SÍ)*.
- [ ] ¿Se mantuvo `synchronize: false` en TypeORM? *(Debe ser SÍ)*.
- [ ] ¿La respuesta es quirúrgica para ahorrar tokens? *(Debe ser SÍ)*.