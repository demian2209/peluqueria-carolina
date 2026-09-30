'use client';

export default function HeroSection({ onOpenAI }) {
  return (
    <section className="hero-section">
      <div className="hero-bg">
        <img
          alt="Modern Salon Interior"
          className="hero-img"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKpmGu15XfL_MnnSM4_Cef1EhhAem5tlTOcOoErrgfkl2Twr96kfsns1_e_htv4H677kPx8mMZvwWGOYSV4_k9_1oxxr1NzW4XSfrXU0BxWsJGR6VMxD21nnW2ksN2GIZyo8qLVKQbUBeNOa8WY2ixGtNacifqtz56xR6E1RqZ0JVKeWmROqwcwo-JmjaRZZtq5l03DEeNhM4-I9pfJLjoHQdbLJU4FG3YQXbhmXhXGp_wFF73m_QVlRV3vX9Ii4heWMmYDI89rhiN"
        />
        <div className="hero-overlay"></div>
      </div>
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            El Futuro de la <br />
            <span>Belleza, Hoy</span>
          </h1>
          <p className="hero-subtitle">
            Experimente la perfección capilar impulsada por inteligencia artificial. Reservas instantáneas y
            estilismo personalizado en el atelier más exclusivo.
          </p>
          <div className="hero-buttons">
            <a href="#reservar" className="btn-gradient">
              Reservar cita
            </a>
            <button className="btn-secondary" onClick={onOpenAI}>
              Hablar con el asistente
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
