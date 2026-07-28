const CATALOGOS = [
  { nombre: "Campos", href: "/catalogos/campos", listo: true },
  { nombre: "Cuadros", href: "/catalogos/cuadros", listo: true },
  { nombre: "Ciclos", href: "/catalogos/ciclos", listo: true },
  { nombre: "Cultivos y variedades", href: "/catalogos/cultivos", listo: false },
  { nombre: "Viveros", href: "/catalogos/viveros", listo: true },
  { nombre: "Proveedores de semilla", href: "/catalogos/proveedores-semilla", listo: true },
  { nombre: "Distribuidores", href: "/catalogos/distribuidores", listo: true },
  { nombre: "Productos agroquímicos", href: "/catalogos/productos-agroquimicos", listo: true },
  { nombre: "Materiales de empaque", href: "/catalogos/materiales-empaque", listo: true },
  { nombre: "Actividades", href: "/catalogos/actividades", listo: true },
  { nombre: "Maquinaria / vehículos", href: "/catalogos/vehiculos", listo: true },
];

export default function CatalogosPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Catálogos</h1>
      <p className="mt-1 text-sm text-campo-600">
        Todos estos catálogos son editables: puedes agregar, editar o
        eliminar libremente.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATALOGOS.map((c) => (
          <a
            key={c.href}
            href={c.listo ? c.href : "#"}
            className={`card p-4 text-sm font-medium ${
              c.listo
                ? "text-campo-800 hover:border-campo-300"
                : "cursor-not-allowed text-campo-300"
            }`}
          >
            {c.nombre}
            {!c.listo && (
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
