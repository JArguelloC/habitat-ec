-- =========================================================================
-- MIGRACIÓN 007: CORRECCIÓN DE ESTADOS Y CHECK CONSTRAINT EN SP_GENERAR_ORDER_PREVIEW
-- Hábitat EC - Plataforma de Alojamientos Sostenibles
-- =========================================================================

-- 1. Asegurar que la restricción check contemple exactamente los estados permitidos
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendario_inventario_estado_dia_check'
    ) THEN
        ALTER TABLE calendario_inventario 
        DROP CONSTRAINT calendario_inventario_estado_dia_check;
    END IF;

    -- Homologar cualquier estado legado que pudiera haber quedado en 'HOLD' o 'RETENIDO_PREVIEW'
    UPDATE calendario_inventario 
    SET estado_dia = CASE 
        WHEN cuartos_disponibles <= 0 THEN 'AGOTADO'
        ELSE 'DISPONIBLE'
    END
    WHERE estado_dia NOT IN ('DISPONIBLE', 'AGOTADO', 'BLOQUEADO_ANFITRION', 'RESERVADO');

    ALTER TABLE calendario_inventario 
    ADD CONSTRAINT calendario_inventario_estado_dia_check 
    CHECK (estado_dia IN ('DISPONIBLE', 'AGOTADO', 'BLOQUEADO_ANFITRION', 'RESERVADO'));
END $$;

-- 2. Recrear sp_generar_order_preview con cumplimiento estricto del check constraint
CREATE OR REPLACE FUNCTION sp_generar_order_preview(
    p_alojamiento_id BIGINT,
    p_producto_id VARCHAR(60),
    p_usuario_id UUID,
    p_checkin DATE,
    p_checkout DATE,
    p_num_adultos SMALLINT,
    p_num_cuartos SMALLINT,
    p_correlation_id UUID,
    p_moneda CHAR(3) DEFAULT 'USD',
    p_ttl_minutos INT DEFAULT 15
)
RETURNS TABLE (
    order_preview_id UUID,
    total_price NUMERIC(12,2),
    currency CHAR(3),
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_cap_adultos SMALLINT;
    v_cuartos_inventario SMALLINT;
    v_precio_base NUMERIC(12,2);
    v_dias_solicitados INT;
    v_dias_libres INT;
    v_subtotal NUMERIC(12,2);
    v_total NUMERIC(12,2);
    v_preview_id UUID;
    v_expira TIMESTAMPTZ;
BEGIN
    SELECT ph.capacidad_adultos, ph.cantidad_cuartos_inventario, ph.precio_base_noche
    INTO v_cap_adultos, v_cuartos_inventario, v_precio_base
    FROM productos_habitacion ph
    WHERE ph.producto_id = p_producto_id AND ph.alojamiento_id = p_alojamiento_id AND ph.activo = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: El producto % no pertenece al alojamiento % o no está activo.', p_producto_id, p_alojamiento_id
            USING ERRCODE = 'P0001';
    END IF;

    IF p_num_cuartos > v_cuartos_inventario THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: El establecimiento solo dispone de % cuartos en total para esta habitación.', v_cuartos_inventario
            USING ERRCODE = 'P0002';
    END IF;

    IF p_num_adultos > (v_cap_adultos * p_num_cuartos) THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Capacidad de adultos excedida para los cuartos solicitados.'
            USING ERRCODE = 'P0002';
    END IF;

    v_dias_solicitados := (p_checkout - p_checkin);
    IF v_dias_solicitados <= 0 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Rango de fechas inválido.' USING ERRCODE = 'P0003';
    END IF;

    -- Sembrar fechas si no existen (siempre con estado 'DISPONIBLE')
    INSERT INTO calendario_inventario (producto_id, fecha, estado_dia, tarifa_noche, cuartos_totales, cuartos_disponibles)
    SELECT p_producto_id, d::DATE, 'DISPONIBLE', v_precio_base, v_cuartos_inventario, v_cuartos_inventario
    FROM generate_series(p_checkin, p_checkout - INTERVAL '1 day', '1 day') AS d
    ON CONFLICT (producto_id, fecha) DO NOTHING;

    -- Restaurar stock de holds expirados
    WITH holds_expirados AS (
        UPDATE order_previews_holds oph
        SET estado_preview = 'EXPIRADO'
        WHERE oph.producto_id = p_producto_id 
          AND oph.expira_en < NOW() 
          AND oph.estado_preview = 'ACTIVO'
        RETURNING oph.checkin, oph.checkout, oph.num_cuartos
    )
    UPDATE calendario_inventario ci
    SET cuartos_disponibles = LEAST(ci.cuartos_totales, ci.cuartos_disponibles + he.num_cuartos),
        estado_dia = CASE 
            WHEN (ci.cuartos_disponibles + he.num_cuartos) > 0 THEN 'DISPONIBLE'
            ELSE 'AGOTADO' 
        END,
        actualizado_en = NOW()
    FROM holds_expirados he
    WHERE ci.producto_id = p_producto_id
      AND ci.fecha >= he.checkin AND ci.fecha < he.checkout;

    -- Bloqueo pesimista NOWAIT validando cupo suficiente
    SELECT COUNT(*), COALESCE(SUM(bloqueo.tarifa_noche), 0)
    INTO v_dias_libres, v_subtotal
    FROM (
        SELECT ci.fecha, ci.tarifa_noche
        FROM calendario_inventario ci
        WHERE ci.producto_id = p_producto_id
          AND ci.fecha >= p_checkin AND ci.fecha < p_checkout
          AND ci.cuartos_disponibles >= p_num_cuartos
          AND ci.estado_dia <> 'BLOQUEADO_ANFITRION'
        FOR UPDATE NOWAIT
    ) AS bloqueo;

    IF v_dias_libres <> v_dias_solicitados THEN
        RAISE EXCEPTION 'ROOM_NO_LONGER_AVAILABLE: No hay suficiente stock de habitaciones disponibles para las fechas seleccionadas.'
            USING ERRCODE = '23P01';
    END IF;

    v_total := ROUND((v_subtotal * p_num_cuartos) * 1.115, 2);
    v_expira := NOW() + (p_ttl_minutos || ' minutes')::INTERVAL;

    -- Insertar hold con estado 'ACTIVO' en tabla de previews
    INSERT INTO order_previews_holds (
        correlation_id, alojamiento_id, producto_id, usuario_id, checkin, checkout,
        num_adultos, num_cuartos, moneda, precio_total_cotizado, estado_preview, expira_en
    ) VALUES (
        p_correlation_id, p_alojamiento_id, p_producto_id, p_usuario_id, p_checkin, p_checkout,
        p_num_adultos, p_num_cuartos, p_moneda, v_total, 'ACTIVO', v_expira
    ) RETURNING order_previews_holds.order_preview_id INTO v_preview_id;

    -- Descontar stock numérico y transicionar estado_dia a 'AGOTADO' o 'DISPONIBLE'
    UPDATE calendario_inventario ci
    SET cuartos_disponibles = GREATEST(0, ci.cuartos_disponibles - p_num_cuartos),
        estado_dia = CASE 
            WHEN (ci.cuartos_disponibles - p_num_cuartos) <= 0 THEN 'AGOTADO'
            ELSE 'DISPONIBLE'
        END,
        order_preview_id = v_preview_id,
        actualizado_en = NOW()
    WHERE ci.producto_id = p_producto_id
      AND ci.fecha >= p_checkin AND ci.fecha < p_checkout;

    RETURN QUERY SELECT v_preview_id, v_total, p_moneda, v_expira;
END;
$$;

