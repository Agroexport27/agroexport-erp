"use client";

import { LineaUI, ItemCatalogo, lineaVacia, buscarEnCatalogo, norm, dinero } from "@/lib/administrativo";

const ETIQUETA_TIPO: Record<string, string> = {
  agroquimico: "Agroquímico",
  material: "Empaque",
  libre: "Otro",
};

// Editor de renglones (conceptos) para solicitudes y órdenes de compra.
// Al elegir un concepto del catálogo se enlaza con el inventario (agroquímico / empaque).
export default function LineasEditor({
  lineas,
  onChange,
  catalogo,
  conPrecio,
  moneda = "MXN",
  bloqueadas,
}: {
  lineas: LineaUI[];
  onChange: (l: LineaUI[]) => void;
  catalogo: ItemCatalogo[];
  conPrecio?: boolean;
  moneda?: string;
  bloqueadas?: boolean;
}) {
  function actualizar(key: string, cambios: Partial<LineaUI>) {
    onChange(lineas.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
  }

  function cambiarDescripcion(key: string, texto: string) {
    const item = catalogo.find((c) => norm(c.nombre) === norm(texto));
    if (item) {
      const actual = lineas.find((l) => l.key === key);
      actualizar(key, {
        descripcion: item.nombre,
        unidad: item.unidad || actual?.unidad || "",
        tipo_item: item.tipo_item,
        producto_id: item.producto_id,
        material_id: item.material_id,
        precio: conPrecio && !actual?.precio && item.precio ? String(item.precio) : actual?.precio ?? "",
      });
    } else {
      // texto libre: se desenlaza del inventario
      actualizar(key, { descripcion: texto, tipo_item: "libre", producto_id: null, material_id: null });
    }
  }

  function quitar(key: string) {
    const l = lineas.find((x) => x.key === key);
    if (l && Number(l.cantidad_recibida ?? 0) > 0) {
      alert("Este renglón ya tiene recepciones. Elimina primero la recepción para poder quitarlo.");
      return;
    }
    onChange(lineas.filter((x) => x.key !== key));
  }

  const subtotal = lineas.reduce((s, l) => s + (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0), 0);

  return (
    <div>
      <datalist id="catalogo-compras">
        {catalogo.map((c, i) => (
          <option key={i} value={c.nombre}>
            {ETIQUETA_TIPO[c.tipo_item]}
          </option>
        ))}
      </datalist>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-xs font-medium text-campo-500">
            <tr>
              <th className="px-1 py-1">Concepto</th>
              <th className="w-24 px-1 py-1">Cantidad</th>
              <th className="w-24 px-1 py-1">Unidad</th>
              {conPrecio && <th className="w-28 px-1 py-1">Precio unit.</th>}
              {conPrecio && <th className="w-28 px-1 py-1 text-right">Importe</th>}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const importe = (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0);
              return (
                <tr key={l.key} className="border-t border-campo-50 align-top">
                  <td className="px-1 py-1">
                    <input
                      className="input"
                      list="catalogo-compras"
                      value={l.descripcion}
                      disabled={bloqueadas}
                      onChange={(e) => cambiarDescripcion(l.key, e.target.value)}
                      placeholder="Escribe o elige del catálogo"
                    />
                    <span
                      className={`mt-0.5 inline-block text-[10px] ${
                        l.tipo_item === "libre" ? "text-campo-400" : "text-campo-700"
                      }`}
                    >
                      {l.tipo_item === "libre"
                        ? "Sin enlace a inventario"
                        : `↔ Inventario de ${l.tipo_item === "agroquimico" ? "agroquímicos" : "empaque"}`}
                      {Number(l.cantidad_recibida ?? 0) > 0 && ` · recibido ${l.cantidad_recibida}`}
                    </span>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={l.cantidad}
                      disabled={bloqueadas}
                      onChange={(e) => actualizar(l.key, { cantidad: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      className="input"
                      value={l.unidad}
                      disabled={bloqueadas}
                      onChange={(e) => actualizar(l.key, { unidad: e.target.value })}
                    />
                  </td>
                  {conPrecio && (
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="any"
                        className="input"
                        value={l.precio}
                        disabled={bloqueadas}
                        onChange={(e) => actualizar(l.key, { precio: e.target.value })}
                      />
                    </td>
                  )}
                  {conPrecio && (
                    <td className="px-1 py-2 text-right text-campo-800">
                      {importe.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  <td className="px-1 py-1">
                    {!bloqueadas && (
                      <button className="btn-danger px-2" onClick={() => quitar(l.key)} title="Quitar renglón">
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!bloqueadas && (
        <button className="btn-secondary mt-2 text-xs" onClick={() => onChange([...lineas, lineaVacia()])}>
          + Agregar concepto
        </button>
      )}
      {conPrecio && (
        <p className="mt-2 text-right text-xs text-campo-500">Subtotal: {dinero(subtotal, moneda)}</p>
      )}
    </div>
  );
}

export { buscarEnCatalogo };
