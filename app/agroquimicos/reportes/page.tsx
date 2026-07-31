"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { id: string; label: string };

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

  // Jerarquia 1: Campo -> Cuadro -> Producto
  const jerarquiaCuadroProducto = useMemo(() => {
    type NodoProducto = { nombre: string; cantidad: number; unidad: string };
    type NodoCuadro = { nombre: string; productos: Map<string, NodoProducto> };
    type NodoCampo = { nombre: string; cuadros: Map<string, NodoCuadro> };

    const campoMap = new Map<string, NodoCampo>();
    for (const r of registros) {
      const nombreCampo = r.cuadros?.campos?.nombre ?? "Sin campo";
      const nombreCuadro = r.cuadros?.nombre ?? "Sin cuadro";
      const nombreProducto = r.catalogo_productos?.nombre ?? "Sin producto";
      const cantidad = Number(r.cantidad ?? 0);

      const campo = campoMap.get(nombreCampo) ?? { nombre: nombreCampo, cuadros: new Map() };
      const cuadro = campo.cuadros.get(nombreCuadro) ?? { nombre: nombreCuadro, productos: new Map() };
      const producto = cuadro.productos.get(nombreProducto) ?? { nombre: nombreProducto, cantidad: 0, unidad: r.unidad };
      producto.cantidad += cantidad;
      cuadro.productos.set(nombreProducto, producto);
      campo.cuadros.set(nombreCuadro, cuadro);
      campoMap.set(nombreCampo, campo);
    }

    return Array.from(campoMap.values()).map((c) => ({
      nombre: c.nombre,
      cuadros: Array.from(c.cuadros.values())
        .map((q) => ({
          nombre: q.nombre,
          productos: Array.from(q.productos.values()).sort((a, b) => b.cantidad - a.cantidad),
          total: Array.from(q.productos.values()).reduce((s, p) => s + p.cantidad, 0),
        }))
        .sort((a, b) => b.total - a.total),
    }));
  }, [registros]);

  // Jerarquia 2: Campo -> Producto -> Cuadro
  const jerarquiaProductoCuadro = useMemo(() => {
    type NodoCuadro = { nombre: string; cantidad: number; unidad: string };
    type NodoProducto = { nombre: string; cuadros: Map<string, NodoCuadro> };
    type NodoCampo = { nombre: string; productos: Map<string, NodoProducto> };

    const campoMap = new Map<string, NodoCampo>();
    for (const r of registros) {
      const nombreCampo = r.cuadros?.campos?.nombre ?? "Sin campo";
      const nombreCuadro = r.cuadros?.nombre ?? "Sin cuadro";
      const nombreProducto = r.catalogo_productos?.nombre ?? "Sin producto";
      const cantidad = Number(r.cantidad ?? 0);

      const campo = campoMap.get(nombreCampo) ?? { nombre: nombreCampo, productos: new Map() };
      const producto = campo.productos.get(nombreProducto) ?? { nombre: nombreProducto, cuadros: new Map() };
      const cuadro = producto.cuadros.get(nombreCuadro) ?? { nombre: nombreCuadro, cantidad: 0, unidad: r.unidad };
      cuadro.cantidad += cantidad;
      producto.cuadros.set(nombreCuadro, cuadro);
      campo.productos.set(nombreProducto, producto);
      campoMap.set(nombreCampo, campo);
    }

    return Array.from(campoMap.values()).map((c) => ({
      nombre: c.nombre,
      productos: Array.from(c.productos.values())
        .map((p) => ({
          nombre: p.nombre,
          cuadros: Array.from(p.cuadros.values()).sort((a, b) => b.cantidad - a.cantidad),
          total: Array.from(p.cuadros.values()).reduce((s, q) => s + q.cantidad, 0),
        }))
        .sort((a, b) => b.total - a.total),
    }));
  }, [registros]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Reportes — Agroquímicos</h1>
      <p className="mb-6 text-sm text-campo-600">
        Acumulado de productos aplicados (foliar y vía riego), desglosado por campo, cuadro y producto.
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

      <h2 className="mb-2 mt-6 text-sm font-semibold text-campo-800">
        Desglose por campo: Cuadros → Productos
      </h2>
      {jerarquiaCuadroProducto.length === 0 && (
        <p className="text-sm text-campo-400">Sin datos en el rango seleccionado.</p>
      )}
      {jerarquiaCuadroProducto.map((campo) => (
        <details key={campo.nombre} className="card mb-2 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-100 px-4 py-2">
            <span className="text-sm font-semibold text-campo-900">{campo.nombre}</span>
          </summary>
          <div className="px-3 py-2">
            {campo.cuadros.map((cuadro) => (
              <details key={cuadro.nombre} className="mb-1 rounded border border-campo-100">
                <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-3 py-1.5">
                  <span className="text-sm text-campo-800">{cuadro.nombre}</span>
                </summary>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs font-medium text-campo-500">
                    <tr>
                      <th className="px-4 py-1">Producto</th>
                      <th className="px-4 py-1">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuadro.productos.map((p) => (
                      <tr key={p.nombre} className="border-t border-campo-50">
                        <td className="px-4 py-1 text-campo-800">{p.nombre}</td>
                        <td className="px-4 py-1 text-campo-800">{p.cantidad.toFixed(2)} {p.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        </details>
      ))}

      <h2 className="mb-2 mt-8 text-sm font-semibold text-campo-800">
        Desglose por campo: Productos → Cuadros
      </h2>
      {jerarquiaProductoCuadro.length === 0 && (
        <p className="text-sm text-campo-400">Sin datos en el rango seleccionado.</p>
      )}
      {jerarquiaProductoCuadro.map((campo) => (
        <details key={campo.nombre} className="card mb-2 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-100 px-4 py-2">
            <span className="text-sm font-semibold text-campo-900">{campo.nombre}</span>
          </summary>
          <div className="px-3 py-2">
            {campo.productos.map((producto) => (
              <details key={producto.nombre} className="mb-1 rounded border border-campo-100">
                <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-3 py-1.5">
                  <span className="text-sm text-campo-800">{producto.nombre}</span>
                  <span className="text-xs text-campo-600">
                    Total: {producto.total.toFixed(2)}
                  </span>
                </summary>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs font-medium text-campo-500">
                    <tr>
                      <th className="px-4 py-1">Cuadro</th>
                      <th className="px-4 py-1">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {producto.cuadros.map((c) => (
                      <tr key={c.nombre} className="border-t border-campo-50">
                        <td className="px-4 py-1 text-campo-800">{c.nombre}</td>
                        <td className="px-4 py-1 text-campo-800">{c.cantidad.toFixed(2)} {c.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
