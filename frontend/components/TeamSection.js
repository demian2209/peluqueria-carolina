'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { getEstilistas, suscribirActualizacionEquipo } from '../services/api';

// Mapeo canónico entre estilistas y sus fotografías en /public/images/maestros_tijera/
const STYLIST_PHOTOS = {
  'carolina valenzuela': '/images/maestros_tijera/carolina_valenzuela.webp',
  'matias munoz': '/images/maestros_tijera/matias_munoz.webp',
  'camila soto': '/images/maestros_tijera/camila_soto.webp',
  'gonzalo riquelme': '/images/maestros_tijera/gonzalo_riquelme.webp',
  'valentina morales': '/images/maestros_tijera/valentina_morales.webp',
};

function getStylistPhoto(member, index) {
  if (member?.foto_url && !member.foto_url.includes('googleusercontent')) {
    return member.foto_url;
  }

  const fullName = `${member?.nombre || ''} ${member?.apellido || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  for (const [key, path] of Object.entries(STYLIST_PHOTOS)) {
    if (fullName.includes(key) || key.includes(fullName)) {
      return path;
    }
  }

  const fallbackList = Object.values(STYLIST_PHOTOS);
  return fallbackList[index % fallbackList.length];
}

function getDesktopColumns(count) {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 4;
  if (count === 5) return 5;
  if (count === 6) return 3;
  return 4;
}

export default function TeamSection() {
  const [estilistas, setEstilistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchEstilistas = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(false);
    }
    try {
      const data = await getEstilistas();
      if (Array.isArray(data)) {
        const visibles = data
          .filter((e) => e && e.activo !== false)
          .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99));
        setEstilistas(visibles);
      } else {
        setEstilistas([]);
      }
      setError(false);
    } catch (err) {
      console.error('Error cargando estilistas:', err);
      if (!silent) setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      try {
        const data = await getEstilistas();
        if (!active) return;
        if (Array.isArray(data)) {
          const visibles = data
            .filter((e) => e && e.activo !== false)
            .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99));
          setEstilistas(visibles);
        } else {
          setEstilistas([]);
        }
        setError(false);
      } catch (err) {
        console.error('Error cargando estilistas:', err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    initLoad();
    const unsubscribe = suscribirActualizacionEquipo(() => {
      fetchEstilistas(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [fetchEstilistas]);

  const handleSelectStylist = (member) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('seleccionarEstilista', {
          detail: member.id,
        })
      );
      const bookingEl = document.getElementById('reservar');
      if (bookingEl) {
        bookingEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const totalCount = estilistas.length;
  const desktopCols = getDesktopColumns(totalCount);
  const isStaggeredLayout = totalCount >= 4 && totalCount <= 5;
  const gridLayoutClass = isStaggeredLayout ? 'team-grid--staggered' : 'team-grid--balanced';

  return (
    <section className="team-section" id="estilistas">
      <div className="team-container">
        <div className="team-header">
          <div className="team-badge">
            <span className="material-symbols-outlined" aria-hidden="true">content_cut</span>
            <span>MAESTRÍA &amp; DEDICACIÓN</span>
          </div>
          <h2 className="team-title">Maestros de la Tijera &amp; Color</h2>
          <p className="team-subtitle">
            Detrás de cada transformación hay escucha atenta, técnica impecable y una sincera vocación por cuidar la salud de tu cabello. Conoce al equipo dedicado a realzar tu estilo personal.
          </p>
        </div>

        {loading ? (
          <div className="team-grid team-grid--staggered" style={{ '--team-cols': 5 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`team-member-skeleton ${i % 2 !== 0 ? 'offset-y' : ''}`}>
                <div className="skeleton-img-box"></div>
                <div className="skeleton-line-title"></div>
                <div className="skeleton-line-subtitle"></div>
              </div>
            ))}
          </div>
        ) : error && estilistas.length === 0 ? (
          <div className="team-error-state">
            <p>No fue posible cargar el equipo en este momento.</p>
            <button className="btn-secondary" onClick={() => fetchEstilistas(false)}>
              Reintentar
            </button>
          </div>
        ) : estilistas.length === 0 ? (
          <div className="team-error-state">
            <p>Nuestro equipo estará disponible muy pronto para reservas.</p>
          </div>
        ) : (
          <div
            className={`team-grid ${gridLayoutClass}`}
            style={{ '--team-cols': desktopCols }}
            data-team-count={totalCount}
          >
            {estilistas.map((member, index) => {
              const isOffset = isStaggeredLayout && index % 2 !== 0;
              const photo = getStylistPhoto(member, index);
              const useNextImage = typeof photo === 'string' && photo.startsWith('/images/');
              const name = member.apellido
                ? member.nombre.toLowerCase().includes(member.apellido.toLowerCase())
                  ? member.nombre
                  : `${member.nombre} ${member.apellido}`
                : member.nombre;
              const firstName = (member.nombre || 'el estilista').split(' ')[0];

              return (
                <div key={member.id || index} className={`team-member ${isOffset ? 'offset-y' : ''}`}>
                  <div className="member-img-wrapper">
                    <Image
                      className="member-img"
                      alt={`Retrato de ${name}`}
                      src={photo}
                      width={400}
                      height={533}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      unoptimized={!useNextImage}
                    />
                    <div className="member-img-overlay">
                      <button
                        type="button"
                        className="member-book-btn"
                        onClick={() => handleSelectStylist(member)}
                        aria-label={`Reservar con ${firstName}`}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
                        <span>Agendar con {firstName}</span>
                      </button>
                    </div>
                  </div>
                  <h3 className="member-name">{name}</h3>
                  {member.especialidad && <p className="member-role">{member.especialidad}</p>}
                  {member.bio && <p className="member-bio-short">{member.bio}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
