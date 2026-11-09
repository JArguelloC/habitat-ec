# 🏡 habitat-ms-catalog — Microservicio de Catálogo y Búsqueda (`GraphQL + REST`)

Microservicio de dominio encargado de `CatalogosModule`, `AlojamientosModule`, geografía PostGIS y matriz de contratos en **Quinta Forma Normal (5FN)**:
- **Esquema GraphQL (`schema.graphql`)**: Expone `/graphql` como BFF para evitar *over-fetching* en el Marketplace.
- **Rutas REST (`/api/v2/alojamientos`)**: Filtrado estricto de alojamientos publicados (`activo = true` y `estado_operativo = 'PUBLICADO'`).
