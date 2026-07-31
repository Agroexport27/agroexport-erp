const SECCIONES = [
  { nombre: "Programa de riego (diario)", href: "/riego/programa", listo: true },
  { nombre: "Reportes (horas, lámina)", href: "/riego/reportes", listo: true },
  { nombre: "Sistema de riego por cuadro", href: "/riego/sistema", listo: true },
  { nombre: "Estaciones de humedad", href: "/riego/humedad", listo: false },
];

export default function RiegoPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Riego</h1>
      <p className="mt-1 text-sm text-campo-600">
        Programa diario de riego y fertirriego (con descuento automático de
        inventario), reportes de horas/lámina, y parámetros del sistema por
        cuadro.
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
