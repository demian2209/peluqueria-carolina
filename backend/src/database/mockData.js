const MOCK_SERVICIOS = [
  {
    id: "s1-coloracion-couture",
    nombre: "Coloración Couture",
    descripcion: "Pigmentación inteligente adaptada a su tono de piel mediante análisis IA. Técnica multi-tono con productos de alta gama.",
    duracion_min: 120,
    precio: 120.00,
    categoria: "coloracion",
    activo: true
  },
  {
    id: "s2-corte-autor",
    nombre: "Corte de Autor",
    descripcion: "Arquitectura capilar basada en la morfología de su rostro. Diseño exclusivo para cada cliente.",
    duracion_min: 45,
    precio: 45.00,
    categoria: "corte",
    activo: true
  },
  {
    id: "s3-hidratacion-ia",
    nombre: "Hidratación IA",
    descripcion: "Tratamiento de hidratación profunda con protocolo personalizado por análisis de IA. Productos de origen natural.",
    duracion_min: 60,
    precio: 85.00,
    categoria: "tratamiento",
    activo: true
  },
  {
    id: "s4-barberia-elite",
    nombre: "Barbería Elite",
    descripcion: "Rituales de afeitado tradicional con tecnología de vaporización. Acabado impecable y duradero.",
    duracion_min: 30,
    precio: 35.00,
    categoria: "barberia",
    activo: true
  },
  {
    id: "s5-peinado-styling",
    nombre: "Peinado & Styling",
    descripcion: "Looks editoriales para eventos de alto impacto. Creaciones únicas adaptadas al evento y personalidad.",
    duracion_min: 60,
    precio: 60.00,
    categoria: "styling",
    activo: true
  }
];

const MOCK_ESTILISTAS = [
  {
    id: "e1-marc-laurent",
    nombre: "Marc",
    apellido: "Laurent",
    especialidad: "Especialista en Color",
    bio: "Maestro colorista con más de 12 años de experiencia en salones de París y Milán.",
    nivel: "master",
    activo: true,
    foto_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDuPBlvq6n1v0Isk6me_xzRli1aDaCyE4cUx4ECNPZg7mlADdB94qIRdbe84-bx0X3O_EynyaeOVCOHUdJT1Lmwukc-rM5kvx7R94i_Wv_HGRbAk4KopfNd0Rk_CmwzusWqBEpmHG5hd93E0uQwFhiu85ViFO1JR_KC_5RfaaLhf1R5Z5bcriA77ieEaAypJpPk_ZILvRFGfKE8_SbLLKIzsBG4NPbI_4B3SpzTsClK2lXbDBum8YoFfa1gUFVpWF-V1fO1JVS2HmQ9",
    servicios_ids: ["s1-coloracion-couture", "s2-corte-autor", "s5-peinado-styling"]
  },
  {
    id: "e2-elena-russo",
    nombre: "Elena",
    apellido: "Russo",
    especialidad: "Cortes Arquitectónicos",
    bio: "Estilista de vanguardia formada en Toni & Guy London.",
    nivel: "master",
    activo: true,
    foto_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAdmriGzWwZfCFhNaYVj0O8G5CQmddTL0OyzuYPt5LxVb4RnDRwZMJhWOIqg2hhjwbOAYDeIGL2pl2uUXNT1jSvNOVysn6BQP1ib1g6OCs1i0v9MpwhK0seCBOcXRmPf9nzcYhZCDj4Xb-ICwFhbcVnu_OmszrSpPhWEbH7MaiRf9x-ZtB91vRVM2M4UBC0BtQvuGKWZpEX0QIL_MJ28Z9030zbsNEnVD3Sri1yV447HyhW1OeAXrVKxmaa4w0fjVpfxc6Dwt1Nl1pg",
    servicios_ids: ["s2-corte-autor", "s3-hidratacion-ia", "s5-peinado-styling"]
  },
  {
    id: "e3-julian-vance",
    nombre: "Julian",
    apellido: "Vance",
    especialidad: "Master Barber",
    bio: "Barbero tradicional con técnica moderna. Experto en afeitado clásico y degradados.",
    nivel: "artisan",
    activo: true,
    foto_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBMquZroNwEUEFaNYljxIQVxbypz3bBICOv5oJy0-wyS-6SWUIL-5qKQeHtG_88OnUGOKvMVELq4Cxw6lgy7LhPaJC0F2fgMTk4nepHY66L7xz37sdH-5afNhIAIKq_JSkvNi7X_G3xMYfh4A2o2ZR5StP5I7z887QY_5B118cYX6yelBzM4v_QsLwsORcLZ4P6cMDW9u0JIQII3hYKt35B4DDM3uvS0WWYEqy2CqJb3nTdjSpqr0vW7L80pj6dF7Ghas3yVFnv2u6s",
    servicios_ids: ["s2-corte-autor", "s4-barberia-elite"]
  },
  {
    id: "e4-sofia-chen",
    nombre: "Sofia",
    apellido: "Chen",
    especialidad: "Tratamientos IA",
    bio: "Especialista en tricología avanzada y tratamientos personalizados por IA.",
    nivel: "senior",
    activo: true,
    foto_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDVw9KyDkoisohmcXsVrpJeTIE9sbUSBTkeAP3Mc15_AaRlo1SA8lHXBZLvo6aHjvJgH4EQ-r7UExGrMUY4BHbNeFYJxxg_EikSxuir9aBRBLcxqeOEJKvRRTc4PwYltQ69zI3FsKUNtTBI_t60grbH7fKYXG1orXH4Pb2epHl6XEdsH7QLDq9C8oDKNEUKi-rZob0NEVK4kijjgYzpba-_HNjVNz85b4DBFHGZ59VT32iVg2c7QKV6if7cTpz1nyY-ToWtrLtb9FJv",
    servicios_ids: ["s1-coloracion-couture", "s3-hidratacion-ia"]
  }
];

// Horario semanal por estilista: 0=Dom, 1=Lun, ..., 6=Sáb
const MOCK_DISPONIBILIDAD = [
  // Marc Laurent: Lun-Vie 09:00-18:00, Sáb 09:00-14:00
  ...[ 1, 2, 3, 4, 5 ].map((dia) => ({ estilista_id: "e1-marc-laurent", dia_semana: dia, hora_inicio: "09:00", hora_fin: "18:00" })),
  { estilista_id: "e1-marc-laurent", dia_semana: 6, hora_inicio: "09:00", hora_fin: "14:00" },

  // Elena Russo: Mar-Sáb 10:00-19:00
  ...[ 2, 3, 4, 5, 6 ].map((dia) => ({ estilista_id: "e2-elena-russo", dia_semana: dia, hora_inicio: "10:00", hora_fin: "19:00" })),

  // Julian Vance: Lun-Sáb 09:00-17:00
  ...[ 1, 2, 3, 4, 5, 6 ].map((dia) => ({ estilista_id: "e3-julian-vance", dia_semana: dia, hora_inicio: "09:00", hora_fin: "17:00" })),

  // Sofia Chen: Mié-Dom 10:00-18:00
  ...[ 3, 4, 5, 6, 0 ].map((dia) => ({ estilista_id: "e4-sofia-chen", dia_semana: dia, hora_inicio: "10:00", hora_fin: "18:00" })),
];

// Reservas de ejemplo para pruebas de colisión
const MOCK_RESERVAS = [
  {
    id: "r1",
    estilista_id: "e1-marc-laurent",
    fecha: "2026-09-01",
    hora_inicio: "09:00",
    hora_fin: "11:00",
    estado: "confirmada",
  },
  {
    id: "r2",
    estilista_id: "e1-marc-laurent",
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

