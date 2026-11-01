import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UniSaaS Web POS | Terminal Punto de Venta',
  description: 'Terminal POS Multi-Tenant con Checkout Atómico y Facturación Electrónica',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}

