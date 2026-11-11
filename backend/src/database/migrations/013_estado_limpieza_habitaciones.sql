-- =========================================================================
-- MIGRACIÓN 013: ESTADO DE LIMPIEZA Y HOUSEKEEPING DE HABITACIONES
-- Hábitat EC - Plataforma de Alojamientos Sostenibles (Flujo Post-Checkout)
-- =========================================================================

-- 1. Añadir columnas de estado de limpieza a productos_habitacion
ALTER TABLE productos_habitacion 
ADD COLUMN IF NOT EXISTS estado_limpieza VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE';

ALTER TABLE productos_habitacion 
ADD COLUMN IF NOT EXISTS ultima_limpieza_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Restricción CHECK de estados operativos válidos de habitación
ALTER TABLE productos_habitacion 
DROP CONSTRAINT IF EXISTS productos_habitacion_estado_limpieza_check;

ALTER TABLE productos_habitacion 
ADD CONSTRAINT productos_habitacion_estado_limpieza_check 
  CHECK (estado_limpieza IN ('DISPONIBLE', 'EN_RESERVA', 'EN_LIMPIEZA', 'MANTENIMIENTO'));

-- 3. Añadir columnas para persistencia de cancelaciones y reembolsos B2B en ordenes
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS codigo_reembolso VARCHAR(30) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS porcentaje_reembolso NUMERIC(5,2) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS monto_reembolsado NUMERIC(10,2) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS penalidad_cancelacion NUMERIC(10,2) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS solicitado_por_cancelacion VARCHAR(50) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL;
