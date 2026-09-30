'use client';

import { useState } from 'react';

const testimonials = [
  {
    quote: "La precisión con la que el asistente IA predijo el tono de mi cabello fue simplemente asombrosa. Es mucho más que un salón, es una experiencia tecnológica de lujo.",
    author: "Isabella Montclaire",
  },
  {
    quote: "El corte de autor superó todas mis expectativas. La atención personalizada y el nivel de detalle hacen que Peluquería Carolina sea mi espacio favorito.",
    author: "Valentina Sterling",
  },
  {
    quote: "El tratamiento de hidratación con IA revivió por completo mi textura capilar. Increíble servicio y ambiente ultra exclusivo.",
    author: "Camila De La Torre",
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
            <p className="author-name">{testimonials[index].author}</p>
            <div className="author-line"></div>
          </div>
        </div>
        <div className="testimonials-nav">
          <button className="btn-nav" onClick={prev} aria-label="Testimonio anterior">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button className="btn-nav" onClick={next} aria-label="Siguiente testimonio">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </section>
  );
}
