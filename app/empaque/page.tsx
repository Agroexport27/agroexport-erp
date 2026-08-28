const SECCIONES = [
  { nombre: "Inventario de materiales", href: "/empaque/inventario", listo: true },
  { nombre: "Entradas y salidas", href: "/empaque/movimientos", listo: true },
  { nombre: "Movimientos (por periodo)", href: "/empaque/registros", listo: true },
  { nombre: "Reportes", href: "/empaque/reportes", listo: true },
  { nombre: "Catálogo de materiales", href: "/empaque/materiales", listo: true },
];

export default function EmpaquePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Empaque</h1>
      <p className="mt-1 text-sm text-campo-600">
        Inventario de materiales — cajas, etiquetas, separadores, mallas, tarimas...
        Se descuenta automático con cada Corte diario.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SECCIONES.map((s) => (
          <a
            key={s.href}
            href={s.listo ? s.href : "#"}
            className={`card p-4 text-sm font-medium ${
              s.listo ? "text-campo-800 hover:border-campo-300" : "cursor-not-allowed text-campo-300"
            }`}
          >
            {s.nombre}
            {!s.listo && <span className="ml-2 text-xs text-campo-300">(próximamente)</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
