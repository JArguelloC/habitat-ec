-- =========================================================================
-- MIGRACIÓN 009: GARANTIZAR COLUMNA CREATED_AT EN TABLA ORDENES
-- Hábitat EC - Resiliencia de Esquema y Compatibilidad Bidireccional
-- =========================================================================

-- 1. Asegurar columna created_at como espejo / fallback de creation_date
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Sincronizar created_at a partir de creation_date para registros existentes
UPDATE ordenes
SET created_at = creation_date
WHERE created_at IS NULL AND creation_date IS NOT NULL;

-- 3. Trigger bidireccional para garantizar que tanto creation_date como created_at estén siempre sincronizados
CREATE OR REPLACE FUNCTION trg_fn_sync_ordenes_created_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_at IS NULL AND NEW.creation_date IS NOT NULL THEN
        NEW.created_at := NEW.creation_date;
    ELSIF NEW.creation_date IS NULL AND NEW.created_at IS NOT NULL THEN
        NEW.creation_date := NEW.created_at;
    ELSIF NEW.created_at IS NULL AND NEW.creation_date IS NULL THEN
        NEW.created_at := NOW();
        NEW.creation_date := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ordenes_created_at ON ordenes;
CREATE TRIGGER trg_sync_ordenes_created_at
BEFORE INSERT OR UPDATE ON ordenes
FOR EACH ROW
EXECUTE FUNCTION trg_fn_sync_ordenes_created_at();
