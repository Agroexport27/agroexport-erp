const SECCIONES = [
  { nombre: "Inventario (existencias)", href: "/agroquimicos/inventario", listo: true },
  { nombre: "Entradas y salidas", href: "/agroquimicos/movimientos", listo: true },
  { nombre: "Aplicaciones foliares", href: "/agroquimicos/aplicaciones", listo: true },
  { nombre: "Registros (foliar + riego)", href: "/agroquimicos/registros", listo: true },
  { nombre: "Reportes", href: "/agroquimicos/reportes", listo: true },
];

export default function AgroquimicosPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Agroquímicos</h1>
      <p className="mt-1 text-sm text-campo-600">
        Inventario, entradas/salidas, solicitudes y aplicaciones — con
        descuento automático de existencias.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SECCIONES.map((s) => (
          <a
            key={s.href}
            href={s.listo ? s.href : "#"}
            className={`card p-4 text-sm font-medium ${
              s.listo
                ? "text-campo-800 hover:border-campo-300"
                : "cursor-not-allowed text-campo-300"
            }`}
          >
            {s.nombre}
            {!s.listo && (
              <span className="ml-2 text-xs text-campo-300">(próximamente)</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
