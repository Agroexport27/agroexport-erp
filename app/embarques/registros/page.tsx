"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelEmbarques } from "@/lib/excel/embarques";
import { generarPdfEmbarques } from "@/lib/pdf/embarques";

type Opcion = { id: string; label: string };

export default function RegistrosEmbarquesPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [distribuidorId, setDistribuidorId] = useState("");
  const [cultivoId, setCultivoId] = useState("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
    supabase
      .from("distribuidores")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setDistribuidores((data ?? []).map((d: any) => ({ id: d.id, label: d.nombre }))));
    supabase
      .from("cultivos")
      .select("id, nombre")
      .neq("nombre", "Solarizado")
      .order("nombre")
      .then(({ data }) => setCultivos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("remision_envio")
      .select(
        "id, fecha_empaque, manifiesto, caja_transporte, empaque, campos(nombre), cuadros(nombre), distribuidores(nombre), remision_detalle(calibre_id, etiqueta_libre, cantidad_cajas, cantidad_bins, calibres(nombre)), remision_envio_cuadro(cuadros(nombre))"
      )
      .gte("fecha_empaque", fechaInicio)
      .lte("fecha_empaque", fechaFin)
      .order("fecha_empaque", { ascending: false });

    if (campoId) query = query.eq("campo_id", campoId);
    if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);
    if (cultivoId) query = query.eq("cultivo_id", cultivoId);

    const { data, error } = await query.limit(2000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta remisión completa? No se puede deshacer.")) return;
    const { error } = await supabase.from("remision_envio").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  function totalesDe(r: any) {
    const cajas = (r.remision_detalle ?? []).reduce((s: number, d: any) => s + Number(d.cantidad_cajas ?? 0), 0);
    const bins = (r.remision_detalle ?? []).reduce((s: number, d: any) => s + Number(d.cantidad_bins ?? 0), 0);
    return { cajas, bins };
  }

  const totalCajas = registros.reduce((s, r) => s + totalesDe(r).cajas, 0);
  const totalBins = registros.reduce((s, r) => s + totalesDe(r).bins, 0);
  const rango = `${fechaInicio}_a_${fechaFin}`;

  function filasParaExport() {
    return registros.flatMap((r: any) =>
      (r.remision_detalle ?? []).map((d: any) => ({
        fecha: r.fecha_empaque,
        campo: r.campos?.nombre ?? "",
        cuadro:
          (r.remision_envio_cuadro ?? []).map((x: any) => x.cuadros?.nombre).filter(Boolean).join(", ") ||
          r.cuadros?.nombre ||
          "",
        distribuidor: r.distribuidores?.nombre ?? "",
        manifiesto: r.manifiesto ?? "",
        empaque: r.empaque ?? "",
        calibre: d.calibres?.nombre ?? d.etiqueta_libre ?? "",
        cajas: Number(d.cantidad_cajas ?? 0),
        bins: Number(d.cantidad_bins ?? 0),
      }))
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Registros de embarques</h1>
      <p className="mb-6 text-sm text-campo-600">Historial de todas las remisiones capturadas.</p>

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
          <label className="mb-1 block text-xs font-medium text-campo-600">Distribuidor</label>
          <select className="input" value={distribuidorId} onChange={(e) => setDistribuidorId(e.target.value)}>
            <option value="">Todos</option>
            {distribuidores.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Cultivo</label>
          <select className="input" value={cultivoId} onChange={(e) => setCultivoId(e.target.value)}>
            <option value="">Todos</option>
            {cultivos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
          <button className="btn-secondary" onClick={() => generarExcelEmbarques(filasParaExport(), rango)}>
            Excel
          </button>
          <button className="btn-secondary" onClick={() => generarPdfEmbarques(filasParaExport(), rango)}>
            PDF
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total cajas</p>
          <p className="text-2xl font-semibold text-campo-900">{totalCajas.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total bins</p>
          <p className="text-2xl font-semibold text-campo-900">{totalBins.toLocaleString()}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Distribuidor</th>
              <th className="px-4 py-2">Manifiesto</th>
              <th className="px-4 py-2">Empaque</th>
              <th className="px-4 py-2">Cajas</th>
              <th className="px-4 py-2">Bins</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={9}>Cargando...</td></tr>}
            {!loading && registros.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={9}>Sin registros en el rango seleccionado.</td></tr>
            )}
            {registros.map((r: any) => {
              const t = totalesDe(r);
              return (
                <tr key={r.id} className="border-t border-campo-50">
                  <td className="px-4 py-2 text-campo-800">{r.fecha_empaque}</td>
                  <td className="px-4 py-2 text-campo-800">{r.campos?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">
                    {(r.remision_envio_cuadro ?? []).map((x: any) => x.cuadros?.nombre).filter(Boolean).join(", ") ||
                      r.cuadros?.nombre ||
                      "—"}
                  </td>
                  <td className="px-4 py-2 text-campo-800">{r.distribuidores?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">{r.manifiesto ?? "—"}</td>
                  <td className="px-4 py-2 text-campo-600">{r.empaque}</td>
                  <td className="px-4 py-2 text-campo-800">{t.cajas.toFixed(0)}</td>
                  <td className="px-4 py-2 text-campo-800">{t.bins > 0 ? t.bins.toFixed(0) : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="btn-danger" onClick={() => eliminar(r.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
