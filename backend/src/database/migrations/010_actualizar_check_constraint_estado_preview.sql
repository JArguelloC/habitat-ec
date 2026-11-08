-- =========================================================================
-- MIGRACIÓN 010: ACTUALIZAR CHECK CONSTRAINT ESTADO_PREVIEW EN HOLDS
-- Hábitat EC - Flexibilización y Compatibilidad de Estados de Hold
-- =========================================================================

-- 1. Eliminar la restricción restrictiva previa
ALTER TABLE order_previews_holds 
DROP CONSTRAINT IF EXISTS order_previews_holds_estado_preview_check;

-- 2. Asegurar tamaño suficiente para la columna (VARCHAR(30))
ALTER TABLE order_previews_holds 
ALTER COLUMN estado_preview TYPE VARCHAR(30);

-- 3. Crear el nuevo CHECK constraint que incluye 'CONVERTIDO_EN_ORDEN' y variantes canónicas
ALTER TABLE order_previews_holds 
ADD CONSTRAINT order_previews_holds_estado_preview_check 
CHECK (estado_preview IN ('ACTIVO', 'EXPIRADO', 'CONVERTIDO_EN_ORDEN', 'CONFIRMADO', 'RESERVADO', 'UTILIZADO'));
