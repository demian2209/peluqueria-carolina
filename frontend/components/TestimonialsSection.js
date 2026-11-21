'use client';

import { useState } from 'react';

const testimonials = [
  {
    quote: "Fui por recomendación para hacerme un balayage y quedé feliz con el resultado. Carolina y su equipo son un amor, súper cercanos y profesionales. Se tomaron todo el tiempo de evaluar mi cabello antes de decolorar y me dieron los mejores tips para cuidarlo en casa.",
    author: "Constanza Morales",
    tag: "Balayage & Masaje Reparador",
  },
  {
    quote: "Llevo más de un año atendiéndome con ellos y no los cambio por nada. Son súper puntuales con las horas, el salón es impecable y te hacen sentir cómoda desde que entras. Da gusto encontrar gente que trabaje con tanta dedicación.",
    author: "Marcela Silva",
    tag: "Corte de Autor & Peinado",
  },
  {
    quote: "Me salvaron el cabello después de una mala experiencia en otro salón. Me hicieron un tratamiento de botox capilar y un corte que le devolvió la vida y el brillo a mis rulos. La cercanía y el cariño con el que te atienden marca toda la diferencia.",
    author: "Javiera Castro",
    tag: "Botox Capilar & Cuidado Integral",
  },
  {
    quote: "Excelente servicio para corte y barba. Matías es muy detallista en cada perfilado y el ambiente es muy grato. Además, poder agendar la hora rápido desde el celular sin tener que esperar confirmaciones largas se agradece un montón.",
    author: "Rodrigo Fuenzalida",
    tag: "Corte Caballero & Ritual de Barba",
  },
];

export default function TestimonialsSection() {
  const [index, setIndex] = useState(0);

  const prev = () => {
    setIndex((prevIndex) => (prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1));
  };

  const next = () => {
    setIndex((prevIndex) => (prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1));
  };

  return (
    <section className="testimonials-section" id="testimonios">
      <div className="testimonials-container">
        <div className="quote-bg">“</div>
        <div className="testimonials-content">
          <div className="stars-container">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
            ))}
          </div>
          <p className="testimonial-text">
            &quot;{testimonials[index].quote}&quot;
          </p>
          <div className="author-container">
            <div className="author-line"></div>
            <div>
              <p className="author-name">{testimonials[index].author}</p>
              {testimonials[index].tag && (
                <p className="author-service-tag">{testimonials[index].tag}</p>
              )}
            </div>
            <div className="author-line"></div>
          </div>
        </div>
        <div className="testimonials-nav">
          <button className="btn-nav" onClick={prev} aria-label="Testimonio anterior">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="testimonials-dots">
            {testimonials.map((_, i) => (
              <button
                key={i}
                className={`testimonial-dot ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Ver testimonio ${i + 1}`}
              />
            ))}
          </div>
          <button className="btn-nav" onClick={next} aria-label="Siguiente testimonio">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </section>
  );
}
