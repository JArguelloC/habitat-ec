# 🌐 habitat-api-gateway — API Gateway & ESB Orquestador (`NODE_ALO_HAB`)

Punto único de entrada perimetral del ecosistema distribuido **Hábitat EC**:
- **`/api/v1/*`**: Enrutamiento hacia servicios internos para el Frontend React SPA.
- **`/api/v2/*`**: Interoperabilidad B2B con **Booking Central (`v2.1` y `v2.2`)** validando `X-API-Key` y tokens OAuth2/JWT.
- **`/graphql`**: Enrutamiento BFF hacia `habitat-ms-catalog`.
- **Propagación Transversal**: Inyección y trazabilidad de `X-Correlation-ID` e `Idempotency-Key`.

