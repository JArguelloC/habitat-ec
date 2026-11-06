-- ==============================================================================
-- HÁBITAT EC - MIGRACIÓN 004: Depuración Integral de Reglas Redundantes
-- Unifica reglas duplicadas de silencio ambiental y plásticos desechables,
-- reasignando foreign keys en alojamiento_reglas y consolidando descripciones.
-- ==============================================================================

DO $$
DECLARE
  v_silencio_canonico INT;
  v_plastico_canonico INT;
  r RECORD;
BEGIN
  -- 1. Unificar reglas de silencio (conservar silencio estricto en bioma/fauna)
  SELECT regla_id INTO v_silencio_canonico 
  FROM reglas_convivencia 
  WHERE LOWER(descripcion) LIKE '%silencio%' OR codigo LIKE '%SILENCIO%'
  ORDER BY regla_id ASC LIMIT 1;

  IF v_silencio_canonico IS NOT NULL THEN
    UPDATE reglas_convivencia 
    SET descripcion = 'Horas de silencio estricto de 22:00 a 07:00 para preservación de fauna silvestre y descanso de los huéspedes.'
    WHERE regla_id = v_silencio_canonico;

    FOR r IN (
      SELECT regla_id FROM reglas_convivencia 
      WHERE (LOWER(descripcion) LIKE '%silencio%' OR codigo LIKE '%SILENCIO%')
        AND regla_id <> v_silencio_canonico
    ) LOOP
      UPDATE alojamiento_reglas 
      SET regla_id = v_silencio_canonico 
      WHERE regla_id = r.regla_id 
        AND alojamiento_id NOT IN (
          SELECT alojamiento_id FROM alojamiento_reglas WHERE regla_id = v_silencio_canonico
        );
      DELETE FROM alojamiento_reglas WHERE regla_id = r.regla_id;
      DELETE FROM reglas_convivencia WHERE regla_id = r.regla_id;
    END LOOP;
  END IF;

  -- 2. Unificar reglas de plásticos de un solo uso
  SELECT regla_id INTO v_plastico_canonico 
  FROM reglas_convivencia 
  WHERE LOWER(descripcion) LIKE '%plástico%' OR LOWER(descripcion) LIKE '%plastico%' OR codigo LIKE '%PLASTICO%'
  ORDER BY regla_id ASC LIMIT 1;

  IF v_plastico_canonico IS NOT NULL THEN
    UPDATE reglas_convivencia 
    SET descripcion = 'Prohibido el ingreso de envases plásticos desechables y plásticos de un solo uso en todas las instalaciones y senderos.'
    WHERE regla_id = v_plastico_canonico;

    FOR r IN (
      SELECT regla_id FROM reglas_convivencia 
      WHERE (LOWER(descripcion) LIKE '%plástico%' OR LOWER(descripcion) LIKE '%plastico%' OR codigo LIKE '%PLASTICO%')
        AND regla_id <> v_plastico_canonico
    ) LOOP
      UPDATE alojamiento_reglas 
      SET regla_id = v_plastico_canonico 
      WHERE regla_id = r.regla_id 
        AND alojamiento_id NOT IN (
          SELECT alojamiento_id FROM alojamiento_reglas WHERE regla_id = v_plastico_canonico
        );
      DELETE FROM alojamiento_reglas WHERE regla_id = r.regla_id;
      DELETE FROM reglas_convivencia WHERE regla_id = r.regla_id;
    END LOOP;
  END IF;
END $$;

