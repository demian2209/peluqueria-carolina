import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  title: "Peluqueria Carolina | Luxury Hair & AI Atelier",
  description:
    "Experimente la perfección capilar impulsada por inteligencia artificial. Reservas instantáneas y estilismo personalizado en el atelier más exclusivo.",
  keywords: ["Peluqueria Carolina", "Salon de belleza", "Reserva de citas", "IA Hair", "Atelier"],
  authors: [{ name: "Peluquería Carolina" }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
