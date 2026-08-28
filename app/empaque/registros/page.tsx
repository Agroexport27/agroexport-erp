"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelInventarioMateriales } from "@/lib/excel/inventarioMateriales";
import { generarPdfInventarioMateriales } from "@/lib/pdf/inventarioMateriales";

type Opcion = { id: string; label: string };

export default function MovimientosHistorialMaterialesPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [materiales, setMateriales] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [tipo, setTipo] = useState<"" | "entrada" | "salida">("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
    supabase
      .from("materiales_empaque")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setMateriales((data ?? []).map((m: any) => ({ id: m.id, label: m.nombre }))));
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("movimiento_material_empaque")
      .select("id, fecha, tipo, cantidad, observaciones, origen_tipo, campos(nombre), materiales_empaque(nombre)")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .order("fecha", { ascending: false });

    if (campoId) query = query.eq("campo_id", campoId);
    if (materialId) query = query.eq("material_id", materialId);
    if (tipo) query = query.eq("tipo", tipo);

    const { data, error } = await query.limit(3000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalEntradas = registros.filter((r) => r.tipo === "entrada").reduce((s, r) => s + Number(r.cantidad ?? 0), 0);
  const totalSalidas = registros.filter((r) => r.tipo === "salida").reduce((s, r) => s + Number(r.cantidad ?? 0), 0);

  function filasParaExport() {
    return registros.map((r: any) => ({
      campo: r.campos?.nombre ?? "",
      material: `${r.fecha} — ${r.tipo} — ${r.materiales_empaque?.nombre ?? ""}`,
      stock: Number(r.cantidad ?? 0),
    }));
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Movimientos</h1>
      <p className="mb-6 text-sm text-campo-600">
        Todas las entradas y salidas de materiales, filtrables por periodo.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-6">
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
          <label className="mb-1 block text-xs font-medium text-campo-600">Material</label>
          <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Todos</option>
            {materiales.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
          <button className="btn-secondary" onClick={() => generarExcelInventarioMateriales(filasParaExport())}>
            Excel
          </button>
          <button className="btn-secondary" onClick={() => generarPdfInventarioMateriales(filasParaExport())}>
            PDF
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total entradas</p>
          <p className="text-2xl font-semibold text-campo-900">{totalEntradas.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total salidas</p>
          <p className="text-2xl font-semibold text-campo-900">{totalSalidas.toLocaleString()}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Material</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2">Origen</th>
              <th className="px-4 py-2">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Cargando...</td></tr>}
            {!loading && registros.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Sin registros en el rango seleccionado.</td></tr>
            )}
            {registros.map((r: any) => (
              <tr key={r.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{r.fecha}</td>
                <td className="px-4 py-2 text-campo-800">{r.campos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{r.materiales_empaque?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">
                  <span className={r.tipo === "entrada" ? "text-campo-700" : "text-tierra-600"}>{r.tipo}</span>
                </td>
                <td className="px-4 py-2 text-campo-800">{r.cantidad}</td>
                <td className="px-4 py-2 text-campo-600">
                  {r.origen_tipo === "corte_diario" ? "Corte diario" : "Manual"}
                </td>
                <td className="px-4 py-2 text-campo-600">{r.observaciones ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
