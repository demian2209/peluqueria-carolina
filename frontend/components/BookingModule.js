'use client';

import { useState, useEffect } from 'react';
import { getServicios, getEstilistas, getDisponibilidad, postReserva } from '../services/api';

export default function BookingModule() {
  const [servicios, setServicios] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Form State
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedStylist, setSelectedStylist] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notas, setNotas] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Cargar servicios y estilistas al montar
  useEffect(() => {
    async function loadInitialData() {
      const [svcData, estData] = await Promise.all([
        getServicios(),
        getEstilistas(),
      ]);
      setServicios(svcData);
      setEstilistas(estData);
    }
    loadInitialData();
  }, []);

  // Consultar disponibilidad cuando cambien la fecha, estilista o servicio
  useEffect(() => {
    async function fetchSlots() {
      if (date && selectedService && selectedStylist) {
        setLoadingSlots(true);
        setErrorMsg('');
        try {
          const slots = await getDisponibilidad({
            estilista_id: selectedStylist,
            fecha: date,
            servicio_id: selectedService,
          });
          setAvailableSlots(slots);
          if (slots.length > 0) {
            setTime(slots[0]);
          } else {
            setTime('');
          }
        } catch (err) {
          console.error(err);
          setAvailableSlots([]);
        } finally {
          setLoadingSlots(false);
        }
      } else {
        setAvailableSlots(['09:00', '10:30', '12:00', '15:00', '17:30']);
      }
    }
    fetchSlots();
  }, [date, selectedService, selectedStylist]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        cliente_nombre: clienteNombre,
        cliente_email: clienteEmail,
        cliente_telefono: clienteTelefono,
        servicio_id: selectedService || (servicios[0]?.id || 's2-corte-autor'),
        estilista_id: selectedStylist || (estilistas[0]?.id || 'e1-marc-laurent'),
        fecha: date || new Date().toISOString().split('T')[0],
        hora_inicio: time || '10:00',
        notas,
      };

      const result = await postReserva(payload);
      setBookingConfirmation(result.data);
    } catch (err) {
      setErrorMsg(err.message || 'Ocurrió un error al procesar su reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setBookingConfirmation(null);
    setClienteNombre('');
    setClienteEmail('');
    setClienteTelefono('');
    setDate('');
    setTime('');
    setNotas('');
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
          {bookingConfirmation ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--secondary)', marginBottom: '1rem' }}>
                check_circle
              </span>
              <h3 style={{ fontFamily: 'var(--font-headline)', fontStyle: 'italic', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                ¡Reserva Confirmada!
              </h3>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Código de Reserva: <strong>{bookingConfirmation.id}</strong>
              </p>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                <p><strong>Cliente:</strong> {bookingConfirmation.cliente_nombre}</p>
                <p><strong>Email:</strong> {bookingConfirmation.cliente_email}</p>
                <p><strong>Fecha:</strong> {bookingConfirmation.fecha}</p>
                <p><strong>Hora:</strong> {bookingConfirmation.hora_inicio} hs</p>
                <p><strong>Estado:</strong> <span style={{ textTransform: 'capitalize', color: 'var(--primary)' }}>{bookingConfirmation.estado}</span></p>
              </div>
              <button className="btn-submit" type="button" onClick={resetForm}>
                Hacer otra reserva
              </button>
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
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Servicio</label>
                <select
                  className="form-select"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  required
                >
                  <option value="">Seleccione un servicio</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} (${s.precio})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Estilista Preferido</label>
                <select
                  className="form-select"
                  value={selectedStylist}
                  onChange={(e) => setSelectedStylist(e.target.value)}
                  required
                >
                  <option value="">Seleccione un estilista</option>
                  {estilistas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} {e.apellido} - {e.especialidad}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input
                    className="form-input"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Hora {loadingSlots && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(consultando...)</span>}
                  </label>
                  <div className="time-slots">
                    {availableSlots.length > 0 ? (
                      availableSlots.slice(0, 6).map((slot) => (
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
                      <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                        {date && selectedStylist ? 'No hay turnos libres para esta combinación.' : 'Seleccione servicio, estilista y fecha.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button className="btn-submit" type="submit" disabled={submitting}>
                {submitting ? 'Procesando Cita...' : 'Finalizar Reserva'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
