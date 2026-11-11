-- =========================================================================
-- MIGRACIÓN 012: AGREGAR CAMAS A PRODUCTOS_HABITACION
-- Hábitat EC - Plataforma de Alojamientos Sostenibles (Alineación Booking v2.2.0)
-- =========================================================================

-- 1. Añadir columna camas con valor por defecto
ALTER TABLE productos_habitacion 
ADD COLUMN IF NOT EXISTS camas VARCHAR(100) NOT NULL DEFAULT '1 Cama Matrimonial (2 plazas)';

-- 2. Actualizar semilleros y registros existentes según tipología de habitación
UPDATE productos_habitacion
SET camas = CASE
  WHEN LOWER(nombre_producto) LIKE '%suite%' OR LOWER(nombre_producto) LIKE '%presidencial%' THEN '1 Cama King Size'
  WHEN LOWER(nombre_producto) LIKE '%familiar%' THEN '1 Cama Queen + 2 Camas Individuales'
  WHEN LOWER(nombre_producto) LIKE '%doble%' OR LOWER(nombre_producto) LIKE '%twin%' THEN '2 Camas Individuales (Twin)'
  WHEN LOWER(nombre_producto) LIKE '%cabaña%' OR LOWER(nombre_producto) LIKE '%cabana%' THEN '1 Cama Matrimonial + 1 Litera'
  WHEN LOWER(nombre_producto) LIKE '%individual%' OR LOWER(nombre_producto) LIKE '%simple%' THEN '1 Cama Individual'
  ELSE '1 Cama Matrimonial (2 plazas)'
END
WHERE camas IS NULL OR camas = '1 Cama Matrimonial (2 plazas)';

