'use client';

import { useState, useEffect } from 'react';
import { getServicios } from '../services/api';

export default function ServicesGrid() {
  const [servicios, setServicios] = useState([]);

  useEffect(() => {
    async function loadServicios() {
      const data = await getServicios();
      setServicios(data);
    }
    loadServicios();
  }, []);

  return (
    <section className="services-section" id="servicios">
      <div className="container-max">
        <div className="services-header">
          <div className="services-header-text">
            <h2 className="services-title">Nuestra Selección</h2>
            <p className="services-desc">
              Servicios de autor diseñados con precisión digital y ejecutados por manos artesanas.
            </p>
          </div>
          <a href="#reservar" className="services-more">Reservar servicio</a>
        </div>
        <div className="services-grid">
          {/* Coloring (Featured) */}
          <div className="services-card col-span-8 aspect-16-9">
            <div className="card-img-container">
              <img
                className="card-img"
                alt="Coloración Couture"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTw4mrGEWMI8LDMr6EcNP9wwwZQ6FQsOhmnEudfB2mTocosu0mKvAlYDTR3nzsXz3q3xzMQhxL0Q6pRbo3tUZREjoqmJ7MbwFGIkYnVH7z91spFdesAzldd9qI2w0hX7SL3EaWE8PUciEHL-5QgEgAbKjsdlsXG4x_eqvP3bvBKrOHYL1lXlcfeYIPk6D9ItPxXriX3RICMquYzGsb254mu7VmtmrNZPP3epXQLKX7ZHyNd0ql6mPj7ZBtOy0jn-M1ZL9IV9szWnBE"
              />
            </div>
            <div className="card-gradient-overlay"></div>
            <div className="card-content-overlay">
              <span className="card-tag">Tratamiento Premium</span>
              <h3 className="card-title-3xl">{servicios[0]?.nombre || 'Coloración Couture'}</h3>
              <p className="card-desc-white">
                {servicios[0]?.descripcion || 'Pigmentación inteligente adaptada a su tono de piel mediante análisis IA.'}
              </p>
              <span className="card-meta">{servicios[0]?.duracion_min || 120} MIN — DESDE ${servicios[0]?.precio || 120}</span>
            </div>
          </div>

          {/* Haircut */}
          <div className="services-card col-span-4 text-card">
            <div>
              <span className="material-symbols-outlined card-icon">content_cut</span>
              <h3 className="card-title-2xl">{servicios[1]?.nombre || 'Corte de Autor'}</h3>
              <p className="card-desc">
                {servicios[1]?.descripcion || 'Arquitectura capilar basada en la morfología de su rostro.'}
              </p>
            </div>
            <div className="card-price-info">
              <span>{servicios[1]?.duracion_min || 45} MIN — ${servicios[1]?.precio || 45}</span>
            </div>
          </div>

          {/* Treatment */}
          <div className="services-card col-span-4 aspect-square">
            <div className="card-img-container">
              <img
                className="card-img"
                alt="Hidratación IA"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrigVRasFv4GmBkCbp2CVJS9wb0fIbqeQ3m7W_aq1TOzTUKwzPJfqJQZAd4HKUT5eVdRbTSyCiyz0rgqh3NsrDUNRK_YwbmMmHM-_eYpoOpKOkB5w-_wGkl0Ck8lSPjWroO_M-yWeBu23Z6ofJMOcNAwI7V5YXFoVQvV85k_MtKzF-Opwu2FzqvZly3ARNvkzH0n_VriAvnOkWSJKWoJsWvFwp7o2zS62WtOuDEWN76YFb1q7kNgCuwsda-r4lEHH6cjb_MOxe_dzx"
              />
            </div>
            <div className="card-overlay-tint"></div>
            <div className="card-content-overlay full-flex-end">
              <h3 className="card-title-2xl">{servicios[2]?.nombre || 'Hidratación IA'}</h3>
              <p className="card-meta">{servicios[2]?.duracion_min || 60} MIN — ${servicios[2]?.precio || 85}</p>
            </div>
          </div>

          {/* Barbering */}
          <div className="services-card col-span-4 center-card">
            <span className="material-symbols-outlined card-icon-lg">face_6</span>
            <h3 className="card-title-2xl">{servicios[3]?.nombre || 'Barbería Elite'}</h3>
            <p className="card-desc">
              {servicios[3]?.descripcion || 'Rituales de afeitado tradicional con tecnología de vaporización.'}
            </p>
            <span className="card-badge-pill">{servicios[3]?.duracion_min || 30} MIN — ${servicios[3]?.precio || 35}</span>
          </div>

          {/* Styling */}
          <div className="services-card col-span-4 gold-card">
            <div className="card-icon-top-right">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <h3 className="card-title-2xl">{servicios[4]?.nombre || 'Peinado & Styling'}</h3>
              <p className="card-desc-white-bold">
                {servicios[4]?.descripcion || 'Looks editoriales para eventos de alto impacto.'}
              </p>
            </div>
            <div className="card-price-label-spacing">A PARTIR DE ${servicios[4]?.precio || 60}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
