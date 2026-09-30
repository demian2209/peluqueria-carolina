'use client';

export default function Navbar({ onOpenAI }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">Peluqueria Carolina</div>
        <div className="navbar-menu">
          <a className="navbar-link" href="#servicios">Servicios</a>
          <a className="navbar-link" href="#estilistas">Estilistas</a>
          <a className="navbar-link" href="#testimonios">Testimonios</a>
          <a className="navbar-link" href="#faq">FAQ</a>
        </div>
        <div className="navbar-actions">
          <button className="btn-text" onClick={onOpenAI}>Contacto</button>
          <a href="#reservar">
            <button className="btn-primary">Reservar ahora</button>
          </a>
        </div>
      </div>
    </nav>
  );
}
