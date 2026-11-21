'use client';

import { useState } from 'react';

const faqs = [
  {
    id: 1,
    question: "¿Cómo sé qué servicio o color es el más adecuado para mi cabello?",
    answer: "Al llegar a tu cita, tu estilista realizará una conversación de visagismo y diagnóstico capilar para evaluar la salud de tu fibra, tu tono de piel y tu estilo de vida. Además, si lo deseas, puedes consultar previamente con nuestro Asistente de Belleza online para inspirarte y recibir recomendaciones personalizadas antes de tu visita.",
  },
  {
    id: 2,
    question: "¿Puedo cancelar o reprogramar mi cita si tengo un imprevisto?",
    answer: "¡Por supuesto! Comprendemos que tus planes pueden cambiar. Puedes reprogramar o cancelar tu reserva con hasta 12 horas de anticipación directamente desde el mensaje de confirmación en WhatsApp o en nuestra web, con total comodidad y sin recargo alguno.",
  },
  {
    id: 3,
    question: "¿Cuánto tiempo dura una sesión de corte, coloración o alisado?",
    answer: "Nos tomamos el tiempo necesario para cada detalle sin prisas. Un corte de autor toma alrededor de 50 minutos, mientras que rituales profundos como balayage o alisados orgánicos toman entre 2 y 3 horas. Te invitamos a disfrutar de un café de especialidad y una experiencia de relajación total.",
  },
  {
    id: 4,
    question: "¿Los precios varían según el estilista que elija?",
    answer: "Nuestra política es de absoluta transparencia: siempre verás el precio final y sin sorpresas antes de confirmar tu reserva. Las tarifas varían sutilmente según la trayectoria y especialidad del profesional elegido (Artisan o Master), manteniendo siempre el mismo estándar de excelencia.",
  },
  {
    id: 5,
    question: "¿Cómo debo preparar mi cabello antes de mi sesión de color?",
    answer: "Para servicios de coloración o balayage, recomendamos no lavar el cabello el mismo día de la cita; los aceites naturales forman una película protectora ideal para el cuero cabelludo. Para cortes y peinados sociales, nosotros nos encargamos de todo con lavado spa previo.",
  },
  {
    id: 6,
    question: "¿Qué medios de pago aceptan en el salón?",
    answer: "Aceptamos todas las tarjetas de crédito y débito (con opciones de pago en cuotas según tu banco), transferencias electrónicas y efectivo. El pago se efectúa tranquilamente en el salón al finalizar tu servicio.",
  },
];

export default function FAQSection({ onOpenAI }) {
  const [activeId, setActiveId] = useState(1);

  const toggleFaq = (id) => {
    setActiveId((prev) => (prev === id ? null : id));
  };

  const handleOpenChatbot = () => {
    if (onOpenAI) {
      onOpenAI();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abrirChatbotIA'));
    }
  };

  // Schema.org FAQPage para Google Rich Snippets (SEO)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <section className="faq-section" id="faq">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="faq-container">
        <div className="faq-header">
          <div className="faq-badge">
            <span className="material-symbols-outlined" aria-hidden="true">help</span>
            <span>TRANSPARENCIA &amp; CONFIANZA</span>
          </div>
          <h2 className="faq-title">Preguntas Frecuentes</h2>
          <p className="faq-subtitle">
            Queremos que te sientas en confianza y bien acompañada desde el primer clic. Aquí resolvemos las dudas más habituales de nuestras clientas.
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((faq) => {
            const isActive = activeId === faq.id;
            const triggerId = `faq-trigger-${faq.id}`;
            const panelId = `faq-panel-${faq.id}`;

            return (
              <div key={faq.id} className={`faq-item ${isActive ? 'active' : ''}`}>
                <button
                  id={triggerId}
                  className="faq-trigger"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isActive}
                  aria-controls={panelId}
                >
                  <span className="faq-question">{faq.question}</span>
                  <span className="material-symbols-outlined faq-icon" aria-hidden="true">
                    {isActive ? 'remove' : 'add'}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className={`faq-answer-wrapper ${isActive ? 'open' : ''}`}
                >
                  <div className="faq-answer-content">
                    <p className="faq-answer">{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="faq-contact-card">
          <div className="faq-contact-icon">
            <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
          </div>
          <div className="faq-contact-info">
            <h4 className="faq-contact-title">¿Tienes una consulta específica para tu cabello?</h4>
            <p className="faq-contact-text">
              Estamos para asesorarte. Chatea con nuestro asistente para resolver cualquier inquietud antes de agendar.
            </p>
          </div>
          <button
            type="button"
            className="faq-contact-btn"
            onClick={handleOpenChatbot}
            aria-label="Hablar con IA y abrir asistente"
          >
            <span className="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
            <span>Hablar con IA</span>
          </button>
        </div>
      </div>
    </section>
  );
}
