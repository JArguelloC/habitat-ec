# ⚡ habitat-ms-orders — Motor de Inventario y Reservas (`gRPC + Protobuf`)

Microservicio de control de concurrencia GiST, Holds temporales (15 min B2C y 30 min B2B) y ejecución de Sagas:
- **Contrato Protobuf (`proto/inventory.proto`)**: Define `InventoryOrderService` con `CheckAvailability`, `CreateHold`, `ConfirmOrder` y `CancelOrderSaga`.
- **Bloqueo Pesimista (`FOR UPDATE`)**: Garantiza cero sobreventa concurrente y sincronización noche por noche hacia Booking Central.
