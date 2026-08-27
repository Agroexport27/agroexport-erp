const SECCIONES = [
  { nombre: "Corte diario", href: "/cosecha/corte", listo: true },
  { nombre: "Registros de corte", href: "/cosecha/corte/registros", listo: true },
];

export default function CosechaPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Cosecha</h1>
      <p className="mt-1 text-sm text-campo-600">
        Corte diario por calibre y distribuidor. Próximamente: acumulado, embarques e inventario de materiales.
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
