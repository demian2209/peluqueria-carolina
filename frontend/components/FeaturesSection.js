'use client';

export default function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="features-header">
        <h2 className="features-title">El Estándar Peluquería Carolina</h2>
        <p className="features-desc">
          Fusionamos la calidez humana con la precisión algorítmica para ofrecer una experiencia sin precedentes.
        </p>
      </div>
      <div className="features-grid">
        <div className="features-item">
          <div className="features-icon-container">
            <span className="material-symbols-outlined">schedule</span>
          </div>
          <h3 className="features-item-title">Disponibilidad 24/7</h3>
          <p className="features-item-desc">
            Reserve en cualquier momento a través de nuestra IA, sin llamadas ni tiempos de espera.
          </p>
        </div>
        <div className="features-item">
          <div className="features-icon-container">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <h3 className="features-item-title">Cuidado Personalizado</h3>
          <p className="features-item-desc">
            Nuestro sistema recuerda cada preferencia y detalle técnico de sus visitas anteriores.
          </p>
        </div>
        <div className="features-item">
          <div className="features-icon-container">
            <span className="material-symbols-outlined">notifications_active</span>
          </div>
          <h3 className="features-item-title">Alertas Inteligentes</h3>
          <p className="features-item-desc">
            Le avisamos cuando es el momento ideal para su próximo retoque basado en su estilo de vida.
          </p>
        </div>
      </div>
    </section>
  );
}
