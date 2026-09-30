-- ==========================================
-- MIGRACIÓN 002 - ROW LEVEL SECURITY (RLS)
-- Peluquería Carolina
-- ==========================================

-- ==========================================
-- RLS: servicios (lectura pública, escritura solo admin)
-- ==========================================
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede leer servicios activos"
    ON servicios FOR SELECT
    USING (activo = TRUE);

-- ==========================================
-- RLS: estilistas (lectura pública, escritura solo admin)
-- ==========================================
ALTER TABLE estilistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede leer estilistas activos"
    ON estilistas FOR SELECT
    USING (activo = TRUE);

-- ==========================================
-- RLS: disponibilidad (lectura pública)
-- ==========================================
ALTER TABLE disponibilidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede leer disponibilidad"
    ON disponibilidad FOR SELECT
    USING (TRUE);

-- ==========================================
-- RLS: estilista_servicios (lectura pública)
-- ==========================================
ALTER TABLE estilista_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede leer estilista_servicios"
    ON estilista_servicios FOR SELECT
    USING (TRUE);

-- ==========================================
-- RLS: clientes (cada usuario solo ve sus propios datos)
-- Se conectará en Fase 8 con Supabase Auth
-- ==========================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes ven solo sus datos"
    ON clientes FOR SELECT
    USING (auth_user_id = auth.uid());

CREATE POLICY "Clientes insertan solo sus datos"
    ON clientes FOR INSERT
    WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Clientes actualizan solo sus datos"
    ON clientes FOR UPDATE
    USING (auth_user_id = auth.uid());

-- ==========================================
-- RLS: reservas (cliente ve solo las suyas)
-- ==========================================
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes ven sus reservas"
    ON reservas FOR SELECT
    USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Clientes crean sus reservas"
    ON reservas FOR INSERT
    WITH CHECK (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Clientes cancelan sus reservas"
    ON reservas FOR UPDATE
    USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE auth_user_id = auth.uid()
        )
        AND estado IN ('pendiente', 'confirmada')
    );
