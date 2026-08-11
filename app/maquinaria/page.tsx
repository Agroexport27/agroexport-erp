const SECCIONES = [
  { nombre: "Combustible (entradas/salidas)", href: "/maquinaria/combustible", listo: true },
  { nombre: "Reportes de combustible", href: "/maquinaria/combustible/reportes", listo: true },
  { nombre: "Unidades (tractores, camionetas...)", href: "/maquinaria/unidades", listo: true },
];

export default function MaquinariaPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Maquinaria</h1>
      <p className="mt-1 text-sm text-campo-600">
        Control de diésel y gasolina por unidad, campo y chofer.
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
