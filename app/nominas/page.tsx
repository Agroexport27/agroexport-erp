const SECCIONES = [
  { nombre: "Empleados", href: "/nominas/empleados", listo: true },
  { nombre: "Apuntador diario", href: "/nominas/apuntador", listo: true },
  { nombre: "Censo diario", href: "/nominas/censo", listo: true },
  { nombre: "Reportes de costo", href: "/nominas/reportes", listo: true },
  { nombre: "Registros (censos y apuntador)", href: "/nominas/registros", listo: true },
];

export default function NominasPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Nóminas</h1>
      <p className="mt-1 text-sm text-campo-600">
        Mano de obra: empleados, plan de labores, apuntador diario y
        reportes de costo por actividad, cuadro y cultivo.
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
              <span className="ml-2 text-xs text-campo-300">
                (próximamente)
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
