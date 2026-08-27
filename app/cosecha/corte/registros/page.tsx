"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelCorte } from "@/lib/excel/corte";
import { generarPdfCorte } from "@/lib/pdf/corte";

type Opcion = { id: string; label: string };

export default function RegistrosCortePage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [distribuidorId, setDistribuidorId] = useState("");

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
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("corte_diario")
      .select(
        "id, fecha, tipo_unidad, cantidad_unidades, cajas, campos(nombre), cuadros(nombre), cultivos(nombre), distribuidores(nombre), calibres(nombre)"
      )
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .order("fecha", { ascending: false });

    if (campoId) query = query.eq("campo_id", campoId);
    if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

    const { data, error } = await query.limit(5000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este renglón de corte? No se puede deshacer.")) return;
    const { error } = await supabase.from("corte_diario").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  const totalCajas = registros.reduce((s, r) => s + Number(r.cajas ?? 0), 0);
  const rango = `${fechaInicio}_a_${fechaFin}`;

  function filasParaExport() {
    return registros.map((r: any) => ({
      fecha: r.fecha,
      campo: r.campos?.nombre ?? "",
      cuadro: r.cuadros?.nombre ?? "",
      cultivo: r.cultivos?.nombre ?? "",
      distribuidor: r.distribuidores?.nombre ?? "",
      calibre: r.calibres?.nombre ?? "",
      tipoUnidad: r.tipo_unidad,
      unidades: Number(r.cantidad_unidades),
      cajas: Number(r.cajas),
    }));
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Registros de corte</h1>
      <p className="mb-6 text-sm text-campo-600">Historial de todo lo capturado en Corte diario.</p>

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
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
          <button className="btn-secondary" onClick={() => generarExcelCorte(filasParaExport(), rango)}>
            Excel
          </button>
          <button className="btn-secondary" onClick={() => generarPdfCorte(filasParaExport(), rango)}>
            PDF
          </button>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <p className="text-xs text-campo-500">Total cajas en el rango</p>
        <p className="text-2xl font-semibold text-campo-900">{totalCajas.toLocaleString()}</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Distribuidor</th>
              <th className="px-4 py-2">Calibre</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Unidades</th>
              <th className="px-4 py-2">Cajas</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={9}>Cargando...</td></tr>}
            {!loading && registros.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={9}>Sin registros en el rango seleccionado.</td></tr>
            )}
            {registros.map((r: any) => (
              <tr key={r.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{r.fecha}</td>
                <td className="px-4 py-2 text-campo-800">{r.campos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{r.cuadros?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{r.distribuidores?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{r.calibres?.nombre}</td>
                <td className="px-4 py-2 text-campo-600 capitalize">{r.tipo_unidad}</td>
                <td className="px-4 py-2 text-campo-800">{r.cantidad_unidades}</td>
                <td className="px-4 py-2 text-campo-800">{Number(r.cajas).toFixed(0)}</td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-danger" onClick={() => eliminar(r.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
