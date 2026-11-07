-- =========================================================================
-- MIGRACIÓN 005: CONFIGURACIÓN DE HORA DE CHECK-IN Y CHECK-OUT
-- Hábitat EC - Plataforma de Alojamientos Sostenibles
-- =========================================================================

-- 1. Añadir columnas con valor por defecto canónico
ALTER TABLE alojamientos 
ADD COLUMN IF NOT EXISTS hora_checkin VARCHAR(5) NOT NULL DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS hora_checkout VARCHAR(5) NOT NULL DEFAULT '11:00';

-- 2. Asegurar que registros previos mantengan valores por defecto si eran nulos
UPDATE alojamientos 
SET hora_checkin = '14:00' 
WHERE hora_checkin IS NULL;

UPDATE alojamientos 
SET hora_checkout = '11:00' 
WHERE hora_checkout IS NULL;

-- 3. Constraint CHECK para formato estricto HH:mm (24 horas: 00:00 a 23:59)
ALTER TABLE alojamientos
DROP CONSTRAINT IF EXISTS alojamientos_formato_horas_check;

ALTER TABLE alojamientos
ADD CONSTRAINT alojamientos_formato_horas_check
  CHECK (
    hora_checkin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
    hora_checkout ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );

