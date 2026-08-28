"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReportesMaterialesPage() {
  const supabase = createClient();
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));

  async function consultar() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("movimiento_material_empaque")
      .select("fecha, tipo, cantidad, campos(nombre), materiales_empaque(nombre)")
      .eq("tipo", "salida")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .limit(5000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const porMaterial = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of registros) {
      const nombre = r.materiales_empaque?.nombre ?? "Sin material";
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + Number(r.cantidad ?? 0));
    }
    return Array.from(mapa.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [registros]);

  const totalConsumo = registros.reduce((s, r) => s + Number(r.cantidad ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Reportes — Materiales</h1>
      <p className="mb-6 text-sm text-campo-600">Consumo de materiales (salidas), acumulado por material.</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Desde</label>
          <input type="date" className="input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hasta</label>
          <input type="date" className="input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </div>

      <div className="card mb-6 p-4">
        <p className="text-xs text-campo-500">Consumo total (todas las unidades sumadas)</p>
        <p className="text-2xl font-semibold text-campo-900">{totalConsumo.toLocaleString()}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">Consumo por material</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Material</th>
              <th className="px-4 py-2">Cantidad consumida</th>
            </tr>
          </thead>
          <tbody>
            {porMaterial.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={2}>Sin datos.</td></tr>
            )}
            {porMaterial.map((m) => (
              <tr key={m.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{m.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{m.cantidad.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
