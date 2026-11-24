-- ============================================================
-- Migración 008: Historial del Chatbot + Horario de Negocio
-- Peluquería Carolina — PostgreSQL / Supabase
-- ============================================================
-- Crea:
--   * configuracion_horario_negocio  (horario laboral por día, base del KPI "fuera de horario")
--   * chatbot_conversaciones         (1 fila por sesión de chat, categorías text[] + GIN)
--   * chatbot_mensajes               (1 fila por mensaje usuario/asistente con timestamptz exacto)
--   * es_fuera_horario_laboral()     (evalúa un timestamptz contra el horario configurado)
--   * registrar_interaccion_chatbot()(RPC atómica usada por n8n: upsert conversación + 2 mensajes)
--
-- Horario laboral inicial = UNIÓN de las jornadas de los 5 estilistas:
--   Carolina  Lun–Sáb 09:00–18:00 | Matías   Lun–Sáb 09:00–17:00
--   Camila    Mar–Sáb 10:00–19:00 | Gonzalo  Lun–Vie 10:00–19:00
--   Valentina Mié–Dom 10:00–18:00
--   => Lun–Sáb 09:00–19:00 | Domingo 10:00–18:00 (zona horaria America/Santiago)
-- El horario es editable en la tabla sin tocar código (los seeds usan ON CONFLICT DO NOTHING).
--
-- Totalmente idempotente. Acceso exclusivo vía backend/n8n con service_role (RLS sin políticas).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Catálogo cerrado de categorías + normalizador
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chatbot_categorias_validas()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ARRAY[
        'servicios', 'precios', 'horarios', 'estilistas', 'reservar_hora',
        'cancelar_reprogramar', 'ubicacion_contacto', 'faqs', 'otros'
    ]::text[]
$$;

-- Filtra contra el catálogo, elimina duplicados, ordena, descarta 'otros' si hay otras
-- categorías y garantiza al menos ['otros'].
CREATE OR REPLACE FUNCTION public.normalizar_categorias_chatbot(p_categorias text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_result text[];
BEGIN
    SELECT COALESCE(array_agg(s.c ORDER BY s.c), '{}'::text[])
    INTO v_result
    FROM (
        SELECT DISTINCT lower(btrim(x)) AS c
        FROM unnest(COALESCE(p_categorias, '{}'::text[])) AS x
    ) s
    WHERE s.c = ANY (public.chatbot_categorias_validas());

    IF cardinality(v_result) > 1 THEN
        v_result := array_remove(v_result, 'otros');
    END IF;

    IF cardinality(v_result) = 0 THEN
        v_result := ARRAY['otros']::text[];
    END IF;

    RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- 2. Horario laboral del negocio
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion_horario_negocio (
    dia_semana     SMALLINT PRIMARY KEY CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 1=Lun, ..., 6=Sáb
    abierto        BOOLEAN NOT NULL DEFAULT TRUE,
    hora_apertura  TIME,
    hora_cierre    TIME,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (abierto = FALSE OR (hora_apertura IS NOT NULL AND hora_cierre IS NOT NULL AND hora_cierre > hora_apertura))
);

COMMENT ON TABLE public.configuracion_horario_negocio IS
    'Horario laboral del salón por día de semana (America/Santiago). Base del KPI de chatbot fuera de horario.';

INSERT INTO public.configuracion_horario_negocio (dia_semana, abierto, hora_apertura, hora_cierre) VALUES
    (0, TRUE, '10:00', '18:00'),  -- Domingo (solo Valentina)
    (1, TRUE, '09:00', '19:00'),  -- Lunes
    (2, TRUE, '09:00', '19:00'),  -- Martes
    (3, TRUE, '09:00', '19:00'),  -- Miércoles
    (4, TRUE, '09:00', '19:00'),  -- Jueves
    (5, TRUE, '09:00', '19:00'),  -- Viernes
    (6, TRUE, '09:00', '19:00')   -- Sábado
ON CONFLICT (dia_semana) DO NOTHING;

-- ¿El instante dado cae fuera del horario laboral configurado? (evalúa en hora de Chile)
CREATE OR REPLACE FUNCTION public.es_fuera_horario_laboral(p_ts timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_local timestamp;
    v_cfg   public.configuracion_horario_negocio%ROWTYPE;
BEGIN
    v_local := p_ts AT TIME ZONE 'America/Santiago';

    SELECT * INTO v_cfg
    FROM public.configuracion_horario_negocio
    WHERE dia_semana = EXTRACT(DOW FROM v_local)::smallint;

    IF NOT FOUND OR NOT v_cfg.abierto THEN
        RETURN TRUE;
    END IF;

    RETURN NOT (v_local::time >= v_cfg.hora_apertura AND v_local::time < v_cfg.hora_cierre);
END;
$$;

-- ------------------------------------------------------------
-- 3. Conversaciones y mensajes del chatbot
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatbot_conversaciones (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id             VARCHAR(100) NOT NULL UNIQUE,
    canal                  VARCHAR(20)  NOT NULL DEFAULT 'web' CHECK (canal IN ('web', 'whatsapp')),
    categorias             TEXT[]       NOT NULL DEFAULT ARRAY['otros']::text[]
                           CHECK (categorias <@ public.chatbot_categorias_validas()),
    total_mensajes         INT          NOT NULL DEFAULT 0 CHECK (total_mensajes >= 0),
    fuera_horario_laboral  BOOLEAN      NOT NULL DEFAULT FALSE,  -- evaluado al INICIO de la conversación
    iniciada_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ultima_interaccion_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resumen                VARCHAR(160),                          -- extracto del primer mensaje del cliente
    metadata               JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chatbot_conversaciones IS
    'Una fila por sesión de chat del asistente IA. categorias = unión de todas las categorías detectadas.';

CREATE TABLE IF NOT EXISTS public.chatbot_mensajes (
    id                     BIGSERIAL PRIMARY KEY,
    conversacion_id        UUID         NOT NULL REFERENCES public.chatbot_conversaciones(id) ON DELETE CASCADE,
    rol                    VARCHAR(12)  NOT NULL CHECK (rol IN ('usuario', 'asistente')),
    contenido              TEXT         NOT NULL,
    categorias_detectadas  TEXT[]       NOT NULL DEFAULT '{}'::text[]
                           CHECK (categorias_detectadas <@ public.chatbot_categorias_validas()),
    fuera_horario_laboral  BOOLEAN      NOT NULL DEFAULT FALSE,
    origen                 VARCHAR(20)  NOT NULL DEFAULT 'n8n' CHECK (origen IN ('n8n', 'gemini_direct', 'sistema')),
    creado_en              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chatbot_mensajes IS
    'Mensajes individuales (usuario/asistente) de cada conversación, con fecha y hora exacta (timestamptz).';

-- Índices: filtros multicategoría (GIN: @> = AND, && = OR), listados y KPIs
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_categorias      ON public.chatbot_conversaciones USING GIN (categorias);
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_ultima          ON public.chatbot_conversaciones (ultima_interaccion_en DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_iniciada        ON public.chatbot_conversaciones (iniciada_en DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_fuera_horario   ON public.chatbot_conversaciones (fuera_horario_laboral, iniciada_en DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_msg_conv_fecha       ON public.chatbot_mensajes (conversacion_id, creado_en ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_chatbot_msg_creado_fuera     ON public.chatbot_mensajes (creado_en DESC, fuera_horario_laboral);

-- Trigger updated_at (reutiliza trigger_set_updated_at de la migración 001 si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_updated_at') THEN
        DROP TRIGGER IF EXISTS set_updated_at_chatbot_conversaciones ON public.chatbot_conversaciones;
        CREATE TRIGGER set_updated_at_chatbot_conversaciones
            BEFORE UPDATE ON public.chatbot_conversaciones
            FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_configuracion_horario_negocio ON public.configuracion_horario_negocio;
        CREATE TRIGGER set_updated_at_configuracion_horario_negocio
            BEFORE UPDATE ON public.configuracion_horario_negocio
            FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
    END IF;
END $$;

-- ------------------------------------------------------------
-- 4. RLS: sin políticas públicas (solo service_role desde backend Express / n8n)
-- ------------------------------------------------------------
ALTER TABLE public.configuracion_horario_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_conversaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_mensajes              ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5. RPC atómica: registrar_interaccion_chatbot
--    Upsert de la conversación (unión de categorías sin duplicados, +2 mensajes) e
--    inserción de los mensajes 'usuario' y 'asistente' en una sola transacción.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_interaccion_chatbot(
    p_session_id      text,
    p_mensaje_usuario text,
    p_respuesta_bot   text,
    p_categorias      text[]      DEFAULT '{}'::text[],
    p_canal           text        DEFAULT 'web',
    p_origen          text        DEFAULT 'n8n',
    p_timestamp       timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_session   text := left(btrim(COALESCE(p_session_id, '')), 100);
    v_mensaje   text := left(btrim(COALESCE(p_mensaje_usuario, '')), 2000);
    v_respuesta text := left(btrim(COALESCE(p_respuesta_bot, '')), 4000);
    v_canal     text := CASE WHEN p_canal IN ('web', 'whatsapp') THEN p_canal ELSE 'web' END;
    v_origen    text := CASE WHEN p_origen IN ('n8n', 'gemini_direct', 'sistema') THEN p_origen ELSE 'n8n' END;
    v_ts        timestamptz := COALESCE(p_timestamp, now());
    v_cats      text[] := public.normalizar_categorias_chatbot(p_categorias);
    v_fuera     boolean := public.es_fuera_horario_laboral(COALESCE(p_timestamp, now()));
    v_conv_id   uuid;
    v_cats_conv text[];
    v_fuera_conv boolean;
BEGIN
    IF v_session = '' OR v_mensaje = '' OR v_respuesta = '' THEN
        RAISE EXCEPTION 'session_id, mensaje y respuesta son obligatorios'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.chatbot_conversaciones AS c
        (session_id, canal, categorias, total_mensajes, fuera_horario_laboral,
         iniciada_en, ultima_interaccion_en, resumen)
    VALUES
        (v_session, v_canal, v_cats, 2, v_fuera, v_ts, v_ts, left(v_mensaje, 160))
    ON CONFLICT (session_id) DO UPDATE SET
        categorias            = public.normalizar_categorias_chatbot(c.categorias || EXCLUDED.categorias),
        total_mensajes        = c.total_mensajes + 2,
        ultima_interaccion_en = GREATEST(c.ultima_interaccion_en, EXCLUDED.ultima_interaccion_en)
    RETURNING c.id, c.categorias, c.fuera_horario_laboral
    INTO v_conv_id, v_cats_conv, v_fuera_conv;

    INSERT INTO public.chatbot_mensajes
        (conversacion_id, rol, contenido, categorias_detectadas, fuera_horario_laboral, origen, creado_en)
    VALUES
        (v_conv_id, 'usuario',   v_mensaje,   v_cats,            v_fuera, v_origen, v_ts),
        (v_conv_id, 'asistente', v_respuesta, '{}'::text[],      v_fuera, v_origen, v_ts + interval '1 millisecond');

    RETURN jsonb_build_object(
        'conversacion_id',       v_conv_id,
        'categorias',            to_jsonb(v_cats_conv),
        'fuera_horario_laboral', v_fuera,
        'conversacion_fuera_horario_laboral', v_fuera_conv
    );
END;
$$;

COMMENT ON FUNCTION public.registrar_interaccion_chatbot(text, text, text, text[], text, text, timestamptz) IS
    'Registra una interacción (mensaje cliente + respuesta del bot) y acumula categorías en la conversación.';

-- Solo service_role puede ejecutar la RPC (n8n / backend); nunca anon/authenticated.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE ALL ON FUNCTION public.registrar_interaccion_chatbot(text, text, text, text[], text, text, timestamptz)
            FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.registrar_interaccion_chatbot(text, text, text, text[], text, text, timestamptz)
            TO service_role;
    END IF;
END $$;

-- Refrescar el schema cache de PostgREST para que la RPC esté disponible de inmediato
NOTIFY pgrst, 'reload schema';
