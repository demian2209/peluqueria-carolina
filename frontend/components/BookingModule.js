'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getServicios,
  getEstilistas,
  getDisponibilidadDetallada,
  postReserva,
  getReservaCliente,
  cancelarReservaCliente,
  reprogramarReservaCliente,
  obtenerFechaHoraSistemaCliente,
  filtrarHorariosSegunRelojSistema,
  suscribirActualizacionCatalogo,
  suscribirActualizacionBloqueos,
  suscribirActualizacionEquipo,
  obtenerInfoHorarioEstilista,
  calcularSlotsPorServicio,
  resolverDuracionServicio,
} from '../services/api';

export default function BookingModule() {
  const [servicios, setServicios] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Mode: 'book' | 'manage'
  const [activeTab, setActiveTab] = useState('book');

  // Form State (Book)
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [displayTelefono, setDisplayTelefono] = useState('');
  const [telefonoValido, setTelefonoValido] = useState(false);
  const [telefonoTocado, setTelefonoTocado] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [selectedStylist, setSelectedStylist] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notas, setNotas] = useState('');

  // UI state (Book)
  const [submitting, setSubmitting] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [stylistOffDayInfo, setStylistOffDayInfo] = useState(null);
  const [blockedDayReason, setBlockedDayReason] = useState('');

  // Self-Service Management State ('manage' tab)
  const [lookupId, setLookupId] = useState('');
  const [lookupContacto, setLookupContacto] = useState('');
  const [lookupToken, setLookupToken] = useState('');
  const [managedReserva, setManagedReserva] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState('');
  const [manageSuccess, setManageSuccess] = useState('');

  // Reschedule sub-state inside 'manage'
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [rescheduleOffDayInfo, setRescheduleOffDayInfo] = useState(null);
  const [rescheduleBlockedDayReason, setRescheduleBlockedDayReason] = useState('');
  const [confirmCancelAsk, setConfirmCancelAsk] = useState(false);

  // Normaliza texto (sin tildes y en minúsculas) para comparación determinista
  const normalizeText = (txt = '') =>
    String(txt)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Verifica si un estilista corresponde exclusivamente a un servicio según la matriz oficial:
  // - Carolina Valenzuela: Balayage & Iluminación Morena, y Coloración Completa o Retoque de Raíz.
  // - Matías Muñoz: Corte Caballero & Fade, y Ritual de Barba Tradicional.
  // - Camila Soto: Botox Capilar Antifrizz, Alisado Orgánico Vegano, y Masaje Reparador Profundo (K18 / Olaplex).
  // - Gonzalo Riquelme: Corte Mujer + Lavado y Brushing, y Peinado Social & Ondas al Agua.
  // - Valentina Morales: Manicura Rusa & Esmaltado Permanente.
  const doesStylistMatchService = useCallback((estilista, servicio) => {
    if (!estilista || !servicio) return false;

    if (Array.isArray(estilista.servicios_ids) && estilista.servicios_ids.length > 0) {
      return estilista.servicios_ids.some((id) => String(id) === String(servicio.id));
    }

    const sName = normalizeText(servicio.nombre);
    const eFull = normalizeText(`${estilista.nombre || ''} ${estilista.apellido || ''}`);

    const isCanonicalStylist =
      eFull.includes('carolina') ||
      eFull.includes('matias') ||
      eFull.includes('camila') ||
      eFull.includes('gonzalo') ||
      eFull.includes('valentina');

    // Miembros nuevos sin servicios restringidos pueden atender todos los servicios del catálogo
    if (!isCanonicalStylist) {
      return true;
    }

    if (sName.includes('balayage') || sName.includes('coloracion') || sName.includes('retoque')) {
      return eFull.includes('carolina');
    }
    if (sName.includes('caballero') || sName.includes('fade') || sName.includes('barba')) {
      return eFull.includes('matias');
    }
    if (sName.includes('botox') || sName.includes('alisado') || sName.includes('k18') || sName.includes('olaplex') || sName.includes('masaje reparador')) {
      return eFull.includes('camila');
    }
    if (sName.includes('corte mujer') || sName.includes('peinado') || sName.includes('ondas')) {
      return eFull.includes('gonzalo');
    }
    if (sName.includes('manicura') || sName.includes('esmaltado')) {
      return eFull.includes('valentina');
    }

    // Fallback por categoría para servicios nuevos creados desde el Panel Admin
    const sCat = normalizeText(servicio.categoria);
    if (sCat === 'coloracion') return eFull.includes('carolina');
    if (sCat === 'barberia') return eFull.includes('matias');
    if (sCat === 'tratamiento') return eFull.includes('camila');
    if (sCat === 'corte' || sCat === 'styling') return eFull.includes('gonzalo');
    if (sCat === 'manicura') return eFull.includes('valentina');

    return true;
  }, []);

  // Retorna únicamente los estilistas habilitados para el servicio seleccionado
  const getStylistsForService = useCallback(
    (serviceId, allServicios, allEstilistas) => {
      if (!serviceId) return [];
      const svc = allServicios.find((s) => String(s.id) === String(serviceId));
      if (!svc) return [];
      return allEstilistas.filter((e) => doesStylistMatchService(e, svc));
    },
    [doesStylistMatchService]
  );

  // Escuchar eventos personalizados disparados desde 'Nuestra Selección' o 'Maestros de la Tijera'
  useEffect(() => {
    const handleCustomServiceSelect = (event) => {
      const targetServiceId = event.detail;
      if (targetServiceId) {
        setSelectedService(targetServiceId);
        const matches = getStylistsForService(targetServiceId, servicios, estilistas);
        setSelectedStylist(matches[0]?.id || '');
      }
    };

    const handleCustomStylistSelect = (event) => {
      const targetStylistId = event.detail;
      if (targetStylistId) {
        setActiveTab('book');
        setBookingConfirmation(null);
        const targetStylist = estilistas.find((e) => String(e.id) === String(targetStylistId));
        if (targetStylist) {
          const currentSvc = servicios.find((s) => String(s.id) === String(selectedService));
          if (!currentSvc || !doesStylistMatchService(targetStylist, currentSvc)) {
            const matchingService =
              servicios.find((s) => doesStylistMatchService(targetStylist, s)) || servicios[0];
            if (matchingService) {
              setSelectedService(matchingService.id);
            }
          }
        }
        setSelectedStylist(targetStylistId);
      }
    };

    window.addEventListener('seleccionarServicio', handleCustomServiceSelect);
    window.addEventListener('seleccionarEstilista', handleCustomStylistSelect);
    return () => {
      window.removeEventListener('seleccionarServicio', handleCustomServiceSelect);
      window.removeEventListener('seleccionarEstilista', handleCustomStylistSelect);
    };
  }, [servicios, estilistas, selectedService, getStylistsForService, doesStylistMatchService]);

  const handleServiceChange = (svcId) => {
    setSelectedService(svcId);
    if (!svcId) {
      setSelectedStylist('');
      return;
    }
    const matches = getStylistsForService(svcId, servicios, estilistas);
    setSelectedStylist(matches[0]?.id || '');
  };

  // Lista estricta de estilistas para el servicio actualmente seleccionado
  const estilistasParaServicio = getStylistsForService(selectedService, servicios, estilistas);

  // Cargar servicios y estilistas al montar y suscribir a actualizaciones desde Admin
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [svcData, estData] = await Promise.all([
          getServicios(),
          getEstilistas(),
        ]);
        if (Array.isArray(svcData)) {
          setServicios(svcData);
        }
        if (Array.isArray(estData)) {
          const activos = estData.filter((e) => e && e.activo !== false);
          setEstilistas(activos);
          setSelectedStylist((prev) =>
            prev && !activos.some((e) => String(e.id) === String(prev)) ? '' : prev
          );
        }
      } catch (err) {
        console.error('Error al cargar servicios o estilistas:', err);
      }
    }
    loadInitialData();
    const unsubCatalogo = suscribirActualizacionCatalogo(() => {
      loadInitialData();
    });
    const unsubEquipo = suscribirActualizacionEquipo(() => {
      loadInitialData();
    });
    return () => {
      unsubCatalogo();
      unsubEquipo();
    };
  }, []);

  // Consultar disponibilidad cuando cambien la fecha, estilista o servicio
  // Ajustando los bloques al tiempo real de cada servicio según "Nuestra Selección"
  const refreshBookingSlots = useCallback(async () => {
    const targetService = selectedService || servicios[0]?.id || 's4-balayage';
    const targetServiceObj =
      servicios.find((s) => String(s.id) === String(targetService)) ||
      servicios[0] ||
      null;
    const stylistsForTarget = getStylistsForService(targetService, servicios, estilistas);
    const targetStylist =
      selectedStylist ||
      stylistsForTarget[0]?.id ||
      estilistas[0]?.id ||
      'e1-carolina-valenzuela';
    const targetStylistObj =
      estilistas.find((e) => String(e.id) === String(targetStylist)) ||
      stylistsForTarget[0] ||
      estilistas[0] ||
      null;
    const targetStylistName = targetStylistObj
      ? [targetStylistObj.nombre, targetStylistObj.apellido]
        .filter(Boolean)
        .join(' ')
        .replace(/\b(\w+)\s+\1\b/i, '$1')
        .trim()
      : '';
    const duracionServicio = resolverDuracionServicio(
      targetService,
      targetServiceObj?.duracion_min,
      servicios
    );

    if (date) {
      const infoHorario = obtenerInfoHorarioEstilista(targetStylist, targetStylistName, date);
      if (!infoHorario.trabajaEseDia) {
        setStylistOffDayInfo(infoHorario);
        setBlockedDayReason('');
        setAvailableSlots([]);
        setTime('');
        setLoadingSlots(false);
        return;
      }

      setStylistOffDayInfo(null);
      setBlockedDayReason('');
      setLoadingSlots(true);
      setErrorMsg('');
      try {
        const disp = await getDisponibilidadDetallada({
          estilista_id: targetStylist,
          estilista_nombre: targetStylistName,
          fecha: date,
          servicio_id: targetService,
          duracion_min: duracionServicio,
          listaServicios: servicios,
        });
        if (disp.bloqueadoDiaCompleto) {
          setBlockedDayReason(disp.motivoBloqueo || 'Fecha bloqueada por administración');
          setAvailableSlots([]);
          setTime('');
        } else {
          setBlockedDayReason('');
          const validSlots = filtrarHorariosSegunRelojSistema(disp.slots, date);
          setAvailableSlots(validSlots);
          setTime((prev) => (validSlots.includes(prev) ? prev : validSlots[0] || ''));
        }
      } catch (err) {
        console.error(err);
        setBlockedDayReason('');
        setAvailableSlots([]);
        setTime('');
      } finally {
        setLoadingSlots(false);
      }
    } else {
      setStylistOffDayInfo(null);
      setBlockedDayReason('');
      const { slots: previewSlots } = calcularSlotsPorServicio({
        estilista_id: targetStylist,
        estilista_nombre: targetStylistName,
        servicio_id: targetService,
        duracion_min: duracionServicio,
        fecha: '',
        filtrarReloj: false,
        listaServicios: servicios,
      });
      setAvailableSlots(previewSlots);
      setTime((prev) => (previewSlots.includes(prev) ? prev : previewSlots[0] || ''));
    }
}, [date, selectedService, selectedStylist, estilistas, servicios, getStylistsForService]);

useEffect(() => {
  refreshBookingSlots();
}, [refreshBookingSlots]);

// Suscribir a cambios de bloqueos horarios desde el Panel de Administración (tiempo real entre pestañas)
useEffect(() => {
  const unsubscribe = suscribirActualizacionBloqueos(() => {
    refreshBookingSlots();
  });
  return () => unsubscribe();
}, [refreshBookingSlots]);

// Re-validar periódicamente contra el reloj del sistema para descartar bloques que queden en el pasado mientras el formulario está abierto
useEffect(() => {
  const timer = setInterval(() => {
    const { fechaHoy } = obtenerFechaHoraSistemaCliente();
      if (date && date === fechaHoy) {
        setAvailableSlots((prev) => {
          const filtered = filtrarHorariosSegunRelojSistema(prev, date);
          setTime((currTime) => (filtered.includes(currTime) ? currTime : filtered[0] || ''));
          return filtered;
        });
      }
      if (isRescheduling && newDate === fechaHoy) {
        setRescheduleSlots((prev) => {
          const filtered = filtrarHorariosSegunRelojSistema(prev, newDate);
          setNewTime((currTime) => (filtered.includes(currTime) ? currTime : filtered[0] || ''));
          return filtered;
        });
      }
    }, 30000);
  return () => clearInterval(timer);
}, [date, isRescheduling, newDate]);

// Soporte para enlaces directos de los 2 botones de WhatsApp y Email (?reserva=PC-XX-XXXX&token=TOKEN&accion=reprogramar|cancelar)
useEffect(() => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const qId = params.get('reserva');
  const qToken = params.get('token') || '';
  const qContacto = params.get('contacto') || '';
  const qAccion = (params.get('accion') || '').toLowerCase();

  if (qId) {
    setActiveTab('manage');
    setLookupId(qId);
    setLookupToken(qToken);
    setLookupContacto(qContacto);

    // Limpiar PII ('contacto') de la barra de direcciones para evitar fuga por Referer o historial
    if (qContacto && window.history?.replaceState) {
      const cleanParams = new URLSearchParams(window.location.search);
      cleanParams.delete('contacto');
      const cleanSearch = cleanParams.toString();
      const newUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', newUrl);
    }

    if (qToken || qContacto) {
      getReservaCliente(qId, { token: qToken, contacto: qContacto })
        .then((data) => {
          setManagedReserva(data);
          setLookupId(data.codigo_reserva || String(data.id));
          const { fechaHoy } = obtenerFechaHoraSistemaCliente();
          const initialDate = data.fecha && data.fecha >= fechaHoy ? data.fecha : fechaHoy;
          setNewDate(initialDate);
          setNewTime(data.hora_inicio || '');
          if (data.estado === 'pendiente') {
            if (qAccion === 'reprogramar') {
              setIsRescheduling(true);
              setConfirmCancelAsk(false);
            } else if (qAccion === 'cancelar') {
              setConfirmCancelAsk(true);
              setIsRescheduling(false);
            }
          } else {
            setIsRescheduling(false);
            setConfirmCancelAsk(false);
          }
        })
        .catch((err) => setManageError(err.message));
    }
  }
}, []);

// Consultar disponibilidad al reprogramar cita
useEffect(() => {
  async function loadRescheduleSlots() {
    if (!isRescheduling || !managedReserva || !newDate) return;
    const estId = managedReserva.estilista_id || selectedStylist || estilistas[0]?.id || '1';
    const estNombre = managedReserva.estilista_nombre || '';
    const svcId = managedReserva.servicio_id || selectedService || servicios[0]?.id || '1';
    const svcObj = servicios.find((s) => String(s.id) === String(svcId));
    const duracion = resolverDuracionServicio(svcId, svcObj?.duracion_min, servicios);

    const infoHorario = obtenerInfoHorarioEstilista(estId, estNombre, newDate);
    if (!infoHorario.trabajaEseDia) {
      setRescheduleOffDayInfo(infoHorario);
      setRescheduleBlockedDayReason('');
      setRescheduleSlots([]);
      setNewTime('');
      setLoadingRescheduleSlots(false);
      return;
    }

    setRescheduleOffDayInfo(null);
    setRescheduleBlockedDayReason('');
    setLoadingRescheduleSlots(true);
    try {
      const disp = await getDisponibilidadDetallada({
        estilista_id: estId,
        estilista_nombre: estNombre,
        fecha: newDate,
        servicio_id: svcId,
        duracion_min: duracion,
        listaServicios: servicios,
      });
      if (disp.bloqueadoDiaCompleto) {
        setRescheduleBlockedDayReason(disp.motivoBloqueo || 'Fecha bloqueada por administración');
        setRescheduleSlots([]);
        setNewTime('');
      } else {
        setRescheduleBlockedDayReason('');
        const validSlots = filtrarHorariosSegunRelojSistema(disp.slots, newDate);
        setRescheduleSlots(validSlots);
        setNewTime((prev) => (validSlots.includes(prev) ? prev : validSlots[0] || ''));
      }
    } catch (_) {
      setRescheduleBlockedDayReason('');
      setRescheduleSlots([]);
      setNewTime('');
    } finally {
      setLoadingRescheduleSlots(false);
    }
  }
  loadRescheduleSlots();
}, [isRescheduling, managedReserva, newDate, selectedStylist, selectedService, estilistas, servicios]);

const handleTelefonoChange = (e) => {
  setTelefonoTocado(true);
  const val = e.target.value;

  // 1. Extraer solo dígitos numéricos
  let digits = val.replace(/\D/g, '');

  // 2. Limpieza inteligente si el usuario pega con código de país o prefijo:
  // Caso +56 9 XXXX XXXX o 569XXXXXXXX (11 dígitos comenzando en 569)
  if (digits.startsWith('569')) {
    digits = digits.slice(3);
  }
  // Caso 56XXXXXXXX (10 dígitos comenzando en 56)
  else if (digits.startsWith('56') && digits.length >= 10) {
    digits = digits.slice(2);
    if (digits.startsWith('9')) digits = digits.slice(1);
  }
  // Caso 9XXXXXXXX (9 dígitos comenzando en 9)
  else if (digits.startsWith('9') && digits.length === 9) {
    digits = digits.slice(1);
  }

  // 3. Limitar a los 8 dígitos locales oficiales chilenos
  digits = digits.slice(0, 8);

  // 4. Formatear para mostrar ordenado: "XXXX XXXX"
  let formatted = digits;
  if (digits.length > 4) {
    formatted = `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }

  setDisplayTelefono(formatted);
  const esValido = digits.length === 8;
  setTelefonoValido(esValido);

  // 5. Normalizar a formato canónico E.164 (+569XXXXXXXX) para backend y WhatsApp
  if (digits.length > 0) {
    setClienteTelefono(`+569${digits}`);
  } else {
    setClienteTelefono('');
  }
};

const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  setErrorMsg('');

  // Validación estricta previa al envío
  const digits = displayTelefono.replace(/\D/g, '');
  if (digits.length !== 8) {
    setErrorMsg('Por favor ingrese un número de WhatsApp chileno válido (8 dígitos después del +56 9).');
    setTelefonoTocado(true);
    setSubmitting(false);
    return;
  }

  const { fechaHoy, horaActual } = obtenerFechaHoraSistemaCliente();
  const targetDate = date || fechaHoy;

  if (stylistOffDayInfo && !stylistOffDayInfo.trabajaEseDia) {
    setErrorMsg(
      `${stylistOffDayInfo.estilistaNombre} no atiende los días ${stylistOffDayInfo.nombreDia}. Horario de atención: ${stylistOffDayInfo.diasAtencionTexto}.`
    );
    setSubmitting(false);
    return;
  }

  if (blockedDayReason) {
    setErrorMsg(`La fecha seleccionada no está disponible (${blockedDayReason}). Por favor seleccione otra fecha.`);
    setSubmitting(false);
    return;
  }

  if (!time) {
    setErrorMsg('Por favor seleccione un bloque horario disponible.');
    setSubmitting(false);
    return;
  }

  // Restricción estricta: prohibido confirmar fechas pasadas u horas pasadas del mismo día
  const validForSystemClock = filtrarHorariosSegunRelojSistema([time], targetDate);
  if (validForSystemClock.length === 0) {
    setErrorMsg(`No es posible agendar en un horario pasado (${time} hs). Hora actual del sistema: ${horaActual} hs. Seleccione un bloque horario posterior.`);
    refreshBookingSlots();
    setSubmitting(false);
    return;
  }

  try {
    const payload = {
      cliente_nombre: clienteNombre.trim(),
      cliente_email: clienteEmail.trim().toLowerCase(),
      cliente_telefono: `+569${digits}`,
      servicio_id: selectedService || (servicios[0]?.id || 's1-corte-mujer'),
      estilista_id: selectedStylist || (estilistas[0]?.id || 'e1-carolina-valenzuela'),
      fecha: targetDate,
      hora_inicio: time,
      notas,
    };

    const result = await postReserva(payload);
    setBookingConfirmation(result.data);
    // Sincronizar de inmediato los horarios disponibles tras ocupar el turno
    refreshBookingSlots();
  } catch (err) {
    setErrorMsg(err.message || 'Ocurrió un error al procesar su reserva.');
    refreshBookingSlots();
  } finally {
    setSubmitting(false);
  }
};

const resetForm = () => {
  setBookingConfirmation(null);
  setClienteNombre('');
  setClienteEmail('');
  setClienteTelefono('');
  setDisplayTelefono('');
  setTelefonoValido(false);
  setTelefonoTocado(false);
  setDate('');
  setTime('');
  setNotas('');
};

const handleOpenManageFromConfirmation = (initialAction = '') => {
  if (!bookingConfirmation) return;
  const { fechaHoy } = obtenerFechaHoraSistemaCliente();
  setLookupId(String(bookingConfirmation.codigo_reserva || bookingConfirmation.id));
  setLookupContacto(bookingConfirmation.cliente_telefono || bookingConfirmation.cliente_email || clienteTelefono || clienteEmail);
  setLookupToken(bookingConfirmation.gestion_token || '');
  setManagedReserva(bookingConfirmation);
  setNewDate(bookingConfirmation.fecha && bookingConfirmation.fecha >= fechaHoy ? bookingConfirmation.fecha : fechaHoy);
  setNewTime(bookingConfirmation.hora_inicio || '');
  const esModificable = bookingConfirmation.estado === 'pendiente';
  setIsRescheduling(esModificable && initialAction === 'reprogramar');
  setConfirmCancelAsk(esModificable && initialAction === 'cancelar');
  setManageError('');
  setManageSuccess('');
  setActiveTab('manage');
};

const handleLookupReserva = async (e) => {
  e.preventDefault();
  setManageError('');
  setManageSuccess('');
  setConfirmCancelAsk(false);
  setIsRescheduling(false);

  if (!lookupId.trim() || (!lookupContacto.trim() && !lookupToken)) {
    setManageError('Ingresa tu Código de Reserva y el WhatsApp o Email con el que agendaste.');
    return;
  }

  setManageLoading(true);
  try {
    const data = await getReservaCliente(lookupId, {
      contacto: lookupContacto,
      token: lookupToken,
    });
    const { fechaHoy } = obtenerFechaHoraSistemaCliente();
    setManagedReserva(data);
    if (data.codigo_reserva) setLookupId(data.codigo_reserva);
    if (data.gestion_token) setLookupToken(data.gestion_token);
    setNewDate(data.fecha && data.fecha >= fechaHoy ? data.fecha : fechaHoy);
    setNewTime(data.hora_inicio || '');
  } catch (err) {
    setManagedReserva(null);
    setManageError(err.message || 'No encontramos una reserva con esos datos.');
  } finally {
    setManageLoading(false);
  }
};

const handleCancelManagedReserva = async () => {
  if (!managedReserva) return;
  setManageLoading(true);
  setManageError('');
  setManageSuccess('');

  try {
    const res = await cancelarReservaCliente(managedReserva.codigo_reserva || managedReserva.id, {
      contacto: lookupContacto || managedReserva.cliente_telefono || managedReserva.cliente_email,
      token: lookupToken || managedReserva.gestion_token,
    });
    const updated = res.data || { ...managedReserva, estado: 'cancelada' };
    setManagedReserva(updated);
    if (bookingConfirmation && String(bookingConfirmation.id) === String(managedReserva.id)) {
      setBookingConfirmation(updated);
    }
    setConfirmCancelAsk(false);
    setIsRescheduling(false);
    const cod = updated.codigo_reserva || `#${updated.id}`;
    setManageSuccess(`Cita ${cod} cancelada exitosamente. Hemos enviado el comprobante de cancelación a tu WhatsApp/Email y liberado el horario.`);
    // Actualizar disponibilidad del formulario en tiempo real
    refreshBookingSlots();
  } catch (err) {
    setManageError(err.message || 'No se pudo cancelar la cita.');
  } finally {
    setManageLoading(false);
  }
};

const handleRescheduleManagedReserva = async (e) => {
  e.preventDefault();
  if (!managedReserva || !newDate || !newTime) {
    setManageError('Selecciona la nueva fecha y hora disponible para reprogramar.');
    return;
  }

  // Restricción estricta: prohibido reprogramar hacia un horario pasado del día actual
  const { horaActual } = obtenerFechaHoraSistemaCliente();
  const validForSystemClock = filtrarHorariosSegunRelojSistema([newTime], newDate);
  if (validForSystemClock.length === 0) {
    setManageError(`No es posible reprogramar hacia un horario pasado (${newTime} hs). Hora actual del sistema: ${horaActual} hs. Selecciona un bloque posterior.`);
    setRescheduleSlots((prev) => filtrarHorariosSegunRelojSistema(prev, newDate));
    return;
  }

  setManageLoading(true);
  setManageError('');
  setManageSuccess('');

  try {
    const res = await reprogramarReservaCliente(managedReserva.codigo_reserva || managedReserva.id, {
      fecha: newDate,
      hora_inicio: newTime,
      contacto: lookupContacto || managedReserva.cliente_telefono || managedReserva.cliente_email,
      token: lookupToken || managedReserva.gestion_token,
    });
    const updated = res.data || { ...managedReserva, fecha: newDate, hora_inicio: newTime };
    setManagedReserva(updated);
    if (updated.codigo_reserva) {
      setLookupId(updated.codigo_reserva);
    }
    if (bookingConfirmation && String(bookingConfirmation.id) === String(managedReserva.id)) {
      setBookingConfirmation(updated);
    }
    setIsRescheduling(false);
    const nuevoCod = updated.codigo_reserva || `#${updated.id}`;
    setManageSuccess(`Cita reprogramada con éxito para el ${updated.fecha} a las ${updated.hora_inicio} hs. Tu Nuevo Código de Reserva es ${nuevoCod}. Te enviamos la confirmación por WhatsApp y Email.`);
    // Actualizar disponibilidad del formulario en tiempo real
    refreshBookingSlots();
  } catch (err) {
    setManageError(err.message || 'No se pudo reprogramar la cita.');
  } finally {
    setManageLoading(false);
  }
};

return (
  <section className="booking-section" id="reservar">
    <div className="booking-container">
      <div className="booking-info-col">
        <h2 className="booking-title">
          Reserve su momento de <span>exclusividad</span>
        </h2>
        <p className="booking-desc">
          Nuestra plataforma inteligente le sugiere el mejor horario y estilista basándose en sus preferencias.
        </p>
        <ul className="booking-list">
          <li className="booking-item">
            <div className="booking-item-icon">
              <span className="material-symbols-outlined text-sm">check</span>
            </div>
            <div className="booking-item-text">
              <p className="booking-item-title">Confirmación Instantánea</p>
              <p className="booking-item-desc">Sin esperas, su cita se sincroniza al momento con nuestro sistema API.</p>
            </div>
          </li>
          <li className="booking-item">
            <div className="booking-item-icon">
              <span className="material-symbols-outlined text-sm">check</span>
            </div>
            <div className="booking-item-text">
              <p className="booking-item-title">Verificación de Disponibilidad en Tiempo Real</p>
              <p className="booking-item-desc">Horarios libres calculados sin colisiones.</p>
            </div>
          </li>
        </ul>
      </div>

      <div className="booking-card">
        {/* Selector de Modo: Agendar Cita vs. Autogestión sin cuenta */}
        <div className="booking-mode-tabs" role="tablist" aria-label="Opciones de reserva">
          <button
            id="tab-agendar"
            type="button"
            role="tab"
            aria-controls="panel-agendar"
            aria-selected={activeTab === 'book'}
            className={`booking-mode-tab ${activeTab === 'book' ? 'active' : ''}`}
            onClick={() => setActiveTab('book')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_add_on</span>
            <span>Agendar Cita</span>
          </button>
          <button
            id="tab-gestionar"
            type="button"
            role="tab"
            aria-controls="panel-gestionar"
            aria-selected={activeTab === 'manage'}
            className={`booking-mode-tab ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>event_repeat</span>
            <span>Gestionar mi Cita</span>
          </button>
        </div>

        {activeTab === 'manage' ? (
          /* PANEL: GESTIONAR MI CITA */
          <div
            className="booking-manage-panel"
            role="tabpanel"
            id="panel-gestionar"
            aria-labelledby="tab-gestionar"
          >
            <p className="booking-manage-intro">
              Consulta, reprograma o cancela tu reserva al instante con tu código de cita y el WhatsApp o Email registrado.
            </p>

            <form className="booking-lookup-form" onSubmit={handleLookupReserva}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="lookup-id">Código de Reserva *</label>
                  <input
                    id="lookup-id"
                    className="form-input"
                    type="text"
                    placeholder="Ej. PC-18-7F3A"
                    value={lookupId}
                    onChange={(e) => {
                      setLookupId(e.target.value);
                      setLookupToken('');
                    }}
                    tabIndex={activeTab === 'manage' ? 0 : -1}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lookup-contacto">Tu WhatsApp o Email *</label>
                  <input
                    id="lookup-contacto"
                    className="form-input"
                    type="text"
                    placeholder="+569... o correo@ejemplo.com"
                    value={lookupContacto}
                    onChange={(e) => setLookupContacto(e.target.value)}
                    tabIndex={activeTab === 'manage' ? 0 : -1}
                    required={!lookupToken}
                  />
                </div>
              </div>
              <button
                className="btn-submit btn-lookup"
                type="submit"
                disabled={manageLoading}
                tabIndex={activeTab === 'manage' ? 0 : -1}
              >
                {manageLoading && !managedReserva ? 'Verificando titularidad...' : 'Buscar mi Cita'}
              </button>
            </form>

            {manageError && (
              <div className="booking-alert booking-alert--error">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                <span>{manageError}</span>
              </div>
            )}

            {manageSuccess && (
              <div className="booking-alert booking-alert--success">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                <span>{manageSuccess}</span>
              </div>
            )}

            {!managedReserva && (
              <div className="booking-manage-guide">
                <h4 className="booking-manage-guide-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span>
                  <span>Autogestión rápida y segura</span>
                </h4>
                <ul className="booking-manage-guide-list">
                  <li>
                    <span className="material-symbols-outlined">confirmation_number</span>
                    <div>
                      <strong>Código único de reserva</strong>
                      <p>Encuéntralo en tu mensaje de confirmación por WhatsApp o Email (ej. <code>PC-18-7F3A</code>).</p>
                    </div>
                  </li>
                  <li>
                    <span className="material-symbols-outlined">update</span>
                    <div>
                      <strong>Reprogramación en línea</strong>
                      <p>Elige una nueva fecha u horario disponible y recibe un nuevo código actualizado al instante.</p>
                    </div>
                  </li>
                  <li>
                    <span className="material-symbols-outlined">event_busy</span>
                    <div>
                      <strong>Cancelación inmediata</strong>
                      <p>Anula tu cita sin costo en un clic, liberando el bloque horario automáticamente.</p>
                    </div>
                  </li>
                </ul>
              </div>
            )}

            {managedReserva && (
              <div className="managed-reserva-card">
                <div className="managed-reserva-header">
                  <div>
                    <span className="managed-reserva-code">
                      Código de Reserva: <strong>{managedReserva.codigo_reserva || `#${managedReserva.id}`}</strong>
                    </span>
                    {managedReserva.codigo_reserva_anterior && (
                      <span className="managed-reserva-prev-code">
                        (Anterior: {managedReserva.codigo_reserva_anterior})
                      </span>
                    )}
                    <h4 className="managed-reserva-client">{managedReserva.cliente_nombre}</h4>
                  </div>
                  <span className={`managed-status-badge status-${managedReserva.estado}`}>
                    {managedReserva.estado}
                  </span>
                </div>

                <div className="managed-reserva-details">
                  <p><strong>Servicio:</strong> {managedReserva.servicio_nombre || managedReserva.servicio_id}</p>
                  <p><strong>Estilista:</strong> {managedReserva.estilista_nombre || managedReserva.estilista_id}</p>
                  <p><strong>Fecha:</strong> {managedReserva.fecha}</p>
                  <p><strong>Horario:</strong> {managedReserva.hora_inicio} {managedReserva.hora_fin ? `- ${managedReserva.hora_fin}` : ''} hs</p>
                </div>

                {managedReserva.estado === 'pendiente' && (
                  <div className="managed-reserva-actions">
                    {!isRescheduling && !confirmCancelAsk && (
                      <div className="managed-action-buttons">
                        <button
                          type="button"
                          className="btn-manage-action btn-manage-reschedule"
                          onClick={() => {
                            setIsRescheduling(true);
                            setConfirmCancelAsk(false);
                            setManageError('');
                            setNewDate(managedReserva.fecha || new Date().toISOString().split('T')[0]);
                          }}
                          disabled={manageLoading}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>update</span>
                          <span>Reprogramar</span>
                        </button>
                        <button
                          type="button"
                          className="btn-manage-action btn-manage-cancel"
                          onClick={() => {
                            setConfirmCancelAsk(true);
                            setIsRescheduling(false);
                            setManageError('');
                          }}
                          disabled={manageLoading}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                          <span>Cancelar Cita</span>
                        </button>
                      </div>
                    )}

                    {confirmCancelAsk && (
                      <div className="managed-confirm-box">
                        <p className="managed-confirm-text">
                          ¿Confirmas que deseas cancelar tu cita del <strong>{managedReserva.fecha}</strong> a las <strong>{managedReserva.hora_inicio} hs</strong>?
                          Se enviará notificación de cancelación a tu WhatsApp/Email y el turno quedará libre.
                        </p>
                        <div className="managed-action-buttons">
                          <button
                            type="button"
                            className="btn-manage-action btn-manage-cancel-confirm"
                            onClick={handleCancelManagedReserva}
                            disabled={manageLoading}
                          >
                            {manageLoading ? 'Cancelando...' : 'Sí, confirmar cancelación'}
                          </button>
                          <button
                            type="button"
                            className="btn-manage-action btn-manage-secondary"
                            onClick={() => setConfirmCancelAsk(false)}
                            disabled={manageLoading}
                          >
                            Volver
                          </button>
                        </div>
                      </div>
                    )}

                    {isRescheduling && (
                      <form className="managed-reschedule-form" onSubmit={handleRescheduleManagedReserva}>
                        <h5 className="managed-reschedule-title">Selecciona nueva fecha y horario</h5>
                        <div className="form-group">
                          <label className="form-label">Nueva Fecha</label>
                          <input
                            className="form-input"
                            type="date"
                            min={obtenerFechaHoraSistemaCliente().fechaHoy}
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group form-group--time">
                          <label className="form-label">
                            Nuevo Horario {loadingRescheduleSlots && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(consultando...)</span>}
                          </label>
                          <div
                            className="time-slots"
                            style={{
                              '--slots-per-row': Math.min(5, Math.max(3, Math.ceil(rescheduleSlots.length / 2))),
                            }}
                          >
                              { rescheduleOffDayInfo && !rescheduleOffDayInfo.trabajaEseDia ? (
                                <div className="time-slots-offday" role="alert">
                                  <span className="material-symbols-outlined time-slots-offday-icon">event_busy</span>
                                  <div className="time-slots-offday-content">
                                    <strong>
                                      {rescheduleOffDayInfo.estilistaNombre} no atiende los días {rescheduleOffDayInfo.nombreDia}.
                                    </strong>
                                    <span>
                                      Horario de atención: {rescheduleOffDayInfo.diasAtencionTexto}. Selecciona otro día en el calendario.
                                    </span>
                                  </div>
                                </div>
                              ) : rescheduleBlockedDayReason ? (
                                <div className="time-slots-offday" role="alert">
                                  <span className="material-symbols-outlined time-slots-offday-icon">lock_clock</span>
                                  <div className="time-slots-offday-content">
                                    <strong>Fecha no disponible para reservas.</strong>
                                    <span>{rescheduleBlockedDayReason}. Selecciona otra fecha en el calendario.</span>
                                  </div>
                                </div>
                              ) : rescheduleSlots.length > 0 ? (
                                rescheduleSlots.map((slot) => (
                                  <button
                                    key={slot}
                                    type="button"
                                    className={`btn-time ${newTime === slot ? 'active' : ''}`}
                                    onClick={() => setNewTime(slot)}
                                  >
                                    {slot}
                                  </button>
                                ))
                              ) : (
                                <p className="time-slots-empty">
                                  {newDate === obtenerFechaHoraSistemaCliente().fechaHoy
                                    ? 'No quedan bloques disponibles posteriores a la hora actual para hoy. Selecciona otra fecha.'
                                    : 'No hay horarios libres para esta fecha.'}
                                </p>
                              )}
                          </div>
                        </div>
                        <div className="managed-action-buttons">
                          <button
                            type="submit"
                            className="btn-manage-action btn-manage-reschedule"
                            disabled={manageLoading || !newTime || rescheduleSlots.length === 0}
                          >
                            {manageLoading ? 'Guardando...' : 'Confirmar Nuevo Horario'}
                          </button>
                          <button
                            type="button"
                            className="btn-manage-action btn-manage-secondary"
                            onClick={() => setIsRescheduling(false)}
                            disabled={manageLoading}
                          >
                            Cancelar cambio
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* PANEL: AGENDAR CITA */
          <div
            className="booking-book-panel"
            role="tabpanel"
            id="panel-agendar"
            aria-labelledby="tab-agendar"
          >
            {bookingConfirmation ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--secondary)', marginBottom: '0.75rem' }}>
                  check_circle
                </span>
                <h3 style={{ fontFamily: 'var(--font-headline)', fontStyle: 'italic', fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--on-surface)' }}>
                  {bookingConfirmation.estado === 'cancelada' ? 'Reserva Cancelada' : '¡Reserva Confirmada!'}
                </h3>

                <div className="confirmation-code-banner">
                  <span className="confirmation-code-label">Código de Reserva</span>
                  <strong className="confirmation-code-value">
                    {bookingConfirmation.codigo_reserva || `#${bookingConfirmation.id}`}
                  </strong>
                  {bookingConfirmation.codigo_reserva_anterior && (
                    <span className="confirmation-code-prev">
                      Código reemplazado: {bookingConfirmation.codigo_reserva_anterior}
                    </span>
                  )}
                </div>

                <div style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', padding: '1rem', borderRadius: '8px', textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--on-surface)' }}>
                  <p><strong>Código:</strong> {bookingConfirmation.codigo_reserva || `#${bookingConfirmation.id}`}</p>
                  <p><strong>Cliente:</strong> {bookingConfirmation.cliente_nombre}</p>
                  <p><strong>Email:</strong> {bookingConfirmation.cliente_email}</p>
                  <p><strong>WhatsApp:</strong> {bookingConfirmation.cliente_telefono || clienteTelefono}</p>
                  {bookingConfirmation.servicio_nombre && <p><strong>Servicio:</strong> {bookingConfirmation.servicio_nombre}</p>}
                  {bookingConfirmation.estilista_nombre && <p><strong>Estilista:</strong> {bookingConfirmation.estilista_nombre}</p>}
                  <p><strong>Fecha:</strong> {bookingConfirmation.fecha}</p>
                  <p><strong>Hora:</strong> {bookingConfirmation.hora_inicio} hs</p>
                  <p><strong>Estado:</strong> <span style={{ textTransform: 'capitalize', color: 'var(--secondary)', fontWeight: 700 }}>{bookingConfirmation.estado}</span></p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {bookingConfirmation.estado === 'pendiente' && (
                    <div className="managed-action-buttons">
                      <button
                        className="btn-manage-action btn-manage-reschedule"
                        type="button"
                        onClick={() => handleOpenManageFromConfirmation('reprogramar')}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>event_repeat</span>
                        <span>Reprogramar Cita</span>
                      </button>
                      <button
                        className="btn-manage-action btn-manage-cancel"
                        type="button"
                        onClick={() => handleOpenManageFromConfirmation('cancelar')}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                        <span>Cancelar Cita</span>
                      </button>
                    </div>
                  )}
                  <button className="btn-submit" type="button" onClick={resetForm}>
                    Hacer otra reserva
                  </button>
                </div>
              </div>
            ) : (
              <form className="booking-form" onSubmit={handleSubmit}>
                {errorMsg && (
                  <div style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid var(--error)', padding: '0.75rem', borderRadius: '6px', color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Ej. Carolina Gómez"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-telefono">
                      WhatsApp <span style={{ color: 'var(--secondary)', fontSize: '0.8em' }}>*</span>
                    </label>
                    <div className={`phone-input-wrapper ${telefonoValido ? 'is-valid' : ''}`}>
                      <span className="phone-prefix" title="Chile (+56 9)">
                        <span className="phone-flag" role="img" aria-label="Chile">🇨🇱</span>
                        <span>+56 9</span>
                      </span>
                      <input
                        id="input-telefono"
                        className="form-input phone-local-input"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="5203 4275"
                        value={displayTelefono}
                        onChange={handleTelefonoChange}
                        onBlur={() => setTelefonoTocado(true)}
                        required
                      />
                    </div>
                    {telefonoTocado && !telefonoValido && (
                      <span className="form-hint hint-error">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
                        {displayTelefono.replace(/\D/g, '').length === 0
                          ? 'Ingresa tu número de WhatsApp para confirmar tu cita.'
                          : `Faltan ${8 - displayTelefono.replace(/\D/g, '').length} dígitos (ej. 5203 4275)`}
                      </span>
                    )}
                    {telefonoValido && (
                      <span className="form-hint hint-success">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                        Formato verificado (+56 9 {displayTelefono})
                      </span>
                    )}
                    {!telefonoTocado && (
                      <span className="form-hint">
                        Te enviaremos la confirmación instantánea por WhatsApp.
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="select-servicio">Servicio *</label>
                  <select
                    id="select-servicio"
                    className="form-select"
                    value={selectedService}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    required
                  >
                    <option value="">-- Seleccione un servicio --</option>
                    {servicios.map((s) => {
                      const dur = resolverDuracionServicio(s.id, s.duracion_min, servicios);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.nombre} — {dur} min (${Number(s.precio).toLocaleString('es-CL')})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="select-estilista">Estilista Preferido *</label>
                  <select
                    id="select-estilista"
                    className="form-select"
                    value={selectedStylist}
                    onChange={(e) => setSelectedStylist(e.target.value)}
                    disabled={!selectedService}
                    required
                  >
                    {!selectedService ? (
                      <option value="">-- Seleccione primero un servicio --</option>
                    ) : (
                      estilistasParaServicio.map((e) => {
                        const fullName = [e.nombre, e.apellido]
                          .filter(Boolean)
                          .join(' ')
                          .replace(/\b(\w+)\s+\1\b/i, '$1')
                          .trim();
                        const label = e.especialidad ? `${fullName} (${e.especialidad})` : fullName;
                        return (
                          <option key={e.id} value={e.id}>
                            {label}
                          </option>
                        );
                      })
                    )}
                  </select>
                  {selectedService && selectedStylist && (() => {
                    const estObj = estilistasParaServicio.find((e) => String(e.id) === String(selectedStylist)) || estilistasParaServicio[0];
                    const estName = estObj ? [estObj.nombre, estObj.apellido].filter(Boolean).join(' ').replace(/\b(\w+)\s+\1\b/i, '$1').trim() : '';
                    const info = obtenerInfoHorarioEstilista(selectedStylist, estName, date);
                    return (
                      <span className="form-hint">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--secondary)' }}>schedule</span>
                        <span>Atención de {info.estilistaNombre}: {info.diasAtencionTexto}</span>
                      </span>
                    );
                  })()}
                </div>

                <div className="form-row form-row--datetime">
                  <div className="form-group form-group--date">
                    <label className="form-label">Fecha</label>
                    <input
                      className="form-input"
                      type="date"
                      min={obtenerFechaHoraSistemaCliente().fechaHoy}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group form-group--time">
                    <label className="form-label">
                      Hora{' '}
                      {selectedService && (() => {
                        const svcObj = servicios.find((s) => String(s.id) === String(selectedService));
                        const dur = resolverDuracionServicio(selectedService, svcObj?.duracion_min, servicios);
                        return (
                          <span style={{ fontWeight: 500, textTransform: 'none', opacity: 0.85 }}>
                            ({dur} min)
                          </span>
                        );
                      })()}{' '}
                      {loadingSlots && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(consultando...)</span>}
                    </label>
                    <div
                      className="time-slots"
                      style={{
                        '--slots-per-row': Math.min(5, Math.max(3, Math.ceil(availableSlots.length / 2))),
                      }}
                    >
                        { stylistOffDayInfo && !stylistOffDayInfo.trabajaEseDia ? (
                          <div className="time-slots-offday" role="alert">
                            <span className="material-symbols-outlined time-slots-offday-icon">event_busy</span>
                            <div className="time-slots-offday-content">
                              <strong>
                                {stylistOffDayInfo.estilistaNombre} no atiende los días {stylistOffDayInfo.nombreDia}.
                              </strong>
                              <span>
                                Horario de atención: {stylistOffDayInfo.diasAtencionTexto}. Por favor seleccione otra fecha.
                              </span>
                            </div>
                          </div>
                        ) : blockedDayReason ? (
                          <div className="time-slots-offday" role="alert">
                            <span className="material-symbols-outlined time-slots-offday-icon">lock_clock</span>
                            <div className="time-slots-offday-content">
                              <strong>Fecha no disponible para reservas.</strong>
                              <span>{blockedDayReason}. Por favor seleccione otra fecha.</span>
                            </div>
                          </div>
                        ) : availableSlots.length > 0 ? (
                          availableSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              className={`btn-time ${time === slot ? 'active' : ''}`}
                              onClick={() => setTime(slot)}
                            >
                              {slot}
                            </button>
                          ))
                        ) : (
                          <p className="time-slots-empty">
                            {(date || obtenerFechaHoraSistemaCliente().fechaHoy) === obtenerFechaHoraSistemaCliente().fechaHoy
                              ? 'No quedan bloques horarios posteriores a la hora actual para hoy. Seleccione una fecha futura.'
                              : 'No hay turnos libres para esta combinación.'}
                          </p>
                        )}
                    </div>
                  </div>
                </div>

                <button
                  className="btn-submit"
                  type="submit"
                  disabled={submitting || availableSlots.length === 0 || !time}
                >
                  {submitting ? 'Procesando Cita...' : 'Finalizar Reserva'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  </section>
);
}
