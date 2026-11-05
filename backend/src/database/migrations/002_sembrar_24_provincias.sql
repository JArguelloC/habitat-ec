-- ==============================================================================
-- HÁBITAT EC - MIGRACIÓN / SEED: 24 PROVINCIAS OFICIALES DE ECUADOR
-- Compatible con Neon Serverless PostgreSQL (PostGIS)
-- Restricciones cumplidas: paises_pais_iso_check (pais_iso = 'ec'), codigo_estado char(2)
-- ==============================================================================

-- 1. Asegurar País Ecuador con código en minúsculas ('ec')
INSERT INTO paises (pais_iso, nombre)
VALUES ('ec', 'Ecuador')
ON CONFLICT (pais_iso) DO NOTHING;

-- 2. Asegurar 4 Regiones asociadas a pais_iso = 'ec'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) = 'costa') THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Costa');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) = 'sierra') THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Sierra');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) IN ('oriente', 'amazonia', 'amazonía')) THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Oriente');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) IN ('galapagos', 'galápagos', 'insular')) THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('ec', 'Galápagos');
  END IF;
END $$;

-- 3. Sembrado de las 24 provincias con codigo_estado en formato char(2) minúsculas
DO $$
DECLARE
  v_costa INT;
  v_sierra INT;
  v_oriente INT;
  v_galapagos INT;
  v_fallback INT;
BEGIN
  SELECT region_id INTO v_costa FROM regiones WHERE LOWER(nombre) = 'costa' LIMIT 1;
  SELECT region_id INTO v_sierra FROM regiones WHERE LOWER(nombre) = 'sierra' LIMIT 1;
  SELECT region_id INTO v_oriente FROM regiones WHERE LOWER(nombre) IN ('oriente', 'amazonia', 'amazonía') LIMIT 1;
  SELECT region_id INTO v_galapagos FROM regiones WHERE LOWER(nombre) IN ('galapagos', 'galápagos', 'insular') LIMIT 1;
  SELECT region_id INTO v_fallback FROM regiones LIMIT 1;

  v_costa := COALESCE(v_costa, v_fallback, 1);
  v_sierra := COALESCE(v_sierra, v_fallback, 1);
  v_oriente := COALESCE(v_oriente, v_fallback, 1);
  v_galapagos := COALESCE(v_galapagos, v_fallback, 1);

  -- COSTA (6 provincias)
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'esmeraldas') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'es', 'Esmeraldas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('manabí', 'manabi')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'ma', 'Manabí');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('los ríos', 'los rios')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'lr', 'Los Ríos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'guayas') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'gy', 'Guayas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'santa elena') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'se', 'Santa Elena');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'el oro') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'eo', 'El Oro');
  END IF;

  -- SIERRA (11 provincias)
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'carchi') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'cr', 'Carchi');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'imbabura') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'im', 'Imbabura');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'pichincha') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'pi', 'Pichincha');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%santo domingo%') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'sd', 'Santo Domingo de los Tsáchilas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'cotopaxi') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'co', 'Cotopaxi');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'tungurahua') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'tu', 'Tungurahua');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('bolívar', 'bolivar')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'bo', 'Bolívar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'chimborazo') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'ch', 'Chimborazo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('cañar', 'canar')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'cn', 'Cañar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'azuay') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'az', 'Azuay');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'loja') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'lo', 'Loja');
  END IF;

  -- AMAZONÍA / ORIENTE (6 provincias)
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('sucumbíos', 'sucumbios')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'su', 'Sucumbíos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'orellana') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'or', 'Orellana');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'napo') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'na', 'Napo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'pastaza') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'pa', 'Pastaza');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%morona%') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'ms', 'Morona Santiago');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%zamora%') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'za', 'Zamora Chinchipe');
  END IF;

  -- INSULAR / GALÁPAGOS (1 provincia)
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('galápagos', 'galapagos', 'insular')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_galapagos, 'ga', 'Galápagos');
  END IF;
END $$;
