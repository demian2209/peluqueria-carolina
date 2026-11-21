-- ==========================================
-- MIGRACIÓN 001 - ESQUEMA INICIAL
-- Peluquería Carolina
-- ==========================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLA: servicios
-- Catálogo de servicios ofrecidos por el salón
-- ==========================================
CREATE TABLE IF NOT EXISTS servicios (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre       VARCHAR(100) NOT NULL,
    descripcion  TEXT,
    duracion_min INT NOT NULL CHECK (duracion_min > 0),
    precio       NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    categoria    VARCHAR(50) NOT NULL,
    activo       BOOLEAN NOT NULL DEFAULT TRUE,
    en_seleccion BOOLEAN NOT NULL DEFAULT TRUE,
    orden        INT NOT NULL DEFAULT 0,
    imagen_url   TEXT,
    etiqueta     VARCHAR(120),
    icono        VARCHAR(60) DEFAULT 'auto_awesome',
    destacado    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE servicios IS 'Catálogo de servicios ofrecidos por Peluquería Carolina';

-- ==========================================
-- TABLA: estilistas
-- Perfiles de los profesionales del salón
-- ==========================================
CREATE TABLE IF NOT EXISTS estilistas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    especialidad    VARCHAR(100),
    bio             TEXT,
    foto_url        TEXT,
    nivel           VARCHAR(20) NOT NULL DEFAULT 'artisan' CHECK (nivel IN ('artisan', 'master', 'senior')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE estilistas IS 'Perfiles de los profesionales del salón';

-- ==========================================
-- TABLA: estilista_servicios (relación N:M)
-- Qué servicios puede realizar cada estilista
-- ==========================================
CREATE TABLE IF NOT EXISTS estilista_servicios (
    estilista_id    UUID NOT NULL REFERENCES estilistas(id) ON DELETE CASCADE,
    servicio_id     UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
    PRIMARY KEY (estilista_id, servicio_id)
);

COMMENT ON TABLE estilista_servicios IS 'Servicios habilitados por estilista';

-- ==========================================
-- TABLA: disponibilidad
-- Bloques horarios semanales de cada estilista
-- ==========================================
CREATE TABLE IF NOT EXISTS disponibilidad (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estilista_id    UUID NOT NULL REFERENCES estilistas(id) ON DELETE CASCADE,
    dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 1=Lun, ..., 6=Sab
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    CHECK (hora_fin > hora_inicio),
    UNIQUE (estilista_id, dia_semana, hora_inicio)
);

COMMENT ON TABLE disponibilidad IS 'Horarios habituales de trabajo por estilista y día de la semana';

-- ==========================================
-- TABLA: clientes
-- Información de clientes registrados
-- ==========================================
CREATE TABLE IF NOT EXISTS clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id    UUID UNIQUE,    -- referencia a auth.users de Supabase (se conecta en Fase 8)
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    telefono        VARCHAR(30),
    notas_ia        TEXT,           -- preferencias capturadas por el asistente IA
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE clientes IS 'Datos de clientes del salón';

-- ==========================================
-- TABLA: reservas
-- Registro de todas las citas agendadas
-- ==========================================
CREATE TABLE IF NOT EXISTS reservas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_reserva  VARCHAR(32) UNIQUE,
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    estilista_id    UUID NOT NULL REFERENCES estilistas(id) ON DELETE RESTRICT,
    servicio_id     UUID NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
    fecha           DATE NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio')),
    precio_final    NUMERIC(10, 2),
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (hora_fin > hora_inicio)
);

COMMENT ON TABLE reservas IS 'Citas agendadas en el salón';

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_reservas_estilista_fecha ON reservas (estilista_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente        ON reservas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado         ON reservas (estado);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_estilista ON disponibilidad (estilista_id, dia_semana);

-- ==========================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ==========================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER set_updated_at_servicios
    BEFORE UPDATE ON servicios
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

CREATE TRIGGER set_updated_at_estilistas
    BEFORE UPDATE ON estilistas
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

CREATE TRIGGER set_updated_at_clientes
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

CREATE TRIGGER set_updated_at_reservas
    BEFORE UPDATE ON reservas
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
