const MOCK_SERVICIOS = [
  {
    id: "s4-balayage",
    nombre: "Balayage & Iluminación Morena",
    descripcion: "Decoloración técnica a mano alzada con protector de enlaces, tonalización de matiz, sellador de cutícula y secado final.",
    duracion_min: 180,
    precio: 85000,
    categoria: "coloracion",
    activo: true,
    en_seleccion: true,
    orden: 1,
    imagen_url: "/images/servicios/servicio_1.webp",
    etiqueta: "Alta Coloración & Iluminación",
    icono: "auto_awesome",
    destacado: true
  },
  {
    id: "s1-corte-mujer",
    nombre: "Corte Mujer + Lavado y Brushing",
    descripcion: "Diagnóstico visual según morfología de rostro, lavado con masaje capilar, corte técnico de autor y secado con movimiento.",
    duracion_min: 50,
    precio: 24990,
    categoria: "corte",
    activo: true,
    en_seleccion: true,
    orden: 2,
    imagen_url: "/images/servicios/servicio_2.webp",
    etiqueta: "Arquitectura Capilar",
    icono: "content_cut",
    destacado: false
  },
  {
    id: "s2-corte-caballero",
    nombre: "Corte Caballero & Fade",
    descripcion: "Corte degradado a tijera o máquina (skin fade/taper), lavado refrescante y peinado con fijación mate.",
    duracion_min: 40,
    precio: 14990,
    categoria: "barberia",
    activo: true,
    en_seleccion: true,
    orden: 3,
    imagen_url: "/images/servicios/servicio_3.webp",
    etiqueta: "Barbería Clásica & Fade",
    icono: "face_6",
    destacado: false
  },
  {
    id: "s3-ritual-barba",
    nombre: "Ritual de Barba Tradicional",
    descripcion: "Perfilado con navaja desechable, aplicación de toallas calientes aromatizadas al vapor, bálsamo y aceite nutritivo.",
    duracion_min: 35,
    precio: 12000,
    categoria: "barberia",
    activo: true,
    en_seleccion: true,
    orden: 4,
    imagen_url: "/images/servicios/servicio_4.webp",
    etiqueta: "Ritual Tradicional & Vapor",
    icono: "spa",
    destacado: false
  },
  {
    id: "s5-coloracion-completa",
    nombre: "Coloración Completa o Retoque de Raíz",
    descripcion: "Aplicación de tintura profesional baja en amoníaco, cobertura total de canas, lavado emoliente y baño de brillo final.",
    duracion_min: 90,
    precio: 38000,
    categoria: "coloracion",
    activo: true,
    en_seleccion: true,
    orden: 5,
    imagen_url: "/images/servicios/servicio_5.webp",
    etiqueta: "Coloración Couture",
    icono: "palette",
    destacado: false
  },
  {
    id: "s6-botox-capilar",
    nombre: "Botox Capilar Antifrizz",
    descripcion: "Relleno molecular termoactivo para sellar cutículas abiertas, eliminar el encrespamiento y aportar brillo espejo sin modificar la onda.",
    duracion_min: 90,
    precio: 45000,
    categoria: "tratamiento",
    activo: true,
    en_seleccion: true,
    orden: 6,
    imagen_url: "/images/servicios/servicio_6.webp",
    etiqueta: "Relleno Molecular Antifrizz",
    icono: "water_drop",
    destacado: false
  },
  {
    id: "s7-alisado-organico",
    nombre: "Alisado Orgánico Vegano",
    descripcion: "Alisado progresivo con base de aminoácidos naturales 100% libre de formol, sellado térmico con plancha de titanio y neutralizado.",
    duracion_min: 150,
    precio: 65000,
    categoria: "tratamiento",
    activo: true,
    en_seleccion: true,
    orden: 7,
    imagen_url: "/images/servicios/servicio_7.webp",
    etiqueta: "Liso Progresivo Vegano",
    icono: "eco",
    destacado: false
  },
  {
    id: "s8-masaje-reparador",
    nombre: "Masaje Reparador Profundo (K18 / Olaplex)",
    descripcion: "Tratamiento intensivo de reconexión de enlaces de queratina para cabellos procesados químicamente, con lavado spa y sellado.",
    duracion_min: 45,
    precio: 32000,
    categoria: "tratamiento",
    activo: true,
    en_seleccion: true,
    orden: 8,
    imagen_url: "/images/servicios/servicio_8.webp",
    etiqueta: "Tecnología Biomimética (K18)",
    icono: "health_and_safety",
    destacado: false
  },
  {
    id: "s9-peinado-social",
    nombre: "Peinado Social & Ondas al Agua",
    descripcion: "Preparación capilar con fijación térmica, elaboración de ondas al agua, semirrecogido o peinado de fiesta para eventos.",
    duracion_min: 60,
    precio: 28000,
    categoria: "styling",
    activo: true,
    en_seleccion: true,
    orden: 9,
    imagen_url: "/images/servicios/servicio_9.webp",
    etiqueta: "Estilismo Editorial & Ondas",
    icono: "auto_awesome",
    destacado: false
  },
  {
    id: "s10-manicura-rusa",
    nombre: "Manicura Rusa & Esmaltado Permanente",
    descripcion: "Limpieza profunda de cutículas con torno, limado anatómico, nivelación de uña natural y esmaltado en gel de larga duración.",
    duracion_min: 60,
    precio: 18990,
    categoria: "manicura",
    activo: true,
    en_seleccion: true,
    orden: 10,
    imagen_url: "/images/servicios/servicio_10.webp",
    etiqueta: "Cuidado & Nivelación Rusa",
    icono: "brush",
    destacado: false
  }
];

const MOCK_ESTILISTAS = [
  {
    id: "e1-carolina-valenzuela",
    nombre: "Carolina",
    apellido: "Valenzuela",
    especialidad: "Directora Técnica & Colorista Especialista",
    bio: "Directora Técnica y Colorista Especialista con amplia trayectoria en balayage y técnicas avanzadas de color.",
    nivel: "master",
    activo: true,
    foto_url: "/images/maestros_tijera/carolina_valenzuela.webp",
    servicios_ids: ["s4-balayage", "s5-coloracion-completa"]
  },
  {
    id: "e2-matias-munoz",
    nombre: "Matías",
    apellido: "Muñoz",
    especialidad: "Barbero Principal",
    bio: "Barbero Principal experto en skin fade, perfilado clásico a navaja y cuidado integral masculino.",
    nivel: "artisan",
    activo: true,
    foto_url: "/images/maestros_tijera/matias_munoz.webp",
    servicios_ids: ["s2-corte-caballero", "s3-ritual-barba"]
  },
  {
    id: "e3-camila-soto",
    nombre: "Camila",
    apellido: "Soto",
    especialidad: "Especialista en Tratamientos Capilares & Alisados",
    bio: "Especialista en salud capilar, alisado progresivo vegano 100% orgánico y terapia molecular K18/Olaplex.",
    nivel: "senior",
    activo: true,
    foto_url: "/images/maestros_tijera/camila_soto.webp",
    servicios_ids: ["s6-botox-capilar", "s7-alisado-organico", "s8-masaje-reparador"]
  },
  {
    id: "e4-gonzalo-riquelme",
    nombre: "Gonzalo",
    apellido: "Riquelme",
    especialidad: "Estilista Senior & Peinador",
    bio: "Estilista Senior y Peinador de producciones y pasarelas, experto en visagismo y arquitectura de corte femenino.",
    nivel: "master",
    activo: true,
    foto_url: "/images/maestros_tijera/gonzalo_riquelme.webp",
    servicios_ids: ["s1-corte-mujer", "s9-peinado-social"]
  },
  {
    id: "e5-valentina-morales",
    nombre: "Valentina",
    apellido: "Morales",
    especialidad: "Manicurista & Cuidado Integral",
    bio: "Manicurista profesional especializada en técnica rusa con torno anatómico y nivelación de uña natural.",
    nivel: "senior",
    activo: true,
    foto_url: "/images/maestros_tijera/valentina_morales.webp",
    servicios_ids: ["s10-manicura-rusa"]
  }
];

// Horario semanal por estilista: 0=Dom, 1=Lun, ..., 6=Sáb
const MOCK_DISPONIBILIDAD = [
  // Carolina Valenzuela: Lun-Sáb 09:00-18:00 (Domingo no atiende)
  ...[ 1, 2, 3, 4, 5, 6 ].map((dia) => ({ estilista_id: "e1-carolina-valenzuela", dia_semana: dia, hora_inicio: "09:00", hora_fin: "18:00" })),

  // Matías Muñoz: Lun-Sáb 09:00-17:00 (Domingo no atiende)
  ...[ 1, 2, 3, 4, 5, 6 ].map((dia) => ({ estilista_id: "e2-matias-munoz", dia_semana: dia, hora_inicio: "09:00", hora_fin: "17:00" })),

  // Camila Soto: Mar-Sáb 10:00-19:00
  ...[ 2, 3, 4, 5, 6 ].map((dia) => ({ estilista_id: "e3-camila-soto", dia_semana: dia, hora_inicio: "10:00", hora_fin: "19:00" })),

  // Gonzalo Riquelme: Lun-Vie 10:00-19:00
  ...[ 1, 2, 3, 4, 5 ].map((dia) => ({ estilista_id: "e4-gonzalo-riquelme", dia_semana: dia, hora_inicio: "10:00", hora_fin: "19:00" })),

  // Valentina Morales: Mié-Dom 10:00-18:00
  ...[ 3, 4, 5, 6, 0 ].map((dia) => ({ estilista_id: "e5-valentina-morales", dia_semana: dia, hora_inicio: "10:00", hora_fin: "18:00" })),
];

// Reservas de ejemplo para pruebas de colisión
const MOCK_RESERVAS = [
  {
    id: "r1",
    codigo_reserva: "PC-R1-0900",
    estilista_id: "e1-carolina-valenzuela",
    fecha: "2026-09-01",
    hora_inicio: "09:00",
    hora_fin: "11:00",
    estado: "confirmada",
  },
  {
    id: "r2",
    codigo_reserva: "PC-R2-1400",
    estilista_id: "e1-carolina-valenzuela",
    fecha: "2026-09-01",
    hora_inicio: "14:00",
    hora_fin: "15:30",
    estado: "confirmada",
  },
];

module.exports = {
  MOCK_SERVICIOS,
  MOCK_ESTILISTAS,
  MOCK_DISPONIBILIDAD,
  MOCK_RESERVAS,
};
