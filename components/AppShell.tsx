"use client";

import { usePathname } from "next/navigation";

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
  const esLogin = pathname?.startsWith("/login");

  if (esLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-campo-100 bg-white px-4 py-6">
        <div className="mb-8 px-2">
          <p className="text-sm font-semibold text-campo-800">Agroexport</p>
          <p className="text-xs text-campo-500">Sistema interno</p>
        </div>
        <nav className="flex flex-col gap-1">
          {MODULOS.map((m) => (
            <a
              key={m.href}
              href={m.href}
              className="rounded-md px-3 py-2 text-sm text-campo-700 hover:bg-campo-50"
            >
              {m.nombre}
            </a>
          ))}
        </nav>
        <div className="mt-8 border-t border-campo-100 pt-4">
          <a
            href="/login"
            className="block rounded-md px-3 py-2 text-sm text-campo-700 hover:bg-campo-50"
          >
            Cerrar sesión
          </a>
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
