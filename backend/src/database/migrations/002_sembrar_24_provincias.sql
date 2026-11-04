-- ==============================================================================
-- HÁBITAT EC - MIGRACIÓN / SEED: 24 PROVINCIAS OFICIALES DE ECUADOR
-- Compatible con Neon Serverless PostgreSQL (PostGIS)
-- ==============================================================================

-- 1. Ampliar longitud de codigo_estado por seguridad
DO $$
BEGIN
  ALTER TABLE provincias ALTER COLUMN codigo_estado TYPE VARCHAR(10);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Asegurar País Ecuador
INSERT INTO paises (pais_iso, nombre)
VALUES ('EC', 'Ecuador')
ON CONFLICT (pais_iso) DO NOTHING;

-- 3. Asegurar 4 Regiones
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) = 'costa') THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('EC', 'Costa');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) = 'sierra') THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('EC', 'Sierra');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) IN ('oriente', 'amazonia', 'amazonía')) THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('EC', 'Oriente');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM regiones WHERE LOWER(nombre) IN ('galapagos', 'galápagos', 'insular')) THEN
    INSERT INTO regiones (pais_iso, nombre) VALUES ('EC', 'Galápagos');
  END IF;
END $$;

-- 4. Insertar las 24 provincias con códigos de 2 letras compatibles con char(2)
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
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'ES', 'Esmeraldas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('manabí', 'manabi')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'MA', 'Manabí');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('los ríos', 'los rios')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'LR', 'Los Ríos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'guayas') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'GY', 'Guayas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'santa elena') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'SE', 'Santa Elena');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'el oro') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_costa, 'EO', 'El Oro');
  END IF;

  -- SIERRA (11 provincias)
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'carchi') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'CR', 'Carchi');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'imbabura') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'IM', 'Imbabura');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'pichincha') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'PI', 'Pichincha');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%santo domingo%') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'SD', 'Santo Domingo de los Tsáchilas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'cotopaxi') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'CO', 'Cotopaxi');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'tungurahua') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'TU', 'Tungurahua');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('bolívar', 'bolivar')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'BO', 'Bolívar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'chimborazo') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'CH', 'Chimborazo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('cañar', 'canar')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'CN', 'Cañar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'azuay') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'AZ', 'Azuay');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'loja') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_sierra, 'LO', 'Loja');
  END IF;

  -- AMAZONÍA / ORIENTE (6 provincias)
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('sucumbíos', 'sucumbios')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'SU', 'Sucumbíos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'orellana') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'OR', 'Orellana');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'napo') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'NA', 'Napo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) = 'pastaza') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'PA', 'Pastaza');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%morona%') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'MS', 'Morona Santiago');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) LIKE '%zamora%') THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_oriente, 'ZA', 'Zamora Chinchipe');
  END IF;

  -- INSULAR / GALÁPAGOS (1 provincia)
  IF NOT EXISTS (SELECT 1 FROM provincias WHERE LOWER(nombre) IN ('galápagos', 'galapagos', 'insular')) THEN
    INSERT INTO provincias (region_id, codigo_estado, nombre) VALUES (v_galapagos, 'GA', 'Galápagos');
  END IF;
END $$;
