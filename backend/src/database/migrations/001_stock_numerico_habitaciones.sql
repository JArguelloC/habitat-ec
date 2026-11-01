-- =========================================================================
-- MIGRACIÓN 001: CONTROL DE STOCK NUMÉRICO DE HABITACIONES
-- Hábitat EC - Plataforma de Alojamientos Sostenibles
-- =========================================================================

-- 1. Añadir columnas de inventario numérico a la tabla calendario_inventario
ALTER TABLE calendario_inventario 
ADD COLUMN IF NOT EXISTS cuartos_totales SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS cuartos_disponibles SMALLINT NOT NULL DEFAULT 1;

-- 2. Sincronizar registros preexistentes con cantidad_cuartos_inventario de productos_habitacion
UPDATE calendario_inventario ci
SET cuartos_totales = COALESCE(ph.cantidad_cuartos_inventario, 1),
    cuartos_disponibles = CASE 
        WHEN ci.estado_dia = 'RESERVADO' THEN 0
        WHEN ci.estado_dia = 'RETENIDO_PREVIEW' THEN 0
        ELSE COALESCE(ph.cantidad_cuartos_inventario, 1)
    END
FROM productos_habitacion ph
WHERE ci.producto_id = ph.producto_id;

-- 3. Drop function previa para evitar colisión de valores por defecto en PostgreSQL
DROP FUNCTION IF EXISTS sp_generar_order_preview(bigint,character varying,uuid,date,date,smallint,smallint,uuid,character,integer);

-- 4. Actualizar sp_generar_order_preview para control de cupos y decremento
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

    -- Sembrar fechas si no existen
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
            ELSE ci.estado_dia 
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

    -- Insertar hold
    INSERT INTO order_previews_holds (
        correlation_id, alojamiento_id, producto_id, usuario_id, checkin, checkout,
        num_adultos, num_cuartos, moneda, precio_total_cotizado, estado_preview, expira_en
    ) VALUES (
        p_correlation_id, p_alojamiento_id, p_producto_id, p_usuario_id, p_checkin, p_checkout,
        p_num_adultos, p_num_cuartos, p_moneda, v_total, 'ACTIVO', v_expira
    ) RETURNING order_previews_holds.order_preview_id INTO v_preview_id;

    -- Descontar stock
    UPDATE calendario_inventario ci
    SET cuartos_disponibles = ci.cuartos_disponibles - p_num_cuartos,
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

-- 5. Actualizar sp_cancelar_orden_idempotente para reponer el cupo liberado
CREATE OR REPLACE FUNCTION sp_cancelar_orden_idempotente(
    p_order_id UUID,
    p_idempotency_key UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_orden RECORD;
    v_politica RECORD;
BEGIN
    SELECT * INTO v_orden FROM ordenes WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Orden inexistente.' USING ERRCODE = 'P0005';
    END IF;

    IF v_orden.status = 'CANCELLED' THEN
        RETURN TRUE;
    END IF;

    SELECT * INTO v_politica FROM politicas_cancelacion WHERE politica_id = v_orden.politica_id;
    IF v_politica.codigo_politica = 'NON_REFUNDABLE' THEN
        RAISE EXCEPTION 'CANCELLATION_NOT_ALLOWED: Tarifa no reembolsable.' USING ERRCODE = 'P0006';
    END IF;

    UPDATE ordenes
    SET status = 'CANCELLED', updated_at = NOW()
    WHERE order_id = p_order_id;

    -- Reponer las habitaciones liberadas en el calendario
    UPDATE calendario_inventario ci
    SET cuartos_disponibles = LEAST(ci.cuartos_totales, ci.cuartos_disponibles + v_orden.number_of_rooms),
        estado_dia = 'DISPONIBLE',
        actualizado_en = NOW()
    WHERE ci.producto_id = v_orden.producto_id
      AND ci.fecha >= v_orden.checkin AND ci.fecha < v_orden.checkout;

    RETURN TRUE;
END;
$$;
