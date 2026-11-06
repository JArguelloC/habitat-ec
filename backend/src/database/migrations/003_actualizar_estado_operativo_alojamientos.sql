-- ==============================================================================
-- HÁBITAT EC - MIGRACIÓN 003: ACTUALIZACIÓN DE CONSTRAINT ESTADO_OPERATIVO Y SOFT DELETE
-- ==============================================================================

-- 1. Actualizar constraint de estado_operativo en la tabla alojamientos
ALTER TABLE alojamientos DROP CONSTRAINT IF EXISTS alojamientos_estado_operativo_check;
ALTER TABLE alojamientos ADD CONSTRAINT alojamientos_estado_operativo_check 
  CHECK (estado_operativo IN ('BORRADOR', 'PUBLICADO', 'SUSPENDIDO', 'PAUSADO', 'INACTIVO', 'BAJA'));

-- 2. Asegurar columnas para Soft Delete y Auditoría
ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE alojamientos ADD COLUMN IF NOT EXISTS motivo_baja TEXT NULL;

-- 3. Sincronizar columna activo con el estado operativo actual
UPDATE alojamientos 
SET activo = CASE 
  WHEN estado_operativo = 'PUBLICADO' THEN TRUE 
  ELSE FALSE 
END;

