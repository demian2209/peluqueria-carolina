-- ============================================================
-- SEED 003 - CONVERSACIONES FICTICIAS DEL CHATBOT (Octubre 2026)
-- Peluquería Carolina — PostgreSQL / Supabase
-- ============================================================
-- Prerrequisito: migración 008_chatbot_historial_y_horarios.sql
--
-- Pobla el historial con 18 conversaciones / 19 interacciones, con múltiples categorías,
-- repartidas dentro y fuera del horario laboral (Lun–Sáb 09:00–19:00, Dom 10:00–18:00).
-- Usa la RPC real (registrar_interaccion_chatbot) para validar el pipeline de punta a punta.
--
-- Resultado esperado (ver consulta de verificación al final):
--   conversaciones = 18 | fuera de horario = 8 (44.4%)
--   interacciones  = 19 | fuera de horario = 9 (47.4%)
--
-- Idempotente: elimina y recrea únicamente las sesiones 'seed-chat-%'.
-- ============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    DELETE FROM public.chatbot_conversaciones WHERE session_id LIKE 'seed-chat-%';

    FOR r IN
        SELECT *
        FROM (VALUES
            ('seed-chat-01', '2026-10-01 10:15:00-03'::timestamptz, 'web', ARRAY['servicios','precios'],
             '¿Cuánto cuesta el balayage y cuánto demora?',
             'El Balayage & Iluminación Morena cuesta $85.000 y dura aproximadamente 180 minutos (3 horas). Lo realiza Carolina Valenzuela.'),
            ('seed-chat-02', '2026-10-01 22:40:00-03'::timestamptz, 'web', ARRAY['reservar_hora'],
             'Quiero agendar una hora para corte de mujer, ¿cómo lo hago?',
             'Puedes reservar directamente en la sección Reservas de nuestra web eligiendo servicio, profesional, fecha y horario. Recibirás la confirmación por WhatsApp y correo.'),
            ('seed-chat-03', '2026-10-02 08:20:00-03'::timestamptz, 'web', ARRAY['horarios'],
             '¿A qué hora abren hoy?',
             'Nuestros profesionales atienden de lunes a sábado desde las 09:00 hrs. Los domingos atiende Valentina Morales desde las 10:00 hrs.'),
            ('seed-chat-04', '2026-10-03 12:05:00-03'::timestamptz, 'web', ARRAY['estilistas','servicios'],
             '¿Quién hace manicura rusa?',
             'La Manicura Rusa & Esmaltado Permanente la realiza Valentina Morales, nuestra manicurista especialista en técnica con torno.'),
            ('seed-chat-05', '2026-10-04 19:30:00-03'::timestamptz, 'web', ARRAY['horarios','ubicacion_contacto'],
             '¿Atienden los domingos y dónde queda el salón?',
             'Los domingos atiende Valentina Morales de 10:00 a 18:00 hrs. Nos encuentras en Av. Bernardo O''Higgins 642, San Fernando.'),
            ('seed-chat-06', '2026-10-05 15:10:00-03'::timestamptz, 'web', ARRAY['precios'],
             '¿Cuánto vale el corte de caballero?',
             'El Corte Caballero & Fade cuesta $14.990, dura 40 minutos y lo realiza Matías Muñoz.'),
            ('seed-chat-07', '2026-10-06 21:15:00-03'::timestamptz, 'web', ARRAY['cancelar_reprogramar'],
             'Necesito cancelar mi cita de mañana',
             'Puedes cancelar o reprogramar hasta 12 horas antes desde el mensaje de confirmación en WhatsApp o desde la web usando tu código de reserva.'),
            ('seed-chat-08', '2026-10-07 09:45:00-03'::timestamptz, 'web', ARRAY['faqs','servicios'],
             '¿Debo lavar mi cabello antes de una coloración?',
             'Para coloración o balayage recomendamos no lavar el cabello el mismo día de la cita; los aceites naturales protegen el cuero cabelludo.'),
            ('seed-chat-09', '2026-10-08 23:05:00-03'::timestamptz, 'web', ARRAY['servicios','precios'],
             '¿Qué tratamientos tienen para el frizz y cuánto cuestan?',
             'Tenemos el Botox Capilar Antifrizz ($45.000, 90 min) y el Alisado Orgánico Vegano ($65.000, 150 min), ambos con Camila Soto.'),
            ('seed-chat-09', '2026-10-08 23:07:00-03'::timestamptz, 'web', ARRAY['reservar_hora'],
             'Quiero reservar el botox para el sábado',
             'Puedes reservarlo en la sección Reservas de la web; Camila Soto atiende de martes a sábado. Ahí verás los horarios disponibles.'),
            ('seed-chat-10', '2026-10-09 13:30:00-03'::timestamptz, 'web', ARRAY['horarios','reservar_hora'],
             '¿Tienen horas disponibles el sábado en la mañana?',
             'No puedo confirmar disponibilidad de horas; revísala en la sección Reservas. Los sábados atendemos desde las 09:00 hrs.'),
            ('seed-chat-11', '2026-10-10 19:20:00-03'::timestamptz, 'web', ARRAY['faqs'],
             '¿Aceptan pago con tarjeta y en cuotas?',
             'Aceptamos tarjetas de crédito y débito (cuotas según tu banco), transferencias y efectivo. El pago se realiza en el salón al finalizar el servicio.'),
            ('seed-chat-12', '2026-10-11 11:00:00-03'::timestamptz, 'web', ARRAY['servicios'],
             '¿Qué servicios de uñas ofrecen?',
             'Ofrecemos Manicura Rusa & Esmaltado Permanente ($18.990, 60 minutos) con Valentina Morales.'),
            ('seed-chat-13', '2026-10-12 07:50:00-03'::timestamptz, 'web', ARRAY['precios','horarios'],
             '¿Cuánto sale el alisado y hasta qué hora atienden?',
             'El Alisado Orgánico Vegano cuesta $65.000 y dura 150 minutos. Camila Soto lo realiza de martes a sábado, de 10:00 a 19:00 hrs.'),
            ('seed-chat-14', '2026-10-13 17:25:00-03'::timestamptz, 'web', ARRAY['estilistas'],
             '¿Quién es la directora del salón?',
             'Carolina Valenzuela es nuestra Directora Técnica y Colorista Especialista.'),
            ('seed-chat-15', '2026-10-14 00:30:00-03'::timestamptz, 'web', ARRAY['otros'],
             'Hola, ¿venden productos para el cabello?',
             'No dispongo de información sobre venta de productos. Te sugiero contactar directamente al salón por WhatsApp.'),
            ('seed-chat-16', '2026-10-15 10:40:00-03'::timestamptz, 'web', ARRAY['servicios'],
             '¿Qué incluye el masaje reparador K18?',
             'El Masaje Reparador Profundo (K18 / Olaplex) reconecta los enlaces de queratina de cabellos procesados químicamente, con lavado spa y sellado. Dura 45 minutos.'),
            ('seed-chat-17', '2026-10-16 16:00:00-03'::timestamptz, 'web', ARRAY['reservar_hora','precios'],
             'Quiero reservar corte mujer con brushing, ¿cuánto vale?',
             'El Corte Mujer + Lavado y Brushing cuesta $24.990 y dura 50 minutos con Gonzalo Riquelme. Reserva en la sección Reservas de la web.'),
            ('seed-chat-18', '2026-10-17 11:30:00-03'::timestamptz, 'web', ARRAY['horarios'],
             '¿Hasta qué hora atienden los sábados?',
             'Los sábados atendemos hasta las 19:00 hrs según el profesional: Camila hasta las 19:00, Carolina y Valentina hasta las 18:00 y Matías hasta las 17:00.')
        ) AS t(session_id, ts, canal, cats, mensaje, respuesta)
        ORDER BY t.ts
    LOOP
        PERFORM public.registrar_interaccion_chatbot(
            r.session_id, r.mensaje, r.respuesta, r.cats, r.canal, 'n8n', r.ts
        );
    END LOOP;
END $$;

-- ============================================================
-- VERIFICACIÓN (esperado: 18 | 8 | 19 | 9)
-- ============================================================
SELECT
    (SELECT COUNT(*) FROM public.chatbot_conversaciones WHERE session_id LIKE 'seed-chat-%')                                  AS conversaciones,
    (SELECT COUNT(*) FROM public.chatbot_conversaciones WHERE session_id LIKE 'seed-chat-%' AND fuera_horario_laboral)        AS conv_fuera_horario,
    (SELECT COUNT(*) FROM public.chatbot_mensajes m JOIN public.chatbot_conversaciones c ON c.id = m.conversacion_id
       WHERE c.session_id LIKE 'seed-chat-%' AND m.rol = 'usuario')                                                           AS interacciones,
    (SELECT COUNT(*) FROM public.chatbot_mensajes m JOIN public.chatbot_conversaciones c ON c.id = m.conversacion_id
       WHERE c.session_id LIKE 'seed-chat-%' AND m.rol = 'usuario' AND m.fuera_horario_laboral)                               AS interacciones_fuera_horario;
