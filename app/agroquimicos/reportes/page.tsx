"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { id: string; label: string };
type FilaResumen = { nombre: string; cantidad: number; unidad: string };

export default function ReportesAgroquimicosPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [productosOpciones, setProductosOpciones] = useState<Opcion[]>([]);
  const [ciclos, setCiclos] = useState<{ id: string; clave: string; fecha_inicio: string; fecha_fin: string }[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [tipo, setTipo] = useState<"" | "foliar" | "fertirriego">("");
  const [productoId, setProductoId] = useState("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));

    supabase
      .from("catalogo_productos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setProductosOpciones((data ?? []).map((p: any) => ({ id: p.id, label: p.nombre }))));

    supabase
      .from("ciclos")
      .select("id, clave, fecha_inicio, fecha_fin")
      .order("clave", { ascending: false })
      .then(({ data }) => setCiclos(data ?? []));
  }, []);

  function aplicarCiclo(id: string) {
    const c = ciclos.find((c) => c.id === id);
    if (c) {
      setFechaInicio(c.fecha_inicio);
      setFechaFin(c.fecha_fin);
    }
  }

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("aplicaciones")
      .select(
        "id, fecha, cantidad, unidad, tipo, metodo, producto_id, catalogo_productos(nombre), cuadros(nombre, hectareas, campo_id, campos(nombre))"
      )
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);

    if (tipo) query = query.eq("tipo", tipo);
    if (productoId) query = query.eq("producto_id", productoId);

    const { data, error } = await query.limit(5000);
    let filtrados = (data ?? []) as any[];
    if (campoId) filtrados = filtrados.filter((r) => r.cuadros?.campo_id === campoId);

    if (error) setError(error.message);
    else setRegistros(filtrados);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { porProducto, porCampo, porCuadro, porTipo } = useMemo(() => {
    const productoMap = new Map<string, FilaResumen>();
    const campoMap = new Map<string, number>();
    const cuadroMap = new Map<string, FilaResumen>();
    const tipoMap = new Map<string, number>();

    for (const r of registros) {
      const cantidad = Number(r.cantidad ?? 0);
      const nombreProducto = r.catalogo_productos?.nombre ?? "Sin producto";
      const p =
        productoMap.get(nombreProducto) ?? { nombre: nombreProducto, cantidad: 0, unidad: r.unidad };
      p.cantidad += cantidad;
      productoMap.set(nombreProducto, p);

      const nombreCampo = r.cuadros?.campos?.nombre ?? "Sin campo";
      campoMap.set(nombreCampo, (campoMap.get(nombreCampo) ?? 0) + cantidad);

      const nombreCuadro = r.cuadros?.nombre ?? "Sin cuadro";
      const q =
        cuadroMap.get(nombreCuadro) ?? { nombre: nombreCuadro, cantidad: 0, unidad: r.unidad };
      q.cantidad += cantidad;
      cuadroMap.set(nombreCuadro, q);

      const etiquetaTipo = r.tipo === "foliar" ? "Foliar" : "Vía riego";
      tipoMap.set(etiquetaTipo, (tipoMap.get(etiquetaTipo) ?? 0) + cantidad);
    }

    return {
      porProducto: Array.from(productoMap.values()).sort((a, b) => b.cantidad - a.cantidad),
      porCampo: Array.from(campoMap.entries())
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
      porCuadro: Array.from(cuadroMap.values()).sort((a, b) => b.cantidad - a.cantidad),
      porTipo: Array.from(tipoMap.entries()).map(([nombre, cantidad]) => ({ nombre, cantidad })),
    };
  }, [registros]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Reportes — Agroquímicos</h1>
      <p className="mb-6 text-sm text-campo-600">
        Acumulado de productos aplicados (foliar y vía riego), por producto, campo o cuadro.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Ciclo</label>
          <select className="input" onChange={(e) => aplicarCiclo(e.target.value)}>
            <option value="">— Manual —</option>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Desde</label>
          <input type="date" className="input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hasta</label>
          <input type="date" className="input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
            <option value="">Todos</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="">Todos</option>
            <option value="foliar">Foliar</option>
            <option value="fertirriego">Vía riego</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Producto</label>
          <select className="input" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">Todos</option>
            {productosOpciones.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 md:col-span-6">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {porTipo.map((t) => (
          <div key={t.nombre} className="card p-4">
            <p className="text-xs text-campo-500">{t.nombre}</p>
            <p className="text-2xl font-semibold text-campo-900">{t.cantidad.toFixed(1)}</p>
          </div>
        ))}
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">Acumulado por producto</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Cantidad acumulada</th>
            </tr>
          </thead>
          <tbody>
            {porProducto.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={2}>Sin datos.</td></tr>
            )}
            {porProducto.map((p) => (
              <tr key={p.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{p.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{p.cantidad.toFixed(2)} {p.unidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">Acumulado por campo</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cantidad acumulada (todas las unidades sumadas)</th>
            </tr>
          </thead>
          <tbody>
            {porCampo.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={2}>Sin datos.</td></tr>
            )}
            {porCampo.map((c) => (
              <tr key={c.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{c.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{c.cantidad.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-campo-50 px-4 py-2 text-[11px] text-campo-400">
          Nota: si filtras por un producto específico, esta suma sí tiene una sola unidad. Si dejas "Todos los productos", son unidades distintas sumadas juntas — filtra por producto para un total exacto.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">Acumulado por cuadro</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Cantidad acumulada</th>
            </tr>
          </thead>
          <tbody>
            {porCuadro.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={2}>Sin datos.</td></tr>
            )}
            {porCuadro.map((c) => (
              <tr key={c.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{c.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{c.cantidad.toFixed(2)} {c.unidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
