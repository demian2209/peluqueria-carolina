-- ============================================================
-- Migración 009: Vistas Analíticas y RPCs de KPIs
-- Peluquería Carolina — PostgreSQL / Supabase
-- ============================================================
-- Prerrequisitos:
--   * 007_reservas_estado_no_asistio.sql
--   * 008_chatbot_historial_y_horarios.sql
--
-- Provee vistas y RPCs optimizadas en PostgreSQL para el módulo de KPIs:
--   1. rpc_kpi_confirmaciones()            -> Total actual de reservas confirmadas en el sistema
--   2. rpc_kpi_inasistencias(desde, hasta) -> Desglose mensual, semanal (tasa semanal) y diario
--   3. rpc_kpi_chatbot_fuera_horario(...)  -> Rendimiento del chatbot fuera de horario laboral
--
-- Todas las fechas y horas se evalúan en zona horaria America/Santiago.
-- Acceso exclusivo vía backend con service_role.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Vistas SQL analíticas de inasistencias (Mensual, Semanal, Diaria)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_kpi_inasistencias_mensual AS
SELECT
    TO_CHAR(fecha_hora_inicio AT TIME ZONE 'America/Santiago', 'YYYY-MM') AS mes,
    COUNT(*)::int                                                          AS total_programadas,
    COUNT(*) FILTER (WHERE estado = 'no_asistio')::int                     AS total_no_asistio,
    COALESCE(
        ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1),
        0.0
    )::numeric(5,1)                                                        AS tasa_inasistencia_pct,
    COUNT(*) FILTER (WHERE estado = 'confirmada')::int                     AS confirmadas,
    COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))::int      AS atendidas,
    COUNT(*) FILTER (WHERE estado = 'cancelada')::int                      AS canceladas,
    COUNT(*) FILTER (WHERE estado = 'pendiente')::int                      AS pendientes
FROM public.reservas
GROUP BY 1
ORDER BY 1 ASC;

CREATE OR REPLACE VIEW public.v_kpi_inasistencias_semanal AS
SELECT
    DATE_TRUNC('week', fecha_hora_inicio AT TIME ZONE 'America/Santiago')::date            AS semana_inicio,
    (DATE_TRUNC('week', fecha_hora_inicio AT TIME ZONE 'America/Santiago')::date + 6)      AS semana_fin,
    COUNT(*)::int                                                                          AS total_programadas,
    COUNT(*) FILTER (WHERE estado = 'no_asistio')::int                                     AS total_no_asistio,
    COALESCE(
        ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1),
        0.0
    )::numeric(5,1)                                                                        AS tasa_inasistencia_pct,
    COUNT(*) FILTER (WHERE estado = 'confirmada')::int                                     AS confirmadas,
    COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))::int                      AS atendidas,
    COUNT(*) FILTER (WHERE estado = 'cancelada')::int                                      AS canceladas,
    COUNT(*) FILTER (WHERE estado = 'pendiente')::int                                      AS pendientes
FROM public.reservas
GROUP BY 1, 2
ORDER BY 1 ASC;

CREATE OR REPLACE VIEW public.v_kpi_inasistencias_diaria AS
SELECT
    (fecha_hora_inicio AT TIME ZONE 'America/Santiago')::date              AS fecha,
    COUNT(*)::int                                                          AS total_programadas,
    COUNT(*) FILTER (WHERE estado = 'no_asistio')::int                     AS total_no_asistio,
    COALESCE(
        ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1),
        0.0
    )::numeric(5,1)                                                        AS tasa_inasistencia_pct,
    COUNT(*) FILTER (WHERE estado = 'confirmada')::int                     AS confirmadas,
    COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))::int      AS atendidas,
    COUNT(*) FILTER (WHERE estado = 'cancelada')::int                      AS canceladas,
    COUNT(*) FILTER (WHERE estado = 'pendiente')::int                      AS pendientes
FROM public.reservas
GROUP BY 1
ORDER BY 1 ASC;

-- ------------------------------------------------------------
-- 2. RPC 1: KPI Confirmaciones de reservas (total actual en el sistema)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_kpi_confirmaciones()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    WITH base AS (
        SELECT
            estado,
            (fecha_hora_inicio AT TIME ZONE 'America/Santiago')::date AS fecha_local
        FROM public.reservas
    ),
    mes_actual AS (
        SELECT DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Santiago')::date AS ini_mes
    )
    SELECT jsonb_build_object(
        'total_confirmadas_actual',
            COUNT(*) FILTER (WHERE b.estado = 'confirmada')::int,
        'total_confirmadas_mes_actual',
            COUNT(*) FILTER (
                WHERE b.estado = 'confirmada'
                  AND DATE_TRUNC('month', b.fecha_local)::date = (SELECT ini_mes FROM mes_actual)
            )::int,
        'total_reservas_sistema',
            COUNT(*)::int,
        'tasa_confirmacion_pct',
            COALESCE(
                ROUND(COUNT(*) FILTER (WHERE b.estado = 'confirmada') * 100.0 / NULLIF(COUNT(*), 0), 1),
                0.0
            ),
        'por_estado', jsonb_build_object(
            'pendiente',  COUNT(*) FILTER (WHERE b.estado = 'pendiente')::int,
            'confirmada', COUNT(*) FILTER (WHERE b.estado = 'confirmada')::int,
            'atendida',   COUNT(*) FILTER (WHERE b.estado IN ('atendida', 'completada'))::int,
            'cancelada',  COUNT(*) FILTER (WHERE b.estado = 'cancelada')::int,
            'no_asistio', COUNT(*) FILTER (WHERE b.estado = 'no_asistio')::int
        )
    )
    FROM base b;
$$;

-- ------------------------------------------------------------
-- 3. RPC 2: KPI Inasistencias (Mensual, Semanal y Diaria)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_kpi_inasistencias(
    p_fecha_desde date DEFAULT NULL,
    p_fecha_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    WITH filtradas AS (
        SELECT
            id,
            estado,
            (fecha_hora_inicio AT TIME ZONE 'America/Santiago')::date AS fecha_local
        FROM public.reservas
        WHERE (p_fecha_desde IS NULL OR (fecha_hora_inicio AT TIME ZONE 'America/Santiago')::date >= p_fecha_desde)
          AND (p_fecha_hasta IS NULL OR (fecha_hora_inicio AT TIME ZONE 'America/Santiago')::date <= p_fecha_hasta)
    ),
    resumen AS (
        SELECT jsonb_build_object(
            'total_programadas', COUNT(*)::int,
            'total_no_asistio',  COUNT(*) FILTER (WHERE estado = 'no_asistio')::int,
            'tasa_inasistencia_pct',
                COALESCE(ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1), 0.0),
            'confirmadas', COUNT(*) FILTER (WHERE estado = 'confirmada')::int,
            'atendidas',   COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))::int,
            'canceladas',  COUNT(*) FILTER (WHERE estado = 'cancelada')::int,
            'pendientes',  COUNT(*) FILTER (WHERE estado = 'pendiente')::int
        ) AS obj
        FROM filtradas
    ),
    mensual AS (
        SELECT COALESCE(jsonb_agg(row_obj ORDER BY mes ASC), '[]'::jsonb) AS arr
        FROM (
            SELECT
                TO_CHAR(fecha_local, 'YYYY-MM') AS mes,
                jsonb_build_object(
                    'mes',                   TO_CHAR(fecha_local, 'YYYY-MM'),
                    'total_programadas',     COUNT(*)::int,
                    'total_no_asistio',      COUNT(*) FILTER (WHERE estado = 'no_asistio')::int,
                    'tasa_inasistencia_pct', COALESCE(ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1), 0.0),
                    'confirmadas',           COUNT(*) FILTER (WHERE estado = 'confirmada')::int,
                    'atendidas',             COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))::int,
                    'canceladas',            COUNT(*) FILTER (WHERE estado = 'cancelada')::int,
                    'pendientes',            COUNT(*) FILTER (WHERE estado = 'pendiente')::int
                ) AS row_obj
            FROM filtradas
            GROUP BY 1
        ) m
    ),
    semanal AS (
        SELECT COALESCE(jsonb_agg(row_obj ORDER BY semana_inicio ASC), '[]'::jsonb) AS arr
        FROM (
            SELECT
                DATE_TRUNC('week', fecha_local)::date AS semana_inicio,
                jsonb_build_object(
                    'semana_inicio',         DATE_TRUNC('week', fecha_local)::date,
                    'semana_fin',            (DATE_TRUNC('week', fecha_local)::date + 6),
                    'primer_dia_con_citas',  MIN(fecha_local),
                    'ultimo_dia_con_citas',  MAX(fecha_local),
                    'total_programadas',     COUNT(*)::int,
                    'total_no_asistio',      COUNT(*) FILTER (WHERE estado = 'no_asistio')::int,
                    'tasa_inasistencia_pct', COALESCE(ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1), 0.0),
                    'confirmadas',           COUNT(*) FILTER (WHERE estado = 'confirmada')::int,
                    'atendidas',             COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))::int,
                    'canceladas',            COUNT(*) FILTER (WHERE estado = 'cancelada')::int,
                    'pendientes',            COUNT(*) FILTER (WHERE estado = 'pendiente')::int
                ) AS row_obj
            FROM filtradas
            GROUP BY 1
        ) w
    ),
    diaria AS (
        SELECT COALESCE(jsonb_agg(row_obj ORDER BY fecha_local ASC), '[]'::jsonb) AS arr
        FROM (
            SELECT
                fecha_local,
                jsonb_build_object(
                    'fecha',                 fecha_local,
                    'total_programadas',     COUNT(*)::int,
                    'total_no_asistio',      COUNT(*) FILTER (WHERE estado = 'no_asistio')::int,
                    'tasa_inasistencia_pct', COALESCE(ROUND(COUNT(*) FILTER (WHERE estado = 'no_asistio') * 100.0 / NULLIF(COUNT(*), 0), 1), 0.0),
                    'confirmadas',           COUNT(*) FILTER (WHERE estado = 'confirmada')::int,
                    'atendidas',             COUNT(*) FILTER (WHERE estado IN ('atendida', 'completada'))::int,
                    'canceladas',            COUNT(*) FILTER (WHERE estado = 'cancelada')::int,
                    'pendientes',            COUNT(*) FILTER (WHERE estado = 'pendiente')::int
                ) AS row_obj
            FROM filtradas
            GROUP BY 1
        ) d
    )
    SELECT jsonb_build_object(
        'resumen_periodo', (SELECT obj FROM resumen),
        'mensual',         (SELECT arr FROM mensual),
        'semanal',         (SELECT arr FROM semanal),
        'diaria',          (SELECT arr FROM diaria)
    );
$$;

-- ------------------------------------------------------------
-- 4. RPC 3: KPI Rendimiento del Chatbot fuera de horario laboral
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_kpi_chatbot_fuera_horario(
    p_fecha_desde date DEFAULT NULL,
    p_fecha_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    WITH convs AS (
        SELECT
            id,
            categorias,
            public.es_fuera_horario_laboral(iniciada_en) AS fuera_actual,
            iniciada_en AT TIME ZONE 'America/Santiago'  AS local_ts
        FROM public.chatbot_conversaciones
        WHERE (p_fecha_desde IS NULL OR (iniciada_en AT TIME ZONE 'America/Santiago')::date >= p_fecha_desde)
          AND (p_fecha_hasta IS NULL OR (iniciada_en AT TIME ZONE 'America/Santiago')::date <= p_fecha_hasta)
    ),
    msgs AS (
        SELECT
            id,
            categorias_detectadas,
            public.es_fuera_horario_laboral(creado_en)   AS fuera_actual,
            creado_en AT TIME ZONE 'America/Santiago'    AS local_ts
        FROM public.chatbot_mensajes
        WHERE rol = 'usuario'
          AND (p_fecha_desde IS NULL OR (creado_en AT TIME ZONE 'America/Santiago')::date >= p_fecha_desde)
          AND (p_fecha_hasta IS NULL OR (creado_en AT TIME ZONE 'America/Santiago')::date <= p_fecha_hasta)
    ),
    horas AS (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'hora',          h.hr,
                'total',         COALESCE(m.total, 0),
                'fuera_horario', COALESCE(m.fuera, 0),
                'en_horario',    COALESCE(m.dentro, 0)
            ) ORDER BY h.hr ASC
        ), '[]'::jsonb) AS arr
        FROM generate_series(0, 23) AS h(hr)
        LEFT JOIN (
            SELECT
                EXTRACT(HOUR FROM local_ts)::int                        AS hr,
                COUNT(*)::int                                           AS total,
                COUNT(*) FILTER (WHERE fuera_actual)::int               AS fuera,
                COUNT(*) FILTER (WHERE NOT fuera_actual)::int           AS dentro
            FROM msgs
            GROUP BY 1
        ) m ON m.hr = h.hr
    ),
    top_cats AS (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object('categoria', cat, 'total', cnt)
            ORDER BY cnt DESC, cat ASC
        ), '[]'::jsonb) AS arr
        FROM (
            SELECT unnest(categorias) AS cat, COUNT(*)::int AS cnt
            FROM convs
            WHERE fuera_actual = TRUE
            GROUP BY 1
        ) t
    ),
    horarios_cfg AS (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'dia_semana',    dia_semana,
                'abierto',       abierto,
                'hora_apertura', TO_CHAR(hora_apertura, 'HH24:MI'),
                'hora_cierre',   TO_CHAR(hora_cierre, 'HH24:MI')
            ) ORDER BY dia_semana ASC
        ), '[]'::jsonb) AS arr
        FROM public.configuracion_horario_negocio
    )
    SELECT jsonb_build_object(
        'total_conversaciones',
            (SELECT COUNT(*)::int FROM convs),
        'conversaciones_fuera_horario',
            (SELECT COUNT(*) FILTER (WHERE fuera_actual)::int FROM convs),
        'conversaciones_en_horario',
            (SELECT COUNT(*) FILTER (WHERE NOT fuera_actual)::int FROM convs),
        'pct_conversaciones_fuera_horario',
            (SELECT COALESCE(ROUND(COUNT(*) FILTER (WHERE fuera_actual) * 100.0 / NULLIF(COUNT(*), 0), 1), 0.0) FROM convs),
        'total_interacciones',
            (SELECT COUNT(*)::int FROM msgs),
        'interacciones_fuera_horario',
            (SELECT COUNT(*) FILTER (WHERE fuera_actual)::int FROM msgs),
        'interacciones_en_horario',
            (SELECT COUNT(*) FILTER (WHERE NOT fuera_actual)::int FROM msgs),
        'pct_interacciones_fuera_horario',
            (SELECT COALESCE(ROUND(COUNT(*) FILTER (WHERE fuera_actual) * 100.0 / NULLIF(COUNT(*), 0), 1), 0.0) FROM msgs),
        'distribucion_por_hora',
            (SELECT arr FROM horas),
        'top_categorias_fuera_horario',
            (SELECT arr FROM top_cats),
        'horario_configurado',
            (SELECT arr FROM horarios_cfg)
    );
$$;

-- ------------------------------------------------------------
-- 5. Permisos: solo service_role puede invocar las RPCs y vistas
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE ALL ON public.v_kpi_inasistencias_mensual FROM PUBLIC, anon, authenticated;
        REVOKE ALL ON public.v_kpi_inasistencias_semanal FROM PUBLIC, anon, authenticated;
        REVOKE ALL ON public.v_kpi_inasistencias_diaria  FROM PUBLIC, anon, authenticated;
        GRANT SELECT ON public.v_kpi_inasistencias_mensual, public.v_kpi_inasistencias_semanal, public.v_kpi_inasistencias_diaria TO service_role;

        REVOKE ALL ON FUNCTION public.rpc_kpi_confirmaciones() FROM PUBLIC, anon, authenticated;
        REVOKE ALL ON FUNCTION public.rpc_kpi_inasistencias(date, date) FROM PUBLIC, anon, authenticated;
        REVOKE ALL ON FUNCTION public.rpc_kpi_chatbot_fuera_horario(date, date) FROM PUBLIC, anon, authenticated;

        GRANT EXECUTE ON FUNCTION public.rpc_kpi_confirmaciones() TO service_role;
        GRANT EXECUTE ON FUNCTION public.rpc_kpi_inasistencias(date, date) TO service_role;
        GRANT EXECUTE ON FUNCTION public.rpc_kpi_chatbot_fuera_horario(date, date) TO service_role;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
