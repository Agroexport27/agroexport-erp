import type { Metadata } from "next";
// @ts-ignore: CSS import declarations are handled by Next.js
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Agroexport ERP",
  description: "Sistema interno de gestión agrícola — Agroexport de Sonora",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
