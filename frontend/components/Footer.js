'use client';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-col">
          <div className="footer-brand">Peluqueria Carolina</div>
          <p className="footer-brand-text">
            Luxury Hair &amp; Computational Intelligence.<br />
            Innovación al servicio de su estilo.
          </p>
        </div>
        <div className="footer-col">
          <h4 className="footer-col-title">Explorar</h4>
          <ul className="footer-links">
            <li><a href="#">Inicio</a></li>
            <li><a href="#servicios">Servicios</a></li>
            <li><a href="#estilistas">Estilistas</a></li>
            <li><a href="#reservar">Reservas</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4 className="footer-col-title">Legal</h4>
          <ul className="footer-links">
            <li><a href="#">Privacidad</a></li>
            <li><a href="#">Términos</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4 className="footer-col-title">Newsletter</h4>
          <div className="footer-newsletter">
            <input className="newsletter-input" placeholder="SU EMAIL" type="email" />
            <button className="newsletter-btn" type="button" aria-label="Suscribirse">
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p className="footer-copyright">© 2026 Peluqueria Carolina</p>
      </div>
    </footer>
  );
}
