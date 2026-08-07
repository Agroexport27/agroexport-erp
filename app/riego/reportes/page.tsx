"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelReporteRiego } from "@/lib/excel/reporteRiego";
import { generarPdfReporteRiego } from "@/lib/pdf/reporteRiego";

type Opcion = { id: string; label: string };

export default function ReportesRiegoPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [cuadrosOpciones, setCuadrosOpciones] = useState<Opcion[]>([]);
  const [ciclos, setCiclos] = useState<{ id: string; clave: string; fecha_inicio: string; fecha_fin: string }[]>([]);
  const [sistemaPorCuadro, setSistemaPorCuadro] = useState<
    Record<string, { caudal: number; sepGoteros: number; sepLineas: number }>
  >({});
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [cuadroId, setCuadroId] = useState("");
  const [cicloId, setCicloId] = useState("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));

    supabase
      .from("cuadros")
      .select("id, nombre, campos(nombre)")
      .order("nombre")
      .then(({ data }) => setCuadrosOpciones((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));

    supabase
      .from("ciclos")
      .select("id, clave, fecha_inicio, fecha_fin")
      .order("clave", { ascending: false })
      .then(({ data }) => setCiclos(data ?? []));

    supabase
      .from("sistema_riego_cuadro")
      .select("cuadro_id, caudal_gotero_lh, separacion_goteros_m, separacion_lineas_m")
      .then(({ data }) => {
        const mapa: Record<string, { caudal: number; sepGoteros: number; sepLineas: number }> = {};
        for (const s of (data ?? []) as any[]) {
          mapa[s.cuadro_id] = {
            caudal: Number(s.caudal_gotero_lh),
            sepGoteros: Number(s.separacion_goteros_m),
            sepLineas: Number(s.separacion_lineas_m),
          };
        }
        setSistemaPorCuadro(mapa);
      });
  }, []);

  function aplicarCiclo(id: string) {
    setCicloId(id);
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
      .from("riego_diario")
      .select("id, fecha, horas_riego, cuadro_id, cuadros(nombre, hectareas, campo_id, campos(nombre))")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);

    if (cuadroId) query = query.eq("cuadro_id", cuadroId);

    const { data, error } = await query;
    let filtrados = (data ?? []) as any[];
    if (campoId) filtrados = filtrados.filter((r: any) => r.cuadros?.campo_id === campoId);

    if (error) setError(error.message);
    else setRegistros(filtrados);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function laminaDe(r: any): number | null {
    const sis = sistemaPorCuadro[r.cuadro_id];
    if (!sis || !sis.sepGoteros || !sis.sepLineas) return null;
    return (sis.caudal * Number(r.horas_riego)) / (sis.sepGoteros * sis.sepLineas);
  }

  const porCuadro = useMemo(() => {
    const mapa = new Map<
      string,
      { nombre: string; campo: string; hectareas: number; horas: number; laminaHa: number; riegos: number }
    >();
    for (const r of registros) {
      const key = r.cuadro_id;
      const laminaHa = laminaDe(r) ?? 0;
      const item =
        mapa.get(key) ??
        {
          nombre: r.cuadros?.nombre ?? "",
          campo: r.cuadros?.campos?.nombre ?? "",
          hectareas: Number(r.cuadros?.hectareas ?? 0),
          horas: 0,
          laminaHa: 0,
          riegos: 0,
        };
      item.horas += Number(r.horas_riego);
      item.laminaHa += laminaHa;
      item.riegos += 1;
      mapa.set(key, item);
    }
    return Array.from(mapa.values())
      .map((c) => ({ ...c, laminaTotal: c.laminaHa * c.hectareas }))
      .sort((a, b) => b.horas - a.horas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, sistemaPorCuadro]);

  const porMes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of registros) {
      const mes = r.fecha.slice(0, 7); // YYYY-MM
      mapa.set(mes, (mapa.get(mes) ?? 0) + Number(r.horas_riego));
    }
    return Array.from(mapa.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([mes, horas]) => ({ mes, horas }));
  }, [registros]);

  const totalHoras = registros.reduce((s, r) => s + Number(r.horas_riego), 0);
  const totalLamina = porCuadro.reduce((s, c) => s + c.laminaTotal, 0);

  const maxHorasMes = Math.max(1, ...porMes.map((m) => m.horas));
  const maxHorasCuadro = Math.max(1, ...porCuadro.map((c) => c.horas));

  const rango = `${fechaInicio}_a_${fechaFin}`;

  function descargarExcel() {
    generarExcelReporteRiego({ rango, porCuadro, porMes });
  }

  function descargarPdf() {
    generarPdfReporteRiego({ rango, totalHoras, totalLamina, porCuadro, porMes });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Reportes de riego</h1>
      <p className="mb-6 text-sm text-campo-600">
        Horas de riego y lámina aplicada, por cuadro, mes o ciclo.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Ciclo</label>
          <select className="input" value={cicloId} onChange={(e) => aplicarCiclo(e.target.value)}>
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
          <label className="mb-1 block text-xs font-medium text-campo-600">Cuadro</label>
          <select className="input" value={cuadroId} onChange={(e) => setCuadroId(e.target.value)}>
            <option value="">Todos</option>
            {cuadrosOpciones.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? "Consultando..." : "Consultar"}
        </button>
        <button className="btn-secondary" onClick={descargarExcel}>
          Descargar Excel
        </button>
        <button className="btn-secondary" onClick={descargarPdf}>
          Descargar PDF
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-campo-500">Horas de riego totales</p>
          <p className="text-2xl font-semibold text-campo-900">{totalHoras.toFixed(1)} h</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-campo-500">Lámina total aplicada</p>
          <p className="text-2xl font-semibold text-campo-900">{totalLamina.toFixed(1)} mm</p>
          <p className="text-[11px] text-campo-400">
            (lámina por hectárea × hectáreas de cada cuadro, sumado; el detalle por cuadro está abajo)
          </p>
        </div>
      </div>

      {/* Grafica de barras: horas por mes */}
      <div className="card mb-6 p-4">
        <h2 className="mb-1 text-sm font-semibold text-campo-800">Horas de riego por mes</h2>
        <p className="mb-3 text-xs text-campo-500">
          Muestra los meses dentro del rango "Desde/Hasta" de arriba — amplía el rango para ver más meses (ej. julio, agosto, septiembre).
        </p>
        {porMes.length === 0 && <p className="text-sm text-campo-400">Sin datos.</p>}
        <div className="space-y-2">
          {porMes.map((m) => (
            <div key={m.mes} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-campo-600">{m.mes}</span>
              <div className="h-4 flex-1 rounded bg-campo-50">
                <div
                  className="h-4 rounded bg-campo-500"
                  style={{ width: `${(m.horas / maxHorasMes) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs text-campo-700">{m.horas.toFixed(1)} h</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grafica de barras: horas por cuadro */}
      <div className="card mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-campo-800">Horas de riego por cuadro</h2>
        {porCuadro.length === 0 && <p className="text-sm text-campo-400">Sin datos.</p>}
        <div className="space-y-2">
          {porCuadro.slice(0, 20).map((c) => (
            <div key={c.nombre} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs text-campo-600">{c.nombre}</span>
              <div className="h-4 flex-1 rounded bg-campo-50">
                <div
                  className="h-4 rounded bg-tierra-400"
                  style={{ width: `${(c.horas / maxHorasCuadro) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs text-campo-700">{c.horas.toFixed(1)} h</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Detalle por cuadro</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Hectáreas</th>
              <th className="px-4 py-2">No. riegos</th>
              <th className="px-4 py-2">Horas totales</th>
              <th className="px-4 py-2">Lámina/ha (mm)</th>
              <th className="px-4 py-2">Lámina/ha promedio por riego</th>
              <th className="px-4 py-2">Lámina total (mm)</th>
            </tr>
          </thead>
          <tbody>
            {porCuadro.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={8}>Sin datos en el rango seleccionado.</td></tr>
            )}
            {porCuadro.map((c) => (
              <tr key={c.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{c.campo}</td>
                <td className="px-4 py-2 text-campo-800">{c.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{c.hectareas || "—"}</td>
                <td className="px-4 py-2 text-campo-800">{c.riegos}</td>
                <td className="px-4 py-2 text-campo-800">{c.horas.toFixed(1)} h</td>
                <td className="px-4 py-2 text-campo-800">
                  {c.laminaHa > 0 ? `${c.laminaHa.toFixed(1)} mm` : "— (falta definir sistema de riego)"}
                </td>
                <td className="px-4 py-2 text-campo-800">
                  {c.laminaHa > 0 ? `${(c.laminaHa / c.riegos).toFixed(1)} mm` : "—"}
                </td>
                <td className="px-4 py-2 text-campo-800">
                  {c.laminaTotal > 0 ? `${c.laminaTotal.toFixed(1)} mm` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
