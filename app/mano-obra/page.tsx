const SECCIONES = [
  { nombre: "Plan semanal de labores", href: "/mano-obra/plan-semanal", listo: false },
];

export default function ManoDeObraPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Mano de obra</h1>
      <p className="mt-1 text-sm text-campo-600">
        Planeación de labores: plan vs. real, y lo que se agregue más
        adelante fuera del registro diario de Nóminas.
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
