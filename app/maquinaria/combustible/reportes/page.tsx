"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelReporteCombustible } from "@/lib/excel/reporteCombustible";
import { generarPdfReporteCombustible } from "@/lib/pdf/reporteCombustible";

type Opcion = { id: string; label: string };

export default function ReportesCombustiblePage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [tipoCombustible, setTipoCombustible] = useState<"" | "diesel" | "gasolina">("");
  const [campoId, setCampoId] = useState("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("combustible_movimientos")
      .select(
        "id, fecha, tipo_combustible, tipo, litros, folio, chofer, campos(nombre), catalogo_unidades(nombre)"
      )
      .eq("tipo", "salida") // el gasto real es lo que sale a las unidades
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);

    if (tipoCombustible) query = query.eq("tipo_combustible", tipoCombustible);
    if (campoId) query = query.eq("campo_id", campoId);

    const { data, error } = await query.limit(3000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { porCampo, porUnidad, porChofer } = useMemo(() => {
    const campoMap = new Map<string, number>();
    const unidadMap = new Map<string, number>();
    const choferMap = new Map<string, number>();

    for (const r of registros) {
      const litros = Number(r.litros ?? 0);
      const campo = r.campos?.nombre ?? "Sin campo";
      const unidad = r.catalogo_unidades?.nombre ?? "Sin unidad";
      const chofer = r.chofer?.trim() || "Sin chofer";

      campoMap.set(campo, (campoMap.get(campo) ?? 0) + litros);
      unidadMap.set(unidad, (unidadMap.get(unidad) ?? 0) + litros);
      choferMap.set(chofer, (choferMap.get(chofer) ?? 0) + litros);
    }

    const aArr = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([nombre, litros]) => ({ nombre, litros }))
        .sort((a, b) => b.litros - a.litros);

    return { porCampo: aArr(campoMap), porUnidad: aArr(unidadMap), porChofer: aArr(choferMap) };
  }, [registros]);

  const totalLitros = registros.reduce((s, r) => s + Number(r.litros ?? 0), 0);
  const rango = `${fechaInicio}_a_${fechaFin}`;

  function descargarExcel() {
    generarExcelReporteCombustible({ rango, porCampo, porUnidad, porChofer });
  }
  function descargarPdf() {
    generarPdfReporteCombustible({ rango, totalLitros, porCampo, porUnidad, porChofer });
  }

  function Tabla({ titulo, filas }: { titulo: string; filas: { nombre: string; litros: number }[] }) {
    return (
      <div className="card mb-6 overflow-hidden">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">{titulo}</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Litros</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={2}>Sin datos.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{f.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{f.litros.toLocaleString()} L</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Reportes — Combustible</h1>
      <p className="mb-6 text-sm text-campo-600">
        Litros consumidos (salidas a unidades), por campo, unidad y chofer.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Desde</label>
          <input type="date" className="input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hasta</label>
          <input type="date" className="input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Combustible</label>
          <select className="input" value={tipoCombustible} onChange={(e) => setTipoCombustible(e.target.value as any)}>
            <option value="">Todos</option>
            <option value="diesel">Diésel</option>
            <option value="gasolina">Gasolina</option>
          </select>
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
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
          <button className="btn-secondary" onClick={descargarExcel}>Excel</button>
          <button className="btn-secondary" onClick={descargarPdf}>PDF</button>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <p className="text-xs text-campo-500">Litros totales en el rango</p>
        <p className="text-2xl font-semibold text-campo-900">{totalLitros.toLocaleString()} L</p>
      </div>

      <Tabla titulo="Por campo" filas={porCampo} />
      <Tabla titulo="Por unidad" filas={porUnidad} />
      <Tabla titulo="Por chofer / operador" filas={porChofer} />
    </div>
  );
}
