'use client';

import { useState } from 'react';

const faqs = [
  {
    id: 1,
    question: "¿Cómo funciona el análisis de IA?",
    answer: "Nuestra IA analiza su estructura facial y tono de piel a través de una breve interacción visual para recomendar estilos que maximicen su potencial estético.",
  },
  {
    id: 2,
    question: "¿Puedo cancelar o cambiar mi cita?",
    answer: "Absolutamente. Puede gestionar su reserva 24/7 a través de nuestro Asistente Virtual o WhatsApp con solo un par de clics hasta 12 horas antes.",
  },
  {
    id: 3,
    question: "¿Los precios varían según el estilista?",
    answer: "Nuestra estructura de precios es transparente y se basa en la categoría del profesional elegido (Artisan o Master).",
  },
];

export default function FAQSection() {
  const [activeId, setActiveId] = useState(2);

  const toggleFaq = (id) => {
    setActiveId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="faq-section" id="faq">
      <div className="faq-container">
        <h2 className="faq-title">Preguntas Frecuentes</h2>
        <div className="faq-list">
          {faqs.map((faq) => {
            const isActive = activeId === faq.id;
            return (
              <div key={faq.id} className={`faq-item ${isActive ? 'active' : ''}`}>
                <button className="faq-trigger" onClick={() => toggleFaq(faq.id)}>
                  <span className="faq-question">{faq.question}</span>
                  <span className="material-symbols-outlined faq-icon">
                    {isActive ? 'remove' : 'add'}
                  </span>
                </button>
                {isActive && <div className="faq-answer">{faq.answer}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
