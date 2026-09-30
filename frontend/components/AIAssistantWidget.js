'use client';

import { useState } from 'react';

export default function AIAssistantWidget({ isOpen, setIsOpen }) {
  const [messages, setMessages] = useState([
    { text: "¡Hola! Soy tu asistente de Peluquería Carolina. ¿En qué te puedo asesorar hoy?", sender: "bot" }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { text: userMsg, sender: "user" }]);
    setInput('');

    // Simulated AI Response (to be wired to Gemini API backend in Phase 10)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          text: "Gracias por tu consulta. Puedo ayudarte a seleccionar el mejor tratamiento o agendar una cita directa.",
          sender: "bot",
        },
      ]);
    }, 1000);
  };

  return (
    <div className="ai-widget">
      {isOpen && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <div className="ai-avatar-row">
              <div className="ai-avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="ai-status-text">
                <p className="ai-name">Asistente IA Carolina</p>
                <p className="ai-status">En línea — Atelier AI</p>
              </div>
            </div>
            <button className="ai-close-btn" onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="ai-panel-body" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: m.sender === 'user' ? 'var(--secondary-container)' : 'var(--surface-container-high)',
                  color: m.sender === 'user' ? 'var(--on-secondary-container)' : 'var(--on-surface)',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.8125rem',
                  maxWidth: '85%',
                  lineHeight: '1.4',
                }}
              >
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} style={{ padding: '0.75rem 1.5rem 1.5rem 1.5rem', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Escribe tu mensaje..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '9999px',
                border: '1px solid var(--outline-variant)',
                fontSize: '0.8125rem',
                outline: 'none',
                backgroundColor: 'var(--surface-container-lowest)',
              }}
            />
            <button
              type="submit"
              className="btn-ai-chat"
              style={{ width: 'auto', padding: '0.5rem 1rem', borderRadius: '9999px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
            </button>
          </form>
        </div>
      )}

      {!isOpen && (
        <button className="ai-fab pulse" onClick={() => setIsOpen(true)} aria-label="Abrir asistente IA">
          <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>smart_toy</span>
        </button>
      )}
    </div>
  );
}
