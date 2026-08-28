const SECCIONES = [
  { nombre: "Captura de remisión", href: "/embarques/captura", listo: true },
  { nombre: "Registros de embarques", href: "/embarques/registros", listo: true },
];

export default function EmbarquesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Embarques</h1>
      <p className="mt-1 text-sm text-campo-600">
        Lo que realmente se exportó cada día a Nogales, por distribuidor.
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
