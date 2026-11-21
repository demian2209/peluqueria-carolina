'use client';

import { useState, useRef, useEffect } from 'react';
import { enviarConsultaAsistente } from '../services/api';

/**
 * Renderizador ligero para formatear texto con negrita (**texto**) y saltos de línea
 */
function FormattedMessage({ content }) {
  if (!content) return null;

  // Divide por saltos de línea
  const lines = content.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {lines.map((line, lIdx) => {
        if (!line.trim()) return <div key={lIdx} style={{ height: '0.25rem' }} />;

        // Detecta partes en negrita con **palabra**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);

        return (
          <p key={lIdx} style={{ margin: 0, lineHeight: '1.45' }}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} style={{ fontWeight: 600, color: 'inherit' }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function AIAssistantWidget({ isOpen, setIsOpen }) {
  const [messages, setMessages] = useState([
    {
      text: "¡Hola! Soy tu asistente de Peluquería Carolina. Puedo informarte sobre nuestros servicios, tarifas, estilistas o resolver cualquier duda antes de agendar. ¿En qué te asesoro hoy?",
      sender: "bot",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll al recibir o enviar mensajes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Escuchar evento global para abrir el asistente
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('abrirChatbotIA', handleOpen);
    return () => window.removeEventListener('abrirChatbotIA', handleOpen);
  }, [setIsOpen]);

  // Enfocar input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendMessage = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    // Agregar mensaje del usuario a la conversación
    setMessages((prev) => [...prev, { text: query, sender: 'user' }]);
    setInput('');
    setIsLoading(true);

    try {
      // Llamada real al backend (con rate limiting e intermediación a n8n / Gemini)
      const botResponse = await enviarConsultaAsistente(query);

      setMessages((prev) => [
        ...prev,
        {
          text: botResponse,
          sender: 'bot',
        },
      ]);
    } catch (err) {
      console.error('Error en consulta al asistente:', err);
      setMessages((prev) => [
        ...prev,
        {
          text: 'Disculpa, ocurrió un inconveniente de conexión con nuestro asistente. Si deseas, puedes consultar directamente vía WhatsApp o revisar el catálogo en la sección de reservas.',
          sender: 'bot',
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const quickChips = [
    '¿Qué servicios ofrecen?',
    '¿Quién realiza Balayage?',
    '¿Cuáles son los horarios?',
  ];

  return (
    <div className="ai-widget" style={{ zIndex: 9999 }}>
      {isOpen && (
        <div
          className="ai-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
          }}
        >
          {/* Header */}
          <div className="ai-panel-header">
            <div className="ai-avatar-row">
              <div className="ai-avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="ai-status-text">
                <p className="ai-name">Asistente IA Carolina</p>
                <p className="ai-status">
                  {isLoading ? 'Pensando respuesta...' : 'En línea — Peluquería Carolina'}
                </p>
              </div>
            </div>
            <button
              className="ai-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar asistente"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Quick chips (solo si hay pocos mensajes) */}
          {messages.length <= 2 && (
            <div
              style={{
                display: 'flex',
                gap: '0.375rem',
                padding: '0.5rem 1rem 0 1rem',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(chip)}
                  disabled={isLoading}
                  style={{
                    background: 'var(--surface-container-high)',
                    color: 'var(--on-surface-variant)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: '9999px',
                    padding: '0.25rem 0.625rem',
                    fontSize: '0.6875rem',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Body de mensajes */}
          <div
            className="ai-panel-body"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor:
                    m.sender === 'user'
                      ? 'var(--secondary)'
                      : m.isError
                        ? 'rgba(186, 26, 26, 0.1)'
                        : 'var(--surface-container-high)',
                  color:
                    m.sender === 'user'
                      ? 'var(--on-secondary)'
                      : m.isError
                        ? '#ba1a1a'
                        : 'var(--on-surface)',
                  padding: '0.625rem 0.875rem',
                  borderRadius:
                    m.sender === 'user'
                      ? '1rem 1rem 0.25rem 1rem'
                      : '1rem 1rem 1rem 0.25rem',
                  fontSize: '0.8125rem',
                  maxWidth: '85%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  wordBreak: 'break-word',
                }}
              >
                <FormattedMessage content={m.text} />
              </div>
            ))}

            {/* Indicador de escritura animado */}
            {isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'var(--surface-container-high)',
                  color: 'var(--on-surface-variant)',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '1rem 1rem 1rem 0.25rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    backgroundColor: 'var(--secondary)',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite alternate',
                  }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    backgroundColor: 'var(--secondary)',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite 0.2s alternate',
                  }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    backgroundColor: 'var(--secondary)',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite 0.4s alternate',
                  }}
                />
                <span style={{ marginLeft: '0.25rem', fontStyle: 'italic' }}>
                  Consultando catálogo...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de entrada */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '0.75rem 1.25rem 1.25rem 1.25rem',
              display: 'flex',
              gap: '0.5rem',
              borderTop: '1px solid rgba(209, 197, 180, 0.1)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={isLoading ? 'Esperando respuesta...' : 'Escribe tu pregunta...'}
              value={input}
              maxLength={500}
              disabled={isLoading}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.875rem',
                borderRadius: '9999px',
                border: '1px solid var(--outline-variant)',
                fontSize: '0.8125rem',
                outline: 'none',
                backgroundColor: 'var(--surface-container-lowest)',
                color: 'var(--on-surface)',
                opacity: isLoading ? 0.7 : 1,
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="btn-ai-chat"
              aria-label="Enviar mensaje"
              style={{
                width: 'auto',
                padding: '0.5rem 0.875rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isLoading || !input.trim() ? 0.5 : 1,
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                send
              </span>
            </button>
          </form>
        </div>
      )}

      {!isOpen && (
        <button
          className="ai-fab pulse"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente IA de Peluquería Carolina"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
            smart_toy
          </span>
        </button>
      )}
    </div>
  );
}
