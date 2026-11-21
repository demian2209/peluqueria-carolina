'use client';

import Image from 'next/image';

export default function HeroSection({ onOpenAI }) {
  return (
    <section className="hero-section">
      <div className="hero-bg">
        <Image
          src="/images/img-hero.webp"
          alt="Peluquería Carolina - Salón exclusivo de alta peluquería"
          fill
          priority
          sizes="100vw"
          quality={90}
          className="hero-img"
        />
        <div className="hero-overlay"></div>
      </div>
      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="material-symbols-outlined hero-badge-icon" aria-hidden="true">
              auto_awesome
            </span>
            <span>ALTA PELUQUERÍA &amp; CUIDADO DE AUTOR</span>
          </div>
          <h1 className="hero-title">
            El Arte del Estilismo, <br />
            <span>Diseñado para Ti</span>
          </h1>
          <p className="hero-subtitle">
            Te damos la bienvenida a un espacio donde la maestría de nuestros estilistas y la atención
            personalizada resaltan la belleza natural de tu cabello. Reserva tu cita en segundos y
            disfruta una experiencia pensada en tu bienestar.
          </p>
          <div className="hero-buttons">
            <a href="#reservar" className="btn-gradient">
              Reservar cita
            </a>
            <button
              className="btn-secondary hero-btn-assistant"
              onClick={onOpenAI}
              aria-haspopup="dialog"
              aria-label="Abrir asistente de belleza virtual"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                chat_bubble
              </span>
              <span>Asistente de Belleza</span>
            </button>
          </div>
          <div className="hero-features-hint">
            <span className="hero-hint-item">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              Atención 100% personalizada
            </span>
            <span className="hero-hint-item">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              Confirmación inmediata por WhatsApp
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
