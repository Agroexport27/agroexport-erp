const SECCIONES = [
  { nombre: "Solicitudes de compra", href: "/administrativo/solicitudes", listo: true },
  { nombre: "Órdenes de compra", href: "/administrativo/ordenes", listo: true },
  { nombre: "Proveedores", href: "/administrativo/proveedores", listo: true },
  { nombre: "Productos y conceptos", href: "/administrativo/conceptos", listo: true },
];

export default function AdministrativoPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Administrativo</h1>
      <p className="mt-1 text-sm text-campo-600">
        Solicitud de compra → la autoriza un autorizador con un botón → se genera sola la orden de
        compra con folio, ligada a la solicitud → recepción (total o parcial) que entra al inventario.
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
            {!s.listo && <span className="ml-2 text-xs text-campo-300">(próximamente)</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
