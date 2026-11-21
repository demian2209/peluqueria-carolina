-- ============================================================
-- Migración 006: Bloqueos de Horas y Horarios
-- Peluquería Carolina — PostgreSQL / Supabase
-- Permite bloquear días completos o rangos horarios específicos
-- (por fecha puntual o recurrentes por día de la semana)
-- a nivel de todo el salón o por estilista.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS bloqueos_horarios (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estilista_id  VARCHAR(64) NOT NULL DEFAULT 'todos',
    tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('fecha', 'recurrente')),
    fecha         DATE,
    dia_semana    SMALLINT CHECK (dia_semana IS NULL OR (dia_semana BETWEEN 0 AND 6)),
    dia_completo  BOOLEAN NOT NULL DEFAULT FALSE,
    hora_inicio   VARCHAR(5),
    hora_fin      VARCHAR(5),
    motivo        VARCHAR(180),
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (tipo = 'fecha' AND fecha IS NOT NULL AND dia_semana IS NULL)
        OR (tipo = 'recurrente' AND dia_semana IS NOT NULL AND fecha IS NULL)
    ),
    CHECK (
        dia_completo = TRUE
        OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)
    )
);

COMMENT ON TABLE bloqueos_horarios IS 'Bloqueos administrativos de horas y horarios por fecha o día recurrente';

CREATE INDEX IF NOT EXISTS idx_bloqueos_estilista_activo ON bloqueos_horarios (estilista_id, activo);
CREATE INDEX IF NOT EXISTS idx_bloqueos_tipo_fecha       ON bloqueos_horarios (tipo, fecha) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_bloqueos_tipo_dia         ON bloqueos_horarios (tipo, dia_semana) WHERE activo = TRUE;

-- Trigger updated_at (reutiliza trigger_set_updated_at de migración 001 si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_updated_at') THEN
        DROP TRIGGER IF EXISTS set_updated_at_bloqueos_horarios ON bloqueos_horarios;
        CREATE TRIGGER set_updated_at_bloqueos_horarios
            BEFORE UPDATE ON bloqueos_horarios
            FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
    END IF;
END $$;

-- Habilitar RLS con lectura pública únicamente para bloqueos activos
ALTER TABLE bloqueos_horarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de bloqueos activos" ON bloqueos_horarios;
CREATE POLICY "Lectura pública de bloqueos activos"
    ON bloqueos_horarios FOR SELECT
    USING (activo = TRUE);
