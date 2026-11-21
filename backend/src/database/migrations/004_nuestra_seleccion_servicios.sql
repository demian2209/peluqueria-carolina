-- ==========================================
-- MIGRACIÓN 004 - CATÁLOGO "NUESTRA SELECCIÓN"
-- Peluquería Carolina
-- ==========================================

-- 1. Añadir campos de control para la sección "Nuestra Selección" y presentación visual
ALTER TABLE IF EXISTS servicios
ADD COLUMN IF NOT EXISTS en_seleccion BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS orden        INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS imagen_url   TEXT,
ADD COLUMN IF NOT EXISTS etiqueta     VARCHAR(120),
ADD COLUMN IF NOT EXISTS icono        VARCHAR(60) DEFAULT 'auto_awesome',
ADD COLUMN IF NOT EXISTS destacado    BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Índices para optimizar el endpoint público de "Nuestra Selección" y ordenamiento en Admin
CREATE INDEX IF NOT EXISTS idx_servicios_nuestra_seleccion
    ON servicios (activo, en_seleccion, orden);

CREATE INDEX IF NOT EXISTS idx_servicios_categoria_orden
    ON servicios (categoria, orden);

-- 3. Comentarios de documentación en el esquema
COMMENT ON COLUMN servicios.en_seleccion IS 'Indica si el servicio se muestra en la sección pública "Nuestra Selección"';
COMMENT ON COLUMN servicios.orden        IS 'Orden de aparición ascendente dentro de "Nuestra Selección" (1, 2, 3...)';
COMMENT ON COLUMN servicios.imagen_url   IS 'Ruta o URL de la imagen representativa del servicio';
COMMENT ON COLUMN servicios.etiqueta     IS 'Subtítulo o categoría editorial mostrada en la tarjeta pública';
COMMENT ON COLUMN servicios.icono        IS 'Identificador del ícono Material Symbols para la tarjeta';
COMMENT ON COLUMN servicios.destacado    IS 'Indica si la tarjeta ocupa el bloque Hero destacado (col-span-8) en el Bento Grid';

-- 4. Poblar metadatos canónicos para los 10 servicios iniciales del catálogo
UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 1,
    destacado = TRUE,
    etiqueta = 'Alta Coloración & Iluminación',
    icono = 'auto_awesome',
    imagen_url = '/images/servicios/servicio_1.webp'
WHERE nombre ILIKE '%Balayage%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 2,
    destacado = FALSE,
    etiqueta = 'Arquitectura Capilar',
    icono = 'content_cut',
    imagen_url = '/images/servicios/servicio_2.webp'
WHERE nombre ILIKE '%Corte Mujer%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 3,
    destacado = FALSE,
    etiqueta = 'Barbería Clásica & Fade',
    icono = 'face_6',
    imagen_url = '/images/servicios/servicio_3.webp'
WHERE nombre ILIKE '%Caballero%' OR nombre ILIKE '%Fade%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 4,
    destacado = FALSE,
    etiqueta = 'Ritual Tradicional & Vapor',
    icono = 'spa',
    imagen_url = '/images/servicios/servicio_4.webp'
WHERE nombre ILIKE '%Barba%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 5,
    destacado = FALSE,
    etiqueta = 'Coloración Couture',
    icono = 'palette',
    imagen_url = '/images/servicios/servicio_5.webp'
WHERE nombre ILIKE '%Coloración Completa%' OR nombre ILIKE '%Retoque%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 6,
    destacado = FALSE,
    etiqueta = 'Relleno Molecular Antifrizz',
    icono = 'water_drop',
    imagen_url = '/images/servicios/servicio_6.webp'
WHERE nombre ILIKE '%Botox%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 7,
    destacado = FALSE,
    etiqueta = 'Liso Progresivo Vegano',
    icono = 'eco',
    imagen_url = '/images/servicios/servicio_7.webp'
WHERE nombre ILIKE '%Alisado%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 8,
    destacado = FALSE,
    etiqueta = 'Tecnología Biomimética (K18)',
    icono = 'health_and_safety',
    imagen_url = '/images/servicios/servicio_8.webp'
WHERE nombre ILIKE '%K18%' OR nombre ILIKE '%Olaplex%' OR nombre ILIKE '%Reparador%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 9,
    destacado = FALSE,
    etiqueta = 'Estilismo Editorial & Ondas',
    icono = 'auto_awesome',
    imagen_url = '/images/servicios/servicio_9.webp'
WHERE nombre ILIKE '%Peinado%' OR nombre ILIKE '%Ondas%';

UPDATE servicios SET
    en_seleccion = TRUE,
    orden = 10,
    destacado = FALSE,
    etiqueta = 'Cuidado & Nivelación Rusa',
    icono = 'brush',
    imagen_url = '/images/servicios/servicio_10.webp'
WHERE nombre ILIKE '%Manicura%';

-- 5. Políticas RLS para administración del catálogo (Service Role / Admin)
DROP POLICY IF EXISTS "Cualquiera puede leer servicios activos" ON servicios;
CREATE POLICY "Lectura publica de servicios"
    ON servicios FOR SELECT
    USING (TRUE);

