import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  title: "Peluquería Carolina | Alta Peluquería & Cuidado de Autor",
  description:
    "Reserva tu cita online en Peluquería Carolina. Diagnóstico capilar personalizado, estilistas profesionales y atención de excelencia en San Fernando.",
  keywords: ["Peluqueria Carolina", "Salon de belleza", "Reserva de citas", "San Fernando", "Peluquería"],
  authors: [{ name: "Peluquería Carolina" }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body>{children}</body>
    </html>
  );
}
