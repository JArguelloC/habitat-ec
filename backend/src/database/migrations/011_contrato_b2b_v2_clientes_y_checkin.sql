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

-- 3. Flexibilizar constraint de estados y longitud de locator
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_status_check;

DO $$
BEGIN
  ALTER TABLE ordenes ALTER COLUMN locator TYPE VARCHAR(40);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
