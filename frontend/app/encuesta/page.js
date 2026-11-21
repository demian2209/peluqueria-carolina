'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiBaseUrl } from '../../services/apiBase';
import { notificarActualizacionEncuestas } from '../../services/api';

const RATING_LABELS = {
  1: 'Muy insatisfecho/a',
  2: 'Podría mejorar',
  3: 'Regular / Aceptable',
  4: 'Muy buena atención',
  5: '¡Excelente experiencia!',
};

function EncuestaContent() {
  const searchParams = useSearchParams();
  const reservaIdParam = searchParams.get('reserva') || searchParams.get('reserva_id') || '';
  const tokenParam = searchParams.get('token') || '';

  const [reserva, setReserva] = useState(null);
  const [loading, setLoading] = useState(Boolean(reservaIdParam));
  const [errorCarga, setErrorCarga] = useState('');
  const [puntaje, setPuntaje] = useState(5);
  const [hoverPuntaje, setHoverPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviadoExito, setEnviadoExito] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  useEffect(() => {
    if (!reservaIdParam) return undefined;

    let cancelled = false;
    const cargarInfo = async () => {
      try {
        const queryToken = tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : '';
        const res = await fetch(
          `${getApiBaseUrl()}/reservas/${encodeURIComponent(reservaIdParam)}/encuesta${queryToken}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || 'No se pudo cargar la información de tu reserva.');
        }
        if (!cancelled) {
          setReserva(json.data);
          if (json.data?.ya_respondida) {
            setEnviadoExito(true);
            if (json.data?.encuesta?.puntaje) {
              setPuntaje(json.data.encuesta.puntaje);
            }
            if (json.data?.encuesta?.comentario) {
              setComentario(json.data.encuesta.comentario);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorCarga(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    cargarInfo();
    return () => {
      cancelled = true;
    };
  }, [reservaIdParam, tokenParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reservaIdParam || enviando) return;
    setEnviando(true);
    setErrorEnvio('');

    try {
      const res = await fetch(
        `${getApiBaseUrl()}/reservas/${encodeURIComponent(reservaIdParam)}/encuesta`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puntaje: Number(puntaje),
            comentario: comentario.trim(),
            ...(tokenParam ? { token: tokenParam } : {}),
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Error al registrar tu encuesta.');
      }
      notificarActualizacionEncuestas();
      setEnviadoExito(true);
    } catch (err) {
      setErrorEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const activeStars = hoverPuntaje || puntaje;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #faf7f2 0%, #f3ece2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.25rem',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(44, 30, 22, 0.09)',
          border: '1px solid rgba(138, 90, 68, 0.16)',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            background: '#2c1e16',
            color: '#f8f5f0',
            padding: '2rem 2rem 1.75rem',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#d4af37',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}
          >
            Peluquería Carolina · Experiencia de Cliente
          </span>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 700,
              margin: '0 0 0.4rem',
              color: '#ffffff',
            }}
          >
            Encuesta de Satisfacción
          </h1>
          <p style={{ margin: 0, fontSize: '0.92rem', color: '#dfd5c8' }}>
            Tu opinión nos ayuda a perfeccionar cada detalle de nuestro salón.
          </p>
        </div>

        {/* Contenido */}
        <div style={{ padding: '2rem' }}>
          {!reservaIdParam && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: '#7f1d1d', fontWeight: 600, marginBottom: '1rem' }}>
                Enlace de encuesta incompleto. No se especificó el identificador de la reserva.
              </p>
              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  background: '#8a5a44',
                  color: '#fff',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Volver al inicio
              </Link>
            </div>
          )}

          {reservaIdParam && loading && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#5c4938' }}>
              Cargando los datos de tu atención...
            </div>
          )}

          {reservaIdParam && !loading && errorCarga && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '1.25rem' }}>
                {errorCarga}
              </p>
              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  background: '#8a5a44',
                  color: '#fff',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Ir a Peluquería Carolina
              </Link>
            </div>
          )}

          {reservaIdParam && !loading && !errorCarga && reserva && (
            <>
              {/* Resumen de la cita */}
              <div
                style={{
                  background: '#faf6f0',
                  border: '1px solid #eadfce',
                  borderLeft: '4px solid #8a5a44',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  fontSize: '0.92rem',
                  color: '#3b2a1e',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>
                    <strong>Cliente:</strong> {reserva.cliente_nombre}
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#8a5a44',
                      background: '#f0e6d8',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {reserva.codigo_reserva}
                  </span>
                </div>
                {reserva.servicio_nombre && (
                  <div style={{ marginBottom: '0.2rem' }}>
                    <strong>Servicio:</strong> {reserva.servicio_nombre}
                  </div>
                )}
                {reserva.estilista_nombre && (
                  <div style={{ marginBottom: '0.2rem' }}>
                    <strong>Profesional:</strong> {reserva.estilista_nombre}
                  </div>
                )}
                {reserva.fecha && (
                  <div>
                    <strong>Fecha:</strong> {reserva.fecha}{' '}
                    {reserva.hora_inicio ? `a las ${reserva.hora_inicio} hrs` : ''}
                  </div>
                )}
              </div>

              {enviadoExito ? (
                <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      color: '#15803d',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.75rem',
                      marginBottom: '1rem',
                    }}
                  >
                    ✓
                  </div>
                  <h2 style={{ margin: '0 0 0.5rem', color: '#2c1e16', fontSize: '1.35rem' }}>
                    ¡Muchas gracias por tu evaluación!
                  </h2>
                  <p style={{ color: '#5c4938', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    Hemos registrado tu calificación de <strong>{puntaje} de 5 estrellas</strong>.
                    ¡Esperamos verte pronto en Peluquería Carolina!
                  </p>
                  <Link
                    href="/"
                    style={{
                      display: 'inline-block',
                      background: '#8a5a44',
                      color: '#ffffff',
                      padding: '0.75rem 1.6rem',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Volver a Peluquería Carolina
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontWeight: 600,
                        color: '#2c1e16',
                        marginBottom: '0.75rem',
                        fontSize: '1rem',
                      }}
                    >
                      ¿Cómo calificarías tu experiencia con nosotros?
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setPuntaje(star)}
                          onMouseEnter={() => setHoverPuntaje(star)}
                          onMouseLeave={() => setHoverPuntaje(0)}
                          aria-label={`${star} estrellas`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '2.4rem',
                            lineHeight: 1,
                            color: star <= activeStars ? '#d4af37' : '#d6cfc7',
                            transition: 'transform 0.15s ease, color 0.15s ease',
                            transform: star <= activeStars ? 'scale(1.08)' : 'scale(1)',
                          }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#8a5a44',
                        minHeight: '1.4em',
                      }}
                    >
                      {RATING_LABELS[activeStars]} ({activeStars}/5)
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      htmlFor="comentario-encuesta"
                      style={{
                        display: 'block',
                        fontWeight: 600,
                        color: '#2c1e16',
                        marginBottom: '0.5rem',
                        fontSize: '0.92rem',
                      }}
                    >
                      Comentarios o sugerencias (opcional)
                    </label>
                    <textarea
                      id="comentario-encuesta"
                      rows={4}
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Cuéntanos qué fue lo que más te gustó o cómo podemos mejorar..."
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid #d6cbbd',
                        fontSize: '0.95rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {errorEnvio && (
                    <div
                      style={{
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.9rem',
                      }}
                    >
                      {errorEnvio}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={enviando}
                    style={{
                      width: '100%',
                      background: enviando ? '#b08d79' : '#8a5a44',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0.95rem 1.5rem',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: enviando ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {enviando ? 'Enviando evaluación...' : 'Enviar Encuesta de Satisfacción'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function EncuestaPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Cargando encuesta...
        </div>
      }
    >
      <EncuestaContent />
    </Suspense>
  );
}

