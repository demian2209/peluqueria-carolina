-- ==========================================
-- MIGRACIÓN 003 - CÓDIGO DE RESERVA ÚNICO
-- Peluquería Carolina
-- ==========================================

-- 1. Añadir columna codigo_reserva a la tabla reservas
ALTER TABLE IF EXISTS reservas
ADD COLUMN IF NOT EXISTS codigo_reserva VARCHAR(32) UNIQUE;

-- 2. Índice único para búsquedas rápidas por código de reserva (Cliente y Admin)
CREATE INDEX IF NOT EXISTS idx_reservas_codigo_reserva ON reservas (codigo_reserva);

COMMENT ON COLUMN reservas.codigo_reserva IS 'Código único legible de la reserva (ej. PC-18-7F3A). Se regenera al reprogramar la cita.';

