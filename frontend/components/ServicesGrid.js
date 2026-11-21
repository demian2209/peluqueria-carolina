'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  getServiciosSeleccion,
  getServiciosSeleccionInicial,
  suscribirActualizacionCatalogo,
} from '../services/api';

function isOptimizableNextImage(src) {
  if (!src || typeof src !== 'string') return false;
  // Solo usar el optimizador /_next/image para las 10 imágenes estáticas precompiladas;
  // imágenes subidas en caliente o data URIs se sirven directo sin caché de optimización
  return /^\/images\/servicios\/servicio_(10|[1-9])\.webp$/.test(src);
}

function getBentoImageSizes(bentoSpan, isBentoMode) {
  if (!isBentoMode) {
    return '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw';
  }
  if (bentoSpan === 'col-span-8') {
    return '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 66vw';
  }
  if (bentoSpan === 'col-span-6') {
    return '(max-width: 767px) 100vw, 50vw';
  }
  return '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw';
}

// Configuración visual y orden editorial canónico para la cuadrícula Bento
const BENTO_CONFIG = [
  {
    key: 'balayage',
    match: (s) => /balayage/i.test(s.nombre),
    tag: 'Alta Coloración & Iluminación',
    bentoSpan: 'col-span-8',
    cardStyle: 'image-featured',
    icon: 'auto_awesome',
    image: '/images/servicios/servicio_1.webp'
  },
  {
    key: 'corte-mujer',
    match: (s) => /corte mujer/i.test(s.nombre),
    tag: 'Arquitectura Capilar',
    bentoSpan: 'col-span-4',
    cardStyle: 'image-square',
    icon: 'content_cut',
    image: '/images/servicios/servicio_2.webp'
  },
  {
    key: 'corte-caballero',
    match: (s) => /caballero|fade/i.test(s.nombre),
    tag: 'Barbería Clásica & Fade',
    bentoSpan: 'col-span-4',
    cardStyle: 'image-square',
    icon: 'face_6',
    image: '/images/servicios/servicio_3.webp'
  },
  {
    key: 'ritual-barba',
    match: (s) => /barba/i.test(s.nombre),
    tag: 'Ritual Tradicional & Vapor',
    bentoSpan: 'col-span-4',
    cardStyle: 'image-square',
    icon: 'spa',
    image: '/images/servicios/servicio_4.webp'
  },
  {
    key: 'coloracion-completa',
    match: (s) => /coloraci[oó]n|retoque/i.test(s.nombre),
    tag: 'Coloración Couture',
    bentoSpan: 'col-span-4',
    cardStyle: 'image-square',
    icon: 'palette',
    image: '/images/servicios/servicio_5.webp'
  },
  {
    key: 'botox-capilar',
    match: (s) => /botox/i.test(s.nombre),
    tag: 'Relleno Molecular Antifrizz',
    bentoSpan: 'col-span-4',
    cardStyle: 'image-square',
    icon: 'water_drop',
    image: '/images/servicios/servicio_6.webp'
  },
  {
    key: 'alisado-organico',
    match: (s) => /alisado/i.test(s.nombre),
    tag: 'Liso Progresivo Vegano',
    bentoSpan: 'col-span-4',
    cardStyle: 'image-square',
    icon: 'eco',
    image: '/images/servicios/servicio_7.webp'
  },
  {
    key: 'masaje-reparador',
    match: (s) => /k18|olaplex|reparador/i.test(s.nombre),
    tag: 'Tecnología Biomimética (K18)',
    bentoSpan: 'col-span-4',
    cardStyle: 'image-square',
    icon: 'health_and_safety',
    image: '/images/servicios/servicio_8.webp'
  },
  {
    key: 'peinado-social',
    match: (s) => /peinado|ondas/i.test(s.nombre),
    tag: 'Estilismo Editorial & Ondas',
    bentoSpan: 'col-span-6',
    cardStyle: 'image-square',
    icon: 'auto_awesome',
    image: '/images/servicios/servicio_9.webp'
  },
  {
    key: 'manicura-rusa',
    match: (s) => /manicura/i.test(s.nombre),
    tag: 'Cuidado & Nivelación Rusa',
    bentoSpan: 'col-span-6',
    cardStyle: 'image-square',
    icon: 'brush',
    image: '/images/servicios/servicio_10.webp'
  }
];

const CATEGORIES_DEF = [
  { id: 'all', label: 'Selección Signature' },
  { id: 'coloracion', label: 'Coloración & Balayage' },
  { id: 'corte-barberia', label: 'Cortes & Barbería' },
  { id: 'tratamiento', label: 'Tratamientos Spa' },
  { id: 'styling-manicura', label: 'Estilismo & Nails' },
];

function matchCategory(service, catId) {
  if (catId === 'all') return true;
  const cat = (service.categoria || '').toLowerCase();
  const name = (service.nombre || '').toLowerCase();

  switch (catId) {
    case 'coloracion':
      return cat === 'coloracion' || /color|balayage|mecha/i.test(name);
    case 'corte-barberia':
      return cat === 'corte' || cat === 'barberia' || /corte|barba|fade/i.test(name);
    case 'tratamiento':
      return cat === 'tratamiento' || /botox|alisado|k18|olaplex|reparador/i.test(name);
    case 'styling-manicura':
      return cat === 'styling' || cat === 'manicura' || /peinado|ondas|manicura|uñas/i.test(name);
    default:
      return true;
  }
}

export default function ServicesGrid() {
  const [servicios, setServicios] = useState(() => getServiciosSeleccionInicial());
  const [activeCategory, setActiveCategory] = useState('all');

  const loadServicios = useCallback(async () => {
    const data = await getServiciosSeleccion();
    if (Array.isArray(data)) {
      setServicios((prev) => {
        const prevSig = JSON.stringify(prev);
        const nextSig = JSON.stringify(data);
        return prevSig === nextSig ? prev : data;
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initLoad = async () => {
      if (active) await loadServicios();
    };
    initLoad();
    const unsubscribe = suscribirActualizacionCatalogo(() => {
      if (active) loadServicios();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadServicios]);

  const handleSelectService = (serviceId) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('seleccionarServicio', { detail: serviceId }));
      const element = document.getElementById('reservar');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const formatCLP = (precio) => {
    if (!precio && precio !== 0) return '';
    return `$${Number(precio).toLocaleString('es-CL')}`;
  };

  // Resuelve los atributos visuales priorizando los datos administrados en BD/Admin
  // y usando BENTO_CONFIG como respaldo editorial
  const resolveVisuals = useCallback((service, idx) => {
    const cfg = BENTO_CONFIG.find((c) => c.match(service));
    const isFeatured =
      service.destacado !== undefined && service.destacado !== null
        ? Boolean(service.destacado)
        : cfg
          ? cfg.cardStyle === 'image-featured'
          : idx === 0;

    const image = service.imagen_url || cfg?.image || '/images/servicios/servicio_1.webp';
    const tag =
      service.etiqueta ||
      cfg?.tag ||
      (service.categoria ? service.categoria.toUpperCase() : 'SERVICIO EXCLUSIVO');
    const icon = service.icono || cfg?.icon || 'auto_awesome';

    let bentoSpan = cfg?.bentoSpan || 'col-span-4';
    if (isFeatured) {
      bentoSpan = 'col-span-8';
    }

    const cardStyle = isFeatured ? 'image-featured' : image ? 'image-square' : cfg?.cardStyle || 'text';

    return {
      tag,
      bentoSpan,
      cardStyle,
      icon,
      image,
    };
  }, []);

  // Lista ordenada según `orden` de visualización definido en el panel de administración
  const serviciosOrdenados = useMemo(() => {
    return [...servicios]
      .filter((s) => s.activo !== false && s.en_seleccion !== false)
      .sort((a, b) => {
        const idxA = BENTO_CONFIG.findIndex((c) => c.match(a));
        const idxB = BENTO_CONFIG.findIndex((c) => c.match(b));
        const ordA =
          a.orden !== undefined && a.orden !== null && Number(a.orden) > 0
            ? Number(a.orden)
            : idxA !== -1
              ? idxA + 1
              : 99;
        const ordB =
          b.orden !== undefined && b.orden !== null && Number(b.orden) > 0
            ? Number(b.orden)
            : idxB !== -1
              ? idxB + 1
              : 99;
        if (ordA !== ordB) return ordA - ordB;
        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
      });
  }, [servicios]);

  // Conteo de servicios por categoría
  const categoryCounts = useMemo(() => {
    const counts = { all: serviciosOrdenados.length };
    CATEGORIES_DEF.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = serviciosOrdenados.filter((s) => matchCategory(s, cat.id)).length;
      }
    });
    return counts;
  }, [serviciosOrdenados]);

  // Lista de tarjetas a mostrar según el orden de administración (en 'all') o filtrado por categoría
  const displayedCards = useMemo(() => {
    const baseList =
      activeCategory === 'all'
        ? serviciosOrdenados
        : serviciosOrdenados.filter((s) => matchCategory(s, activeCategory));

    return baseList.map((s, idx) => ({
      service: s,
      visuals: resolveVisuals(s, idx),
    }));
  }, [serviciosOrdenados, activeCategory, resolveVisuals]);

  const isBentoMode = activeCategory === 'all';

  return (
    <section className="services-section" id="servicios">
      <div className="container-max">
        {/* Cabecera Editorial */}
        <div className="services-header">
          <div className="services-header-text">
            <span className="services-eyebrow">Catálogo de Autor</span>
            <h2 className="services-title">Nuestra Selección</h2>
            <p className="services-desc">
              Rituales capilares y de barbería diseñados con precisión y ejecutados por estilistas máster con tecnología capilar de vanguardia.
            </p>
          </div>
          <a href="#reservar" className="services-more">
            Reservar servicio <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_downward</span>
          </a>
        </div>

        {/* Pestañas de Filtros por Categoría */}
        <div className="services-filters" role="tablist" aria-label="Categorías de servicios">
          {CATEGORIES_DEF.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`services-filter-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.label}</span>
                {count > 0 && <span className="filter-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Cuadrícula de Servicios */}
        <div className={`services-grid ${isBentoMode ? 'services-bento' : 'services-filtered-grid'}`}>
          {displayedCards.map(({ service, visuals }, idx) => {
            const nombre = service.nombre || 'Servicio Exclusivo';
            const descripcion = service.descripcion || 'Tratamiento de alta gama para el cuidado integral.';
            const duracion = service.duracion_min || 45;
            const precioFormatted = formatCLP(service.precio);
            const serviceId = service.id || `svc-${idx}`;
            const colSpanClass = isBentoMode ? visuals.bentoSpan : '';

            const imgSizes = getBentoImageSizes(visuals.bentoSpan, isBentoMode);
            const useNextImage = isOptimizableNextImage(visuals.image);

            // 1. Tarjeta Destacada con Imagen Hero (Balayage)
            if (visuals.cardStyle === 'image-featured') {
              return (
                <div key={serviceId} className={`services-card image-featured ${colSpanClass}`}>
                  <div className="card-img-container">
                    <Image
                      className="card-img"
                      alt={nombre}
                      src={visuals.image}
                      fill
                      sizes={imgSizes}
                      quality={75}
                      priority={idx === 0}
                      unoptimized={!useNextImage}
                    />
                  </div>
                  <div className="card-gradient-overlay"></div>
                  <div className="card-content-overlay">
                    <div className="card-header-line" style={{ marginBottom: '0.4rem' }}>
                      <span className="card-tag">{visuals.tag}</span>
                      {visuals.icon && (
                        <span className="material-symbols-outlined" style={{ fontSize: '1.35rem', color: '#fed488', opacity: 0.9 }}>
                          {visuals.icon}
                        </span>
                      )}
                    </div>
                    <h3 className="card-title-3xl">{nombre}</h3>
                    <p className="card-desc-white">{descripcion}</p>
                    <div className="card-action-bar">
                      <div className="card-meta-pill light-pill">
                        <span className="material-symbols-outlined">schedule</span>
                        <span>{duracion} MIN</span>
                        <span className="meta-sep">•</span>
                        <span className="meta-price">{precioFormatted}</span>
                      </div>
                      <button
                        type="button"
                        className="card-action-btn on-dark"
                        onClick={() => handleSelectService(serviceId)}
                        aria-label={`Reservar ${nombre}`}
                      >
                        Reservar <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // 2. Tarjeta con Imagen (Botox Capilar, Cortes, Barbería, etc.)
            if (visuals.cardStyle === 'image-square' || visuals.image) {
              return (
                <div key={serviceId} className={`services-card image-square ${colSpanClass}`}>
                  <div className="card-img-container">
                    <Image
                      className="card-img"
                      alt={nombre}
                      src={visuals.image}
                      fill
                      sizes={imgSizes}
                      quality={75}
                      loading={idx <= 1 ? 'eager' : 'lazy'}
                      unoptimized={!useNextImage}
                    />
                  </div>
                  <div className="card-gradient-overlay"></div>
                  <div className="card-content-overlay">
                    <div className="card-header-line" style={{ marginBottom: '0.35rem' }}>
                      <span className="card-tag">{visuals.tag}</span>
                      {visuals.icon && (
                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: '#fed488', opacity: 0.85 }}>
                          {visuals.icon}
                        </span>
                      )}
                    </div>
                    <h3 className="card-title-2xl">{nombre}</h3>
                    <p className="card-desc-white" style={{ fontSize: '0.85rem' }}>{descripcion}</p>
                    <div className="card-action-bar">
                      <div className="card-meta-pill light-pill">
                        <span className="material-symbols-outlined">schedule</span>
                        <span>{duracion} MIN</span>
                        <span className="meta-sep">•</span>
                        <span className="meta-price">{precioFormatted}</span>
                      </div>
                      <button
                        type="button"
                        className="card-action-btn on-dark"
                        onClick={() => handleSelectService(serviceId)}
                        aria-label={`Reservar ${nombre}`}
                      >
                        Reservar <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // 3. Tarjeta Champagne Gradient (Coloración Couture / Peinado)
            if (visuals.cardStyle === 'gold') {
              return (
                <div key={serviceId} className={`services-card gold-card ${colSpanClass}`}>
                  <div className="card-top-content">
                    <div className="card-header-line">
                      <span className="card-tag">{visuals.tag}</span>
                      <span className="material-symbols-outlined card-header-icon">{visuals.icon}</span>
                    </div>
                    <h3 className="card-title-2xl">{nombre}</h3>
                    <p className="card-desc">{descripcion}</p>
                  </div>
                  <div className="card-action-bar">
                    <div className="card-meta-pill gold-pill">
                      <span className="material-symbols-outlined">schedule</span>
                      <span>{duracion} MIN</span>
                      <span className="meta-sep">•</span>
                      <span className="meta-price">{precioFormatted}</span>
                    </div>
                    <button
                      type="button"
                      className="card-action-btn gold-btn"
                      onClick={() => handleSelectService(serviceId)}
                      aria-label={`Reservar ${nombre}`}
                    >
                      Reservar <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            }

            // 4. Tarjeta Centrada (Corte Caballero, K18)
            if (visuals.cardStyle === 'center') {
              return (
                <div key={serviceId} className={`services-card center-card ${colSpanClass}`}>
                  <div className="card-top-content center-align">
                    <span className="material-symbols-outlined card-icon-lg">{visuals.icon}</span>
                    <span className="card-tag">{visuals.tag}</span>
                    <h3 className="card-title-2xl">{nombre}</h3>
                    <p className="card-desc">{descripcion}</p>
                  </div>
                  <div className="card-action-bar">
                    <div className="card-meta-pill">
                      <span className="material-symbols-outlined">schedule</span>
                      <span>{duracion} MIN</span>
                      <span className="meta-sep">•</span>
                      <span className="meta-price">{precioFormatted}</span>
                    </div>
                    <button
                      type="button"
                      className="card-action-btn"
                      onClick={() => handleSelectService(serviceId)}
                      aria-label={`Reservar ${nombre}`}
                    >
                      Reservar <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            }

            // 5. Tarjeta Minimalista de Texto (Corte Mujer, Ritual Barba, Alisado, Manicura)
            return (
              <div key={serviceId} className={`services-card text-card ${colSpanClass}`}>
                <div className="card-top-content">
                  <div className="card-header-line">
                    <span className="card-tag">{visuals.tag}</span>
                    <span className="material-symbols-outlined card-header-icon">{visuals.icon}</span>
                  </div>
                  <h3 className="card-title-2xl">{nombre}</h3>
                  <p className="card-desc">{descripcion}</p>
                </div>
                <div className="card-action-bar">
                  <div className="card-meta-pill">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>{duracion} MIN</span>
                    <span className="meta-sep">•</span>
                    <span className="meta-price">{precioFormatted}</span>
                  </div>
                  <button
                    type="button"
                    className="card-action-btn"
                    onClick={() => handleSelectService(serviceId)}
                    aria-label={`Reservar ${nombre}`}
                  >
                    Reservar <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
