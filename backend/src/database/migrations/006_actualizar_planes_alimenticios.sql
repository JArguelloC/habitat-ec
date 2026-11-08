-- ==============================================================================
-- HÁBITAT EC - MIGRACIÓN 006: ACTUALIZACIÓN DE PLANES ALIMENTICIOS (ECO-LODGES)
-- Garantiza la existencia exclusiva de las 5 opciones gastronómicas canónicas
-- ==============================================================================

DO $$
DECLARE
    v_room_only_id INT;
BEGIN
    -- 1. Asegurar restricción UNIQUE sobre codigo_meal_plan
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'planes_alimenticios_codigo_meal_plan_key'
    ) THEN
        -- En caso de duplicados previos, conservar el de menor ID
        DELETE FROM planes_alimenticios p1
        USING planes_alimenticios p2
        WHERE p1.codigo_meal_plan = p2.codigo_meal_plan AND p1.plan_id > p2.plan_id;

        ALTER TABLE planes_alimenticios 
        ADD CONSTRAINT planes_alimenticios_codigo_meal_plan_key UNIQUE (codigo_meal_plan);
    END IF;

    -- 2. Homologar posibles códigos cortos o legados previos si existen
    UPDATE planes_alimenticios SET codigo_meal_plan = 'ROOM_ONLY' 
    WHERE codigo_meal_plan IN ('RO', 'ROOM ONLY', 'SOLO_HABITACION') 
      AND NOT EXISTS (SELECT 1 FROM planes_alimenticios WHERE codigo_meal_plan = 'ROOM_ONLY');

    UPDATE planes_alimenticios SET codigo_meal_plan = 'BREAKFAST' 
    WHERE codigo_meal_plan IN ('BB', 'BED_AND_BREAKFAST', 'DESAYUNO') 
      AND NOT EXISTS (SELECT 1 FROM planes_alimenticios WHERE codigo_meal_plan = 'BREAKFAST');

    UPDATE planes_alimenticios SET codigo_meal_plan = 'HALF_BOARD' 
    WHERE codigo_meal_plan IN ('HB', 'MEDIA_PENSION') 
      AND NOT EXISTS (SELECT 1 FROM planes_alimenticios WHERE codigo_meal_plan = 'HALF_BOARD');

    UPDATE planes_alimenticios SET codigo_meal_plan = 'FULL_BOARD' 
    WHERE codigo_meal_plan IN ('FB', 'PENSION_COMPLETA') 
      AND NOT EXISTS (SELECT 1 FROM planes_alimenticios WHERE codigo_meal_plan = 'FULL_BOARD');

    UPDATE planes_alimenticios SET codigo_meal_plan = 'ALL_INCLUSIVE' 
    WHERE codigo_meal_plan IN ('AI', 'TODO_INCLUIDO') 
      AND NOT EXISTS (SELECT 1 FROM planes_alimenticios WHERE codigo_meal_plan = 'ALL_INCLUSIVE');

    -- 3. Upsert de las 5 opciones canónicas de Eco-Lodges
    INSERT INTO planes_alimenticios (codigo_meal_plan, nombre)
    VALUES ('ROOM_ONLY', 'Solo Alojamiento')
    ON CONFLICT (codigo_meal_plan) DO UPDATE 
    SET nombre = EXCLUDED.nombre;

    INSERT INTO planes_alimenticios (codigo_meal_plan, nombre)
    VALUES ('BREAKFAST', 'Desayuno Incluido')
    ON CONFLICT (codigo_meal_plan) DO UPDATE 
    SET nombre = EXCLUDED.nombre;

    INSERT INTO planes_alimenticios (codigo_meal_plan, nombre)
    VALUES ('HALF_BOARD', 'Media Pensión (Desayuno y Cena)')
    ON CONFLICT (codigo_meal_plan) DO UPDATE 
    SET nombre = EXCLUDED.nombre;

    INSERT INTO planes_alimenticios (codigo_meal_plan, nombre)
    VALUES ('FULL_BOARD', 'Pensión Completa (3 Comidas)')
    ON CONFLICT (codigo_meal_plan) DO UPDATE 
    SET nombre = EXCLUDED.nombre;

    INSERT INTO planes_alimenticios (codigo_meal_plan, nombre)
    VALUES ('ALL_INCLUSIVE', 'Todo Incluido (Comidas y Excursiones)')
    ON CONFLICT (codigo_meal_plan) DO UPDATE 
    SET nombre = EXCLUDED.nombre;

    -- 4. Obtener el ID del plan ROOM_ONLY para fallback seguro
    SELECT plan_id INTO v_room_only_id FROM planes_alimenticios WHERE codigo_meal_plan = 'ROOM_ONLY';

    -- 5. Reasignar habitaciones asociadas a planes que ya no formen parte del catálogo oficial
    UPDATE productos_habitacion 
    SET plan_id = v_room_only_id 
    WHERE plan_id IN (
        SELECT plan_id FROM planes_alimenticios 
        WHERE codigo_meal_plan NOT IN ('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE')
    );

    -- 6. Eliminar planes obsoletos que no pertenezcan al nuevo catálogo
    DELETE FROM planes_alimenticios 
    WHERE codigo_meal_plan NOT IN ('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE');

END $$;

