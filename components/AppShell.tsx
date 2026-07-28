"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MODULOS = [
  { nombre: "Planeación", href: "/catalogos" },
  { nombre: "Nóminas", href: "/nominas" },
  { nombre: "Mano de obra", href: "/mano-obra" },
  { nombre: "Maquinaria", href: "/maquinaria" },
  { nombre: "Riego", href: "/riego" },
  { nombre: "Agroquímicos", href: "/agroquimicos" },
  { nombre: "Empaque", href: "/empaque" },
  { nombre: "Cosecha", href: "/cosecha" },
  { nombre: "Embarques", href: "/embarques" },
  { nombre: "Administrativo", href: "/administrativo" },
];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const esLogin = pathname?.startsWith("/login");
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (esLogin) {
    return <>{children}</>;
  }

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const contenidoMenu = (
    <>
      <div className="mb-8 px-2">
        <p className="text-sm font-semibold text-campo-800">Agroexport</p>
        <p className="text-xs text-campo-500">Sistema interno</p>
      </div>
      <nav className="flex flex-col gap-1">
        {MODULOS.map((m) => (
          <a
            key={m.href}
            href={m.href}
            onClick={() => setMenuAbierto(false)}
            className="rounded-md px-3 py-2 text-sm text-campo-700 hover:bg-campo-50"
          >
            {m.nombre}
          </a>
        ))}
      </nav>
      <div className="mt-8 border-t border-campo-100 pt-4">
        <button
          onClick={cerrarSesion}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-campo-500 hover:bg-campo-50"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Barra superior solo en celular: hamburguesa + nombre */}
      <div className="flex items-center justify-between border-b border-campo-100 bg-white px-4 py-3 md:hidden">
        <p className="text-sm font-semibold text-campo-800">Agroexport</p>
        <button
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="rounded-md border border-campo-200 px-3 py-1.5 text-sm text-campo-700"
          aria-label="Abrir menú"
        >
          {menuAbierto ? "✕ Cerrar" : "☰ Menú"}
        </button>
      </div>

      {/* Menu desplegable en celular */}
      {menuAbierto && (
        <div className="border-b border-campo-100 bg-white px-4 py-4 md:hidden">
          {contenidoMenu}
        </div>
      )}

      {/* Sidebar fijo, solo en pantallas medianas+ */}
      <aside className="hidden w-56 shrink-0 border-r border-campo-100 bg-white px-4 py-6 md:block">
        {contenidoMenu}
      </aside>

      <main className="flex-1 overflow-x-auto px-4 py-4 md:px-8 md:py-6">
        {children}
      </main>
    </div>
  );
}
