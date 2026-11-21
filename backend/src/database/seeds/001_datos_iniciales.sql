-- ==========================================
-- SEEDS - DATOS OFICIALES
-- Peluquería Carolina
-- ==========================================

-- ==========================================
-- SERVICIOS (10 Servicios Oficiales - Nuestra Selección)
-- ==========================================
INSERT INTO servicios (nombre, descripcion, duracion_min, precio, categoria, activo, en_seleccion, orden, imagen_url, etiqueta, icono, destacado) VALUES
(
    'Balayage & Iluminación Morena',
    'Decoloración técnica a mano alzada con protector de enlaces, tonalización de matiz, sellador de cutícula y secado final.',
    180, 85000.00, 'coloracion', true, true, 1, '/images/servicios/servicio_1.webp', 'Alta Coloración & Iluminación', 'auto_awesome', true
),
(
    'Corte Mujer + Lavado y Brushing',
    'Diagnóstico visual según morfología de rostro, lavado con masaje capilar, corte técnico de autor y secado con movimiento.',
    50, 24990.00, 'corte', true, true, 2, '/images/servicios/servicio_2.webp', 'Arquitectura Capilar', 'content_cut', false
),
(
    'Corte Caballero & Fade',
    'Corte degradado a tijera o máquina (skin fade/taper), lavado refrescante y peinado con fijación mate.',
    40, 14990.00, 'barberia', true, true, 3, '/images/servicios/servicio_3.webp', 'Barbería Clásica & Fade', 'face_6', false
),
(
    'Ritual de Barba Tradicional',
    'Perfilado con navaja desechable, aplicación de toallas calientes aromatizadas al vapor, bálsamo y aceite nutritivo.',
    35, 12000.00, 'barberia', true, true, 4, '/images/servicios/servicio_4.webp', 'Ritual Tradicional & Vapor', 'spa', false
),
(
    'Coloración Completa o Retoque de Raíz',
    'Aplicación de tintura profesional baja en amoníaco, cobertura total de canas, lavado emoliente y baño de brillo final.',
    90, 38000.00, 'coloracion', true, true, 5, '/images/servicios/servicio_5.webp', 'Coloración Couture', 'palette', false
),
(
    'Botox Capilar Antifrizz',
    'Relleno molecular termoactivo para sellar cutículas abiertas, eliminar el encrespamiento y aportar brillo espejo sin modificar la onda.',
    90, 45000.00, 'tratamiento', true, true, 6, '/images/servicios/servicio_6.webp', 'Relleno Molecular Antifrizz', 'water_drop', false
),
(
    'Alisado Orgánico Vegano',
    'Alisado progresivo con base de aminoácidos naturales 100% libre de formol, sellado térmico con plancha de titanio y neutralizado.',
    150, 65000.00, 'tratamiento', true, true, 7, '/images/servicios/servicio_7.webp', 'Liso Progresivo Vegano', 'eco', false
),
(
    'Masaje Reparador Profundo (K18 / Olaplex)',
    'Tratamiento intensivo de reconexión de enlaces de queratina para cabellos procesados químicamente, con lavado spa y sellado.',
    45, 32000.00, 'tratamiento', true, true, 8, '/images/servicios/servicio_8.webp', 'Tecnología Biomimética (K18)', 'health_and_safety', false
),
(
    'Peinado Social & Ondas al Agua',
    'Preparación capilar con fijación térmica, elaboración de ondas al agua, semirrecogido o peinado de fiesta para eventos.',
    60, 28000.00, 'styling', true, true, 9, '/images/servicios/servicio_9.webp', 'Estilismo Editorial & Ondas', 'auto_awesome', false
),
(
    'Manicura Rusa & Esmaltado Permanente',
    'Limpieza profunda de cutículas con torno, limado anatómico, nivelación de uña natural y esmaltado en gel de larga duración.',
    60, 18990.00, 'manicura', true, true, 10, '/images/servicios/servicio_10.webp', 'Cuidado & Nivelación Rusa', 'brush', false
);

-- ==========================================
-- ESTILISTAS (5 Estilistas Oficiales)
-- ==========================================
INSERT INTO estilistas (nombre, apellido, especialidad, bio, nivel, activo) VALUES
(
    'Carolina', 'Valenzuela',
    'Directora Técnica & Colorista Especialista',
    'Directora Técnica y Colorista Especialista con amplia trayectoria en balayage y técnicas avanzadas de coloración.',
    'master', true
),
(
    'Matías', 'Muñoz',
    'Barbero Principal',
    'Barbero Principal experto en skin fade, perfilado clásico a navaja y rituales tradicionales de barbería.',
    'artisan', true
),
(
    'Camila', 'Soto',
    'Especialista en Tratamientos Capilares & Alisados',
    'Especialista en salud capilar, alisado progresivo vegano 100% orgánico y protocolos moleculares K18/Olaplex.',
    'senior', true
),
(
    'Gonzalo', 'Riquelme',
    'Estilista Senior & Peinador',
    'Estilista Senior y Peinador, maestro en corte femenino de autor, brushing estructurado y peinados para eventos.',
    'master', true
),
(
    'Valentina', 'Morales',
    'Manicurista & Cuidado Integral',
    'Manicurista profesional especializada en manicura rusa anatómica con torno y esmaltado permanente.',
    'senior', true
);

-- ==========================================
-- ESTILISTA_SERVICIO (relaciones)
-- ==========================================
-- Carolina Valenzuela: Balayage & Iluminación Morena, Coloración Completa o Retoque de Raíz
INSERT INTO estilista_servicio (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Carolina' AND e.apellido = 'Valenzuela'
  AND s.nombre IN ('Balayage & Iluminación Morena', 'Coloración Completa o Retoque de Raíz');

-- Matías Muñoz: Corte Caballero & Fade, Ritual de Barba Tradicional
INSERT INTO estilista_servicio (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Matías' AND e.apellido = 'Muñoz'
  AND s.nombre IN ('Corte Caballero & Fade', 'Ritual de Barba Tradicional');

-- Camila Soto: Botox Capilar Antifrizz, Alisado Orgánico Vegano, Masaje Reparador Profundo (K18 / Olaplex)
INSERT INTO estilista_servicio (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Camila' AND e.apellido = 'Soto'
  AND s.nombre IN ('Botox Capilar Antifrizz', 'Alisado Orgánico Vegano', 'Masaje Reparador Profundo (K18 / Olaplex)');

-- Gonzalo Riquelme: Corte Mujer + Lavado y Brushing, Peinado Social & Ondas al Agua
INSERT INTO estilista_servicio (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Gonzalo' AND e.apellido = 'Riquelme'
  AND s.nombre IN ('Corte Mujer + Lavado y Brushing', 'Peinado Social & Ondas al Agua');

-- Valentina Morales: Manicura Rusa & Esmaltado Permanente
INSERT INTO estilista_servicio (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Valentina' AND e.apellido = 'Morales'
  AND s.nombre IN ('Manicura Rusa & Esmaltado Permanente');
