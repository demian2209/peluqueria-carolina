-- ==========================================
-- SEEDS - DATOS DE PRUEBA
-- Peluquería Carolina
-- ==========================================

-- ==========================================
-- SERVICIOS
-- ==========================================
INSERT INTO servicios (nombre, descripcion, duracion_min, precio, categoria) VALUES
(
    'Coloración Couture',
    'Pigmentación inteligente adaptada a su tono de piel mediante análisis IA. Técnica multi-tono con productos de alta gama.',
    120, 120.00, 'coloracion'
),
(
    'Corte de Autor',
    'Arquitectura capilar basada en la morfología de su rostro. Diseño exclusivo para cada cliente.',
    45, 45.00, 'corte'
),
(
    'Hidratación IA',
    'Tratamiento de hidratación profunda con protocolo personalizado por análisis de IA. Productos de origen natural.',
    60, 85.00, 'tratamiento'
),
(
    'Barbería Elite',
    'Rituales de afeitado tradicional con tecnología de vaporización. Acabado impecable y duradero.',
    30, 35.00, 'barberia'
),
(
    'Peinado & Styling',
    'Looks editoriales para eventos de alto impacto. Creaciones únicas adaptadas al evento y personalidad.',
    60, 60.00, 'styling'
);

-- ==========================================
-- ESTILISTAS
-- ==========================================
INSERT INTO estilistas (nombre, apellido, especialidad, bio, nivel) VALUES
(
    'Marc', 'Laurent',
    'Especialista en Color',
    'Maestro colorista con más de 12 años de experiencia en salones de París y Milán. Especializado en técnicas de balayage y coloración multi-dimensional.',
    'master'
),
(
    'Elena', 'Russo',
    'Cortes Arquitectónicos',
    'Estilista de vanguardia formada en Toni & Guy London. Sus cortes geométricos y estructurales son su marca distintiva.',
    'master'
),
(
    'Julian', 'Vance',
    'Master Barber',
    'Barbero tradicional con técnica moderna. Experto en afeitado clásico, degradados precisos y diseño de barba.',
    'artisan'
),
(
    'Sofia', 'Chen',
    'Tratamientos IA',
    'Especialista en tricología avanzada y tratamientos personalizados. Pionera en la integración de análisis de IA para diagnóstico capilar.',
    'senior'
);

-- ==========================================
-- ESTILISTA_SERVICIOS (relaciones)
-- ==========================================
-- Marc Laurent: Coloración, Corte, Styling
INSERT INTO estilista_servicios (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Marc' AND e.apellido = 'Laurent'
  AND s.nombre IN ('Coloración Couture', 'Corte de Autor', 'Peinado & Styling');

-- Elena Russo: Corte, Styling, Hidratación
INSERT INTO estilista_servicios (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Elena' AND e.apellido = 'Russo'
  AND s.nombre IN ('Corte de Autor', 'Peinado & Styling', 'Hidratación IA');

-- Julian Vance: Barbería, Corte
INSERT INTO estilista_servicios (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Julian' AND e.apellido = 'Vance'
  AND s.nombre IN ('Barbería Elite', 'Corte de Autor');

-- Sofia Chen: Hidratación, Coloración
INSERT INTO estilista_servicios (estilista_id, servicio_id)
SELECT e.id, s.id
FROM estilistas e, servicios s
WHERE e.nombre = 'Sofia' AND e.apellido = 'Chen'
  AND s.nombre IN ('Hidratación IA', 'Coloración Couture');

-- ==========================================
-- DISPONIBILIDAD (Horario laboral semanal)
-- dia_semana: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
-- ==========================================
-- Marc Laurent: Lun-Vie 09:00-18:00, Sab 09:00-14:00
INSERT INTO disponibilidad (estilista_id, dia_semana, hora_inicio, hora_fin)
SELECT e.id, dias.dia, '09:00', '18:00'
FROM estilistas e,
     (VALUES (1),(2),(3),(4),(5)) AS dias(dia)
WHERE e.nombre = 'Marc' AND e.apellido = 'Laurent';

INSERT INTO disponibilidad (estilista_id, dia_semana, hora_inicio, hora_fin)
SELECT e.id, 6, '09:00', '14:00'
FROM estilistas e
WHERE e.nombre = 'Marc' AND e.apellido = 'Laurent';

-- Elena Russo: Mar-Sab 10:00-19:00
INSERT INTO disponibilidad (estilista_id, dia_semana, hora_inicio, hora_fin)
SELECT e.id, dias.dia, '10:00', '19:00'
FROM estilistas e,
     (VALUES (2),(3),(4),(5),(6)) AS dias(dia)
WHERE e.nombre = 'Elena' AND e.apellido = 'Russo';

-- Julian Vance: Lun-Sab 09:00-17:00
INSERT INTO disponibilidad (estilista_id, dia_semana, hora_inicio, hora_fin)
SELECT e.id, dias.dia, '09:00', '17:00'
FROM estilistas e,
     (VALUES (1),(2),(3),(4),(5),(6)) AS dias(dia)
WHERE e.nombre = 'Julian' AND e.apellido = 'Vance';

-- Sofia Chen: Mié-Dom 10:00-18:00
INSERT INTO disponibilidad (estilista_id, dia_semana, hora_inicio, hora_fin)
SELECT e.id, dias.dia, '10:00', '18:00'
FROM estilistas e,
     (VALUES (3),(4),(5),(6),(0)) AS dias(dia)
WHERE e.nombre = 'Sofia' AND e.apellido = 'Chen';
