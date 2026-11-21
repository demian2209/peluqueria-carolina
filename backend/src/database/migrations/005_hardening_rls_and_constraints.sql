-- ============================================================
-- Migración 005: Hardening de Seguridad (RLS y Constraint Anti-Overbooking)
-- Peluquería Carolina — PostgreSQL / Supabase
-- Totalmente idempotente y seguro contra tablas inexistentes (IF EXISTS)
-- ============================================================

-- 1. Sincronizar tablas operativas si aún no existen
DO $$
BEGIN
    -- Sincronizar notificaciones
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notificaciones') THEN
        CREATE TABLE notificaciones (
            id           BIGSERIAL PRIMARY KEY,
            reserva_id   BIGINT,
            tipo         VARCHAR(40) NOT NULL,
            canal        VARCHAR(30) NOT NULL,
            estado_envio VARCHAR(30) NOT NULL DEFAULT 'pendiente',
            detalle      TEXT,
            enviado_en   TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Sincronizar encuestas_satisfaccion
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encuestas_satisfaccion') THEN
        CREATE TABLE encuestas_satisfaccion (
            id            BIGSERIAL PRIMARY KEY,
            reserva_id    BIGINT NOT NULL UNIQUE,
            puntaje       SMALLINT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
            comentario    TEXT,
            respondida_en TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- 2. Habilitar RLS de forma segura en las tablas que existan (IF EXISTS evita el error 42P01)
ALTER TABLE IF EXISTS clientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reservas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notificaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS encuestas_satisfaccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS estilistas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS servicios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS estilista_servicios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS estilista_servicio     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS disponibilidad         ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de lectura pública mínima para catálogos (si las tablas existen)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'servicios') THEN
        DROP POLICY IF EXISTS "Lectura pública de servicios activos" ON servicios;
        CREATE POLICY "Lectura pública de servicios activos"
            ON servicios FOR SELECT
            USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estilistas') THEN
        DROP POLICY IF EXISTS "Lectura pública de estilistas activos" ON estilistas;
        CREATE POLICY "Lectura pública de estilistas activos"
            ON estilistas FOR SELECT
            USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estilista_servicios') THEN
        DROP POLICY IF EXISTS "Lectura pública de estilista_servicios" ON estilista_servicios;
        CREATE POLICY "Lectura pública de estilista_servicios"
            ON estilista_servicios FOR SELECT
            USING (true);
    END IF;
END $$;

-- 4. Prevención atómica contra doble agendamiento (TOCTOU Race Condition - SEC-12)
-- Requiere extensión btree_gist para combinar igualdad en estilista_id (=) con intersección de rango temporal (&&)
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservas') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'no_overlapping_reservas_por_estilista'
        ) THEN
            ALTER TABLE reservas
                ADD CONSTRAINT no_overlapping_reservas_por_estilista
                EXCLUDE USING gist (
                    estilista_id WITH =,
                    tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)') WITH &&
                )
                WHERE (estado IN ('pendiente', 'confirmada'));
        END IF;
    END IF;
EXCEPTION
    WHEN duplicate_object OR exclusion_violation OR undefined_column THEN
        RAISE NOTICE 'Constraint no_overlapping_reservas_por_estilista omitido o ya existente.';
END $$;
