-- ============================================================
-- SEED 002 - DATOS FICTICIOS REALISTAS DE OCTUBRE 2026
-- Peluquería Carolina — PostgreSQL / Supabase
-- ============================================================
-- Prerrequisito: Haber ejecutado 007_reservas_estado_no_asistio.sql
--
-- Métricas exactas garantizadas en Octubre 2026:
--   - Total citas programadas : 45
--   - Inasistencias (no_asistio): 11 (24.4%)
--   - Atendidas (atendida)      : 21 (46.7%)
--   - Confirmadas (confirmada)  :  6 (13.3%) -> proporción moderada
--   - Canceladas (cancelada)    :  5 (11.1%)
--   - Pendientes (pendiente)    :  2 ( 4.4%)
--
-- Distribución semanal (Lun–Dom):
--   - Semana 1 (01–04 Oct):  6 citas | 1 no_asistio (16.7%)
--   - Semana 2 (05–11 Oct): 10 citas | 3 no_asistio (30.0%)
--   - Semana 3 (12–18 Oct): 10 citas | 2 no_asistio (20.0%)
--   - Semana 4 (19–25 Oct): 10 citas | 3 no_asistio (30.0%)
--   - Semana 5 (26–31 Oct):  9 citas | 2 no_asistio (22.2%)
--
-- Protección anti-colisión ("reservas_sin_solapamiento"):
--   1. Limpia previamente cualquier cita existente en el rango de Octubre 2026
--      (y sus referencias en notificaciones/encuestas_satisfaccion) para evitar
--      colisiones con reservas de prueba previas y garantizar exactamente 45 citas.
--   2. Ninguna de las 45 citas se solapa en horario dentro del mismo día, ni siquiera
--      entre estilistas distintos (protección total incluso si varios estilistas
--      compartieran ID por fallback).
-- ============================================================

BEGIN;

-- 0. Limpiar reservas previas de Octubre 2026 para evitar violaciones de
--    "reservas_sin_solapamiento" (23P01) y garantizar exactamente 45 citas en el mes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notificaciones') THEN
        DELETE FROM public.notificaciones
        WHERE reserva_id IN (
            SELECT id FROM public.reservas
            WHERE fecha_hora_inicio >= '2026-10-01 00:00:00-03'::timestamptz
              AND fecha_hora_inicio <  '2026-11-01 00:00:00-03'::timestamptz
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'encuestas_satisfaccion') THEN
        DELETE FROM public.encuestas_satisfaccion
        WHERE reserva_id IN (
            SELECT id FROM public.reservas
            WHERE fecha_hora_inicio >= '2026-10-01 00:00:00-03'::timestamptz
              AND fecha_hora_inicio <  '2026-11-01 00:00:00-03'::timestamptz
        );
    END IF;

    DELETE FROM public.reservas
    WHERE fecha_hora_inicio >= '2026-10-01 00:00:00-03'::timestamptz
      AND fecha_hora_inicio <  '2026-11-01 00:00:00-03'::timestamptz;
END $$;

-- 1. Insertar clientes ficticios de prueba (idempotente por email)
INSERT INTO public.clientes (nombre_completo, email, telefono_whatsapp)
SELECT v.nombre_completo, v.email, v.telefono_whatsapp
FROM (VALUES
    ('María José Contreras',  'mariajose.contreras.oct2026@demo-carolina.cl',  '+56981234001'),
    ('Camila Andrea Reyes',   'camila.reyes.oct2026@demo-carolina.cl',         '+56981234002'),
    ('Sebastián Ignacio Soto','sebastian.soto.oct2026@demo-carolina.cl',       '+56981234003'),
    ('Francisca Belén Díaz',  'francisca.diaz.oct2026@demo-carolina.cl',       '+56981234004'),
    ('Diego Alejandro Silva', 'diego.silva.oct2026@demo-carolina.cl',          '+56981234005'),
    ('Valentina Paz Morales', 'valentina.morales.oct2026@demo-carolina.cl',    '+56981234006'),
    ('Javiera Antonia Rojas', 'javiera.rojas.oct2026@demo-carolina.cl',        '+56981234007'),
    ('Matías Nicolás Araya',  'matias.araya.oct2026@demo-carolina.cl',         '+56981234008'),
    ('Constanza Sofía Vega',  'constanza.vega.oct2026@demo-carolina.cl',       '+56981234009'),
    ('Felipe Andrés Castro',  'felipe.castro.oct2026@demo-carolina.cl',        '+56981234010'),
    ('Catalina Isabel Vera',  'catalina.vera.oct2026@demo-carolina.cl',        '+56981234011'),
    ('Rodrigo Esteban Lara',  'rodrigo.lara.oct2026@demo-carolina.cl',         '+56981234012'),
    ('Isidora Fernanda Ruiz', 'isidora.ruiz.oct2026@demo-carolina.cl',         '+56981234013'),
    ('Tomás Eduardo Muñoz',   'tomas.munoz.oct2026@demo-carolina.cl',          '+56981234014'),
    ('Antonia Beatriz Paredes','antonia.paredes.oct2026@demo-carolina.cl',     '+56981234015'),
    ('Nicolás Gabriel Palma', 'nicolas.palma.oct2026@demo-carolina.cl',        '+56981234016'),
    ('Fernanda Lucía Bravo',  'fernanda.bravo.oct2026@demo-carolina.cl',       '+56981234017'),
    ('Cristóbal Javier Ortiz','cristobal.ortiz.oct2026@demo-carolina.cl',      '+56981234018'),
    ('Sofía Alejandra Núñez', 'sofia.nunez.oct2026@demo-carolina.cl',          '+56981234019'),
    ('Benjamín Ignacio Tapia','benjamin.tapia.oct2026@demo-carolina.cl',       '+56981234020'),
    ('Paulina Andrea Fuentes','paulina.fuentes.oct2026@demo-carolina.cl',      '+56981234021'),
    ('Daniela Rocío Campos',  'daniela.campos.oct2026@demo-carolina.cl',       '+56981234022'),
    ('Ignacio Alberto Lagos', 'ignacio.lagos.oct2026@demo-carolina.cl',        '+56981234023'),
    ('Loreto Patricia Vidal', 'loreto.vidal.oct2026@demo-carolina.cl',         '+56981234024'),
    ('Macarena Paz Herrera',  'macarena.herrera.oct2026@demo-carolina.cl',     '+56981234025')
) AS v(nombre_completo, email, telefono_whatsapp)
WHERE NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE LOWER(c.email) = LOWER(v.email)
);

-- 2. Insertar 45 citas programadas en Octubre 2026 (sin solapamientos horarios ni en un mismo día)
WITH seed_raw(codigo_reserva, cliente_email, estilista_match, servicio_match, inicio_ts, fin_ts, estado) AS (
    VALUES
    -- =========================================================================
    -- SEMANA 1: Jue 01 Oct – Dom 04 Oct 2026 (6 citas | 1 no_asistio = 16.7%)
    -- Estados: 3 atendida, 1 no_asistio, 1 confirmada, 1 cancelada, 0 pendiente
    -- =========================================================================
    ('PC-OCT26-01', 'mariajose.contreras.oct2026@demo-carolina.cl', 'Carolina',  'Balayage',     '2026-10-01 09:30:00-03'::timestamptz, '2026-10-01 12:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-02', 'sebastian.soto.oct2026@demo-carolina.cl',      'Mat',       'Caballero',    '2026-10-01 15:00:00-03'::timestamptz, '2026-10-01 15:40:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-03', 'francisca.diaz.oct2026@demo-carolina.cl',      'Camila',    'Botox',        '2026-10-02 10:30:00-03'::timestamptz, '2026-10-02 12:00:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-04', 'javiera.rojas.oct2026@demo-carolina.cl',       'Gonzalo',   'Corte Mujer',  '2026-10-02 15:00:00-03'::timestamptz, '2026-10-02 15:50:00-03'::timestamptz, 'cancelada'),
    ('PC-OCT26-05', 'constanza.vega.oct2026@demo-carolina.cl',      'Valentina', 'Manicura',     '2026-10-03 11:00:00-03'::timestamptz, '2026-10-03 12:00:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-06', 'catalina.vera.oct2026@demo-carolina.cl',       'Valentina', 'Manicura',     '2026-10-04 12:00:00-03'::timestamptz, '2026-10-04 13:00:00-03'::timestamptz, 'confirmada'),

    -- =========================================================================
    -- SEMANA 2: Lun 05 Oct – Dom 11 Oct 2026 (10 citas | 3 no_asistio = 30.0%)
    -- Estados: 5 atendida, 3 no_asistio, 1 confirmada, 1 cancelada, 0 pendiente
    -- =========================================================================
    ('PC-OCT26-07', 'camila.reyes.oct2026@demo-carolina.cl',        'Carolina',  'Coloraci',     '2026-10-05 10:00:00-03'::timestamptz, '2026-10-05 11:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-08', 'diego.silva.oct2026@demo-carolina.cl',         'Mat',       'Barba',        '2026-10-05 15:00:00-03'::timestamptz, '2026-10-05 15:35:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-09', 'isidora.ruiz.oct2026@demo-carolina.cl',        'Gonzalo',   'Corte Mujer',  '2026-10-06 11:00:00-03'::timestamptz, '2026-10-06 11:50:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-10', 'antonia.paredes.oct2026@demo-carolina.cl',     'Camila',    'Alisado',      '2026-10-06 14:00:00-03'::timestamptz, '2026-10-06 16:30:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-11', 'valentina.morales.oct2026@demo-carolina.cl',   'Valentina', 'Manicura',     '2026-10-07 10:30:00-03'::timestamptz, '2026-10-07 11:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-12', 'matias.araya.oct2026@demo-carolina.cl',        'Mat',       'Caballero',    '2026-10-08 10:00:00-03'::timestamptz, '2026-10-08 10:40:00-03'::timestamptz, 'cancelada'),
    ('PC-OCT26-13', 'fernanda.bravo.oct2026@demo-carolina.cl',      'Carolina',  'Balayage',     '2026-10-08 13:00:00-03'::timestamptz, '2026-10-08 16:00:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-14', 'sofia.nunez.oct2026@demo-carolina.cl',         'Gonzalo',   'Peinado',      '2026-10-09 16:00:00-03'::timestamptz, '2026-10-09 17:00:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-15', 'paulina.fuentes.oct2026@demo-carolina.cl',     'Camila',    'Masaje',       '2026-10-10 11:00:00-03'::timestamptz, '2026-10-10 11:45:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-16', 'daniela.campos.oct2026@demo-carolina.cl',      'Valentina', 'Manicura',     '2026-10-11 11:00:00-03'::timestamptz, '2026-10-11 12:00:00-03'::timestamptz, 'confirmada'),

    -- =========================================================================
    -- SEMANA 3: Lun 12 Oct – Dom 18 Oct 2026 (10 citas | 2 no_asistio = 20.0%)
    -- Estados: 5 atendida, 2 no_asistio, 1 confirmada, 1 cancelada, 1 pendiente
    -- =========================================================================
    ('PC-OCT26-17', 'felipe.castro.oct2026@demo-carolina.cl',       'Mat',       'Caballero',    '2026-10-12 09:30:00-03'::timestamptz, '2026-10-12 10:10:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-18', 'loreto.vidal.oct2026@demo-carolina.cl',        'Carolina',  'Coloraci',     '2026-10-12 14:00:00-03'::timestamptz, '2026-10-12 15:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-19', 'macarena.herrera.oct2026@demo-carolina.cl',    'Camila',    'Botox',        '2026-10-13 11:00:00-03'::timestamptz, '2026-10-13 12:30:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-20', 'rodrigo.lara.oct2026@demo-carolina.cl',        'Mat',       'Barba',        '2026-10-14 11:00:00-03'::timestamptz, '2026-10-14 11:35:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-21', 'mariajose.contreras.oct2026@demo-carolina.cl', 'Valentina', 'Manicura',     '2026-10-14 15:00:00-03'::timestamptz, '2026-10-14 16:00:00-03'::timestamptz, 'cancelada'),
    ('PC-OCT26-22', 'francisca.diaz.oct2026@demo-carolina.cl',      'Gonzalo',   'Corte Mujer',  '2026-10-15 10:30:00-03'::timestamptz, '2026-10-15 11:20:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-23', 'tomas.munoz.oct2026@demo-carolina.cl',         'Mat',       'Caballero',    '2026-10-15 15:00:00-03'::timestamptz, '2026-10-15 15:40:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-24', 'javiera.rojas.oct2026@demo-carolina.cl',       'Carolina',  'Balayage',     '2026-10-16 09:30:00-03'::timestamptz, '2026-10-16 12:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-25', 'constanza.vega.oct2026@demo-carolina.cl',      'Camila',    'Masaje',       '2026-10-17 12:00:00-03'::timestamptz, '2026-10-17 12:45:00-03'::timestamptz, 'pendiente'),
    ('PC-OCT26-26', 'catalina.vera.oct2026@demo-carolina.cl',       'Valentina', 'Manicura',     '2026-10-18 14:00:00-03'::timestamptz, '2026-10-18 15:00:00-03'::timestamptz, 'confirmada'),

    -- =========================================================================
    -- SEMANA 4: Lun 19 Oct – Dom 25 Oct 2026 (10 citas | 3 no_asistio = 30.0%)
    -- Estados: 4 atendida, 3 no_asistio, 2 confirmada, 1 cancelada, 0 pendiente
    -- =========================================================================
    ('PC-OCT26-27', 'nicolas.palma.oct2026@demo-carolina.cl',       'Mat',       'Caballero',    '2026-10-19 10:00:00-03'::timestamptz, '2026-10-19 10:40:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-28', 'isidora.ruiz.oct2026@demo-carolina.cl',        'Gonzalo',   'Peinado',      '2026-10-19 16:00:00-03'::timestamptz, '2026-10-19 17:00:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-29', 'antonia.paredes.oct2026@demo-carolina.cl',     'Carolina',  'Coloraci',     '2026-10-20 11:00:00-03'::timestamptz, '2026-10-20 12:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-30', 'cristobal.ortiz.oct2026@demo-carolina.cl',     'Mat',       'Barba',        '2026-10-21 11:00:00-03'::timestamptz, '2026-10-21 11:35:00-03'::timestamptz, 'cancelada'),
    ('PC-OCT26-31', 'fernanda.bravo.oct2026@demo-carolina.cl',      'Camila',    'Alisado',      '2026-10-21 14:00:00-03'::timestamptz, '2026-10-21 16:30:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-32', 'sofia.nunez.oct2026@demo-carolina.cl',         'Valentina', 'Manicura',     '2026-10-22 10:30:00-03'::timestamptz, '2026-10-22 11:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-33', 'benjamin.tapia.oct2026@demo-carolina.cl',      'Mat',       'Caballero',    '2026-10-22 14:00:00-03'::timestamptz, '2026-10-22 14:40:00-03'::timestamptz, 'confirmada'),
    ('PC-OCT26-34', 'paulina.fuentes.oct2026@demo-carolina.cl',     'Gonzalo',   'Corte Mujer',  '2026-10-23 12:00:00-03'::timestamptz, '2026-10-23 12:50:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-35', 'daniela.campos.oct2026@demo-carolina.cl',      'Carolina',  'Balayage',     '2026-10-24 09:30:00-03'::timestamptz, '2026-10-24 12:30:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-36', 'loreto.vidal.oct2026@demo-carolina.cl',        'Valentina', 'Manicura',     '2026-10-25 15:00:00-03'::timestamptz, '2026-10-25 16:00:00-03'::timestamptz, 'confirmada'),

    -- =========================================================================
    -- SEMANA 5: Lun 26 Oct – Sáb 31 Oct 2026 (9 citas | 2 no_asistio = 22.2%)
    -- Estados: 4 atendida, 2 no_asistio, 1 confirmada, 1 cancelada, 1 pendiente
    -- =========================================================================
    ('PC-OCT26-37', 'ignacio.lagos.oct2026@demo-carolina.cl',       'Mat',       'Caballero',    '2026-10-26 10:00:00-03'::timestamptz, '2026-10-26 10:40:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-38', 'macarena.herrera.oct2026@demo-carolina.cl',    'Gonzalo',   'Corte Mujer',  '2026-10-26 15:00:00-03'::timestamptz, '2026-10-26 15:50:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-39', 'camila.reyes.oct2026@demo-carolina.cl',        'Camila',    'Botox',        '2026-10-27 11:00:00-03'::timestamptz, '2026-10-27 12:30:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-40', 'sebastian.soto.oct2026@demo-carolina.cl',      'Mat',       'Barba',        '2026-10-28 11:00:00-03'::timestamptz, '2026-10-28 11:35:00-03'::timestamptz, 'cancelada'),
    ('PC-OCT26-41', 'valentina.morales.oct2026@demo-carolina.cl',   'Valentina', 'Manicura',     '2026-10-28 16:00:00-03'::timestamptz, '2026-10-28 17:00:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-42', 'mariajose.contreras.oct2026@demo-carolina.cl', 'Carolina',  'Coloraci',     '2026-10-29 10:00:00-03'::timestamptz, '2026-10-29 11:30:00-03'::timestamptz, 'no_asistio'),
    ('PC-OCT26-43', 'francisca.diaz.oct2026@demo-carolina.cl',      'Gonzalo',   'Peinado',      '2026-10-30 14:00:00-03'::timestamptz, '2026-10-30 15:00:00-03'::timestamptz, 'atendida'),
    ('PC-OCT26-44', 'diego.silva.oct2026@demo-carolina.cl',         'Mat',       'Caballero',    '2026-10-31 10:30:00-03'::timestamptz, '2026-10-31 11:10:00-03'::timestamptz, 'confirmada'),
    ('PC-OCT26-45', 'javiera.rojas.oct2026@demo-carolina.cl',       'Camila',    'Masaje',       '2026-10-31 15:00:00-03'::timestamptz, '2026-10-31 15:45:00-03'::timestamptz, 'pendiente')
),
resueltas AS (
    SELECT
        sr.codigo_reserva,
        (SELECT c.id FROM public.clientes c WHERE LOWER(c.email) = LOWER(sr.cliente_email) ORDER BY c.id DESC LIMIT 1) AS cliente_id,
        COALESCE(
            (SELECT e.id FROM public.estilistas e WHERE e.nombre ILIKE sr.estilista_match || '%' ORDER BY e.id ASC LIMIT 1),
            (SELECT e.id FROM public.estilistas e ORDER BY e.id ASC LIMIT 1)
        ) AS estilista_id,
        COALESCE(
            (SELECT s.id FROM public.servicios s WHERE s.nombre ILIKE '%' || sr.servicio_match || '%' ORDER BY s.id ASC LIMIT 1),
            (SELECT s.id FROM public.servicios s ORDER BY s.id ASC LIMIT 1)
        ) AS servicio_id,
        sr.inicio_ts,
        sr.fin_ts,
        sr.estado
    FROM seed_raw sr
)
INSERT INTO public.reservas (
    codigo_reserva,
    cliente_id,
    estilista_id,
    servicio_id,
    fecha_hora_inicio,
    fecha_hora_fin,
    estado
)
SELECT
    r.codigo_reserva,
    r.cliente_id,
    r.estilista_id,
    r.servicio_id,
    r.inicio_ts,
    r.fin_ts,
    r.estado
FROM resueltas r
WHERE r.cliente_id IS NOT NULL
  AND r.estilista_id IS NOT NULL
  AND r.servicio_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.reservas existing WHERE existing.codigo_reserva = r.codigo_reserva
  );

COMMIT;

-- ============================================================
-- CONSULTA DE VERIFICACIÓN INMEDIATA (Octubre 2026)
-- ============================================================
SELECT
    COUNT(*)                                                                  AS total_programadas,
    COUNT(*) FILTER (WHERE estado = 'no_asistio')                             AS total_no_asistio,
    ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1) AS tasa_inasistencia_pct,
    COUNT(*) FILTER (WHERE estado = 'confirmada')                             AS confirmadas,
    COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))              AS atendidas,
    COUNT(*) FILTER (WHERE estado = 'cancelada')                              AS canceladas,
    COUNT(*) FILTER (WHERE estado = 'pendiente')                              AS pendientes
FROM public.reservas
WHERE fecha_hora_inicio >= '2026-10-01 00:00:00-03'::timestamptz
  AND fecha_hora_inicio <  '2026-11-01 00:00:00-03'::timestamptz;
