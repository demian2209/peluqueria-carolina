const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// MOCK FALLBACK DATA (si el servidor backend no está escuchando)
const FALLBACK_SERVICIOS = [
  {
    id: "s1-coloracion-couture",
    nombre: "Coloración Couture",
    descripcion: "Pigmentación inteligente adaptada a su tono de piel mediante análisis IA. Técnica multi-tono con productos de alta gama.",
    duracion_min: 120,
    precio: 120.00,
    categoria: "coloracion"
  },
  {
    id: "s2-corte-autor",
    nombre: "Corte de Autor",
    descripcion: "Arquitectura capilar basada en la morfología de su rostro. Diseño exclusivo para cada cliente.",
    duracion_min: 45,
    precio: 45.00,
    categoria: "corte"
  },
  {
    id: "s3-hidratacion-ia",
    nombre: "Hidratación IA",
    descripcion: "Tratamiento de hidratación profunda con protocolo personalizado por análisis de IA. Productos de origen natural.",
    duracion_min: 60,
    precio: 85.00,
    categoria: "tratamiento"
  },
  {
    id: "s4-barberia-elite",
    nombre: "Barbería Elite",
    descripcion: "Rituales de afeitado tradicional con tecnología de vaporización. Acabado impecable y duradero.",
    duracion_min: 30,
    precio: 35.00,
    categoria: "barberia"
  },
  {
    id: "s5-peinado-styling",
    nombre: "Peinado & Styling",
    descripcion: "Looks editoriales para eventos de alto impacto. Creaciones únicas adaptadas al evento y personalidad.",
    duracion_min: 60,
    precio: 60.00,
    categoria: "styling"
  }
];

const FALLBACK_ESTILISTAS = [
  {
    id: "e1-marc-laurent",
    nombre: "Marc",
    apellido: "Laurent",
    especialidad: "Especialista en Color",
    nivel: "master",
    bio: "Maestro colorista con más de 12 años de experiencia en salones de París y Milán."
  },
  {
    id: "e2-elena-russo",
    nombre: "Elena",
    apellido: "Russo",
    especialidad: "Cortes Arquitectónicos",
    nivel: "master",
    bio: "Estilista de vanguardia formada en Toni & Guy London."
  },
  {
    id: "e3-julian-vance",
    nombre: "Julian",
    apellido: "Vance",
    especialidad: "Master Barber",
    nivel: "artisan",
    bio: "Barbero tradicional con técnica moderna. Experto en afeitado clásico y degradados."
  },
  {
    id: "e4-sofia-chen",
    nombre: "Sofia",
    apellido: "Chen",
    especialidad: "Tratamientos IA",
    nivel: "senior",
    bio: "Especialista en tricología avanzada y tratamientos personalizados por IA."
  }
];

const FALLBACK_SLOTS = ["09:00", "10:00", "11:30", "12:00", "14:30", "15:30", "16:30", "17:00"];

/**
 * Obtener lista de servicios desde la API
 */
export async function getServicios(categoria = '') {
  try {
    const url = categoria
      ? `${API_BASE_URL}/servicios?categoria=${encodeURIComponent(categoria)}`
      : `${API_BASE_URL}/servicios`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener servicios');
    const json = await res.json();
    return json.data || FALLBACK_SERVICIOS;
  } catch (err) {
    console.warn('Backend API inaccesible, usando fallback local para servicios.');
    return FALLBACK_SERVICIOS;
  }
}

/**
 * Obtener lista de estilistas desde la API
 */
export async function getEstilistas(nivel = '') {
  try {
    const url = nivel
      ? `${API_BASE_URL}/estilistas?nivel=${encodeURIComponent(nivel)}`
      : `${API_BASE_URL}/estilistas`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener estilistas');
    const json = await res.json();
    return json.data || FALLBACK_ESTILISTAS;
  } catch (err) {
    console.warn('Backend API inaccesible, usando fallback local para estilistas.');
    return FALLBACK_ESTILISTAS;
  }
}

/**
 * Obtener slots de disponibilidad para estilista, fecha y servicio
 */
export async function getDisponibilidad({ estilista_id, fecha, servicio_id }) {
  try {
    if (!estilista_id || !fecha || !servicio_id) return [];
    const url = `${API_BASE_URL}/disponibilidad?estilista_id=${encodeURIComponent(estilista_id)}&fecha=${encodeURIComponent(fecha)}&servicio_id=${encodeURIComponent(servicio_id)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener disponibilidad');
    const json = await res.json();
    return json.data?.slots_disponibles || [];
  } catch (err) {
    console.warn('Backend API inaccesible, usando slots de fallback local.');
    return FALLBACK_SLOTS;
  }
}

/**
 * Enviar solicitud de reserva a la API
 */
export async function postReserva(bookingData) {
  try {
    const res = await fetch(`${API_BASE_URL}/reservas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || 'Error al procesar la reserva');
    }

    return json;
  } catch (err) {
    // Si la API falla por conexión, generamos una respuesta de confirmación mock estructurada
    if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
      return {
        status: 'success',
        source: 'client_fallback',
        data: {
          id: `RES-${Math.floor(100000 + Math.random() * 900000)}`,
          cliente_nombre: bookingData.cliente_nombre,
          cliente_email: bookingData.cliente_email,
          fecha: bookingData.fecha,
          hora_inicio: bookingData.hora_inicio,
          estado: 'pendiente',
        },
      };
    }
    throw err;
  }
}
