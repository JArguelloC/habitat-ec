-- Migración 011: Contrato B2B v2.1 y v2.2 (Clientes Cross-Platform, Check-in en Recepción y Saga B2B)
-- Nodo: NODE_ALO_HAB (Hábitat EC)

-- 1. Columna identificacion en usuarios para búsqueda y registro cross-platform (/api/v2/clientes)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS identificacion VARCHAR(40) NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_identificacion ON usuarios(identificacion);

-- 2. Columnas B2B y de Check-in asistido en ordenes
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS saga_id VARCHAR(100) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS checkin_observaciones TEXT NULL;

-- 3. Ampliar longitud de locator para soportar códigos ORD-HTL-...
DO $$
BEGIN
  ALTER TABLE ordenes ALTER COLUMN locator TYPE VARCHAR(40);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Asegurar canal B2B_REST y política FREE_CANCELLATION
INSERT INTO canales_integracion (codigo_protocolo, nombre, comision_porcentaje)
VALUES ('B2B_REST', 'Booking Central B2B REST/AMQP', 15.00)
ON CONFLICT (codigo_protocolo) DO NOTHING;

INSERT INTO politicas_cancelacion (codigo_politica, nombre, reembolso_porcentaje)
VALUES ('FREE_CANCELLATION', 'Cancelación Gratuita 24h', 100.00)
ON CONFLICT (codigo_politica) DO NOTHING;
