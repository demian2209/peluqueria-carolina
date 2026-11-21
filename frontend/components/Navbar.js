'use client';

import { useEffect, useState } from 'react';

const NAV_LINKS = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#estilistas', label: 'Estilistas' },
  { href: '#testimonios', label: 'Testimonios' },
  { href: '#faq', label: 'FAQ' },
];

export default function Navbar({ onOpenAI }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  // Cierra con Escape y bloquea el scroll del body mientras el menú móvil está abierto
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  // Si se pasa a desktop con el menú abierto, se cierra
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => {
      if (e.matches) setIsMenuOpen(false);
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } else if (mql.addListener) {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);

  return (
    <nav className="navbar" aria-label="Navegación principal">
      <div className="navbar-container">
        <a href="#" className="navbar-logo" onClick={closeMenu}>
          Peluqueria Carolina
        </a>

        <div className="navbar-menu">
          {NAV_LINKS.map((link) => (
            <a key={link.href} className="navbar-link" href={link.href}>
              {link.label}
            </a>
          ))}
        </div>

        <div className="navbar-actions">
          <button type="button" className="btn-text" onClick={onOpenAI}>
            Contacto
          </button>
          <a href="#reservar" className="btn-primary navbar-cta">
            Reservar<span className="navbar-cta-extra">&nbsp;ahora</span>
          </a>
          <button
            type="button"
            className="navbar-toggle"
            aria-label={isMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ pointerEvents: 'none' }}
            >
              {isMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div
          id="mobile-menu"
          className="navbar-mobile is-open"
          role="dialog"
          aria-modal="true"
        >
          <ul className="navbar-mobile-list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a className="navbar-mobile-link" href={link.href} onClick={closeMenu}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="navbar-mobile-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                closeMenu();
                onOpenAI?.();
              }}
            >
              Contacto
            </button>
            <a href="#reservar" className="btn-gradient" onClick={closeMenu}>
              Reservar ahora
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
