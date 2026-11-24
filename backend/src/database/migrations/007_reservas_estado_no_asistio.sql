-- ============================================================
-- Migración 007: Estado 'no_asistio' y unificación 'atendida'/'completada'
-- Peluquería Carolina — PostgreSQL / Supabase
-- Totalmente idempotente: soporta tanto VARCHAR+CHECK como ENUM nativo.
-- ============================================================

-- 1. Si `reservas.estado` es un tipo ENUM de PostgreSQL, asegurar todos los valores
DO $$
DECLARE
    v_data_type TEXT;
    v_udt_name  TEXT;
BEGIN
    SELECT data_type, udt_name
    INTO v_data_type, v_udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservas'
      AND column_name = 'estado';

    IF v_data_type = 'USER-DEFINED' AND v_udt_name IS NOT NULL THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_udt_name, 'pendiente');
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_udt_name, 'confirmada');
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_udt_name, 'atendida');
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_udt_name, 'completada');
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_udt_name, 'cancelada');
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_udt_name, 'no_asistio');
    END IF;
END $$;

-- 2. Si `reservas.estado` es texto/varchar, unificar CHECK constraint para aceptar todos los estados
DO $$
DECLARE
    v_data_type TEXT;
    v_con       RECORD;
BEGIN
    SELECT data_type
    INTO v_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservas'
      AND column_name = 'estado';

    IF v_data_type IN ('character varying', 'text', 'character') THEN
        -- Eliminar constraints CHECK previos asociados a la columna estado
        FOR v_con IN
            SELECT c.conname
            FROM pg_constraint c
            WHERE c.conrelid = 'public.reservas'::regclass
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) ILIKE '%estado%'
        LOOP
            EXECUTE format('ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS %I', v_con.conname);
        END LOOP;

        ALTER TABLE public.reservas
            ADD CONSTRAINT reservas_estado_check
            CHECK (estado IN ('pendiente', 'confirmada', 'atendida', 'completada', 'cancelada', 'no_asistio'));
    END IF;
END $$;

-- 3. Índice compuesto para optimizar consultas de filtros por fecha/estado y KPIs de inasistencias
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reservas'
          AND column_name = 'fecha_hora_inicio'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_reservas_fecha_inicio_estado
            ON public.reservas (fecha_hora_inicio, estado);
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reservas'
          AND column_name = 'fecha'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_reservas_fecha_estado
            ON public.reservas (fecha, estado);
    END IF;
END $$;

COMMENT ON COLUMN public.reservas.estado IS
    'Estados válidos: pendiente, confirmada, atendida, completada, cancelada, no_asistio.';
