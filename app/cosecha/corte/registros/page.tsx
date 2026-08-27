"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelCorte } from "@/lib/excel/corte";
import { generarPdfCorte } from "@/lib/pdf/corte";

type Opcion = { id: string; label: string };

export default function RegistrosCortePage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [calibres, setCalibres] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [distribuidorId, setDistribuidorId] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicionCantidad, setEdicionCantidad] = useState("");

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
      .from("calibres")
      .select("id, cajas_por_pallet, cajas_por_bin")
      .then(({ data }) => setCalibres(data ?? []));
    supabase
      .from("calibre_distribuidor_override")
      .select("calibre_id, distribuidor_id, cajas_por_pallet")
      .then(({ data }) => {
        const mapa: Record<string, Record<string, number>> = {};
        for (const o of (data ?? []) as any[]) {
          mapa[o.distribuidor_id] = mapa[o.distribuidor_id] ?? {};
          mapa[o.distribuidor_id][o.calibre_id] = Number(o.cajas_por_pallet);
        }
        setOverrides(mapa);
      });
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("corte_diario")
      .select(
        "id, fecha, campo_id, distribuidor_id, calibre_id, tipo_unidad, cantidad_unidades, cajas, campos(nombre), cuadros(nombre), cultivos(nombre), distribuidores(nombre), calibres(nombre)"
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

  function tasaEfectiva(distribuidorId: string, calibreId: string, tipoUnidad: string): number {
    const cal = calibres.find((c) => c.id === calibreId);
    if (tipoUnidad === "bins") return Number(cal?.cajas_por_bin ?? 0);
    return overrides[distribuidorId]?.[calibreId] ?? Number(cal?.cajas_por_pallet ?? 0);
  }

  function empezarEdicion(r: any) {
    setEditandoId(r.id);
    setEdicionCantidad(String(r.cantidad_unidades));
  }

  async function guardarEdicion(r: any) {
    const cantidad = parseFloat(edicionCantidad);
    if (isNaN(cantidad) || cantidad < 0) {
      setError("Cantidad inválida.");
      return;
    }
    const tasa = tasaEfectiva(r.distribuidor_id, r.calibre_id, r.tipo_unidad);
    const { error } = await supabase
      .from("corte_diario")
      .update({ cantidad_unidades: cantidad, cajas: cantidad * tasa })
      .eq("id", r.id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditandoId(null);
    consultar();
  }

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

  const grupos = useMemo(() => {
    const mapa = new Map<string, any>();
    for (const r of registros) {
      const key = `${r.fecha}__${r.campos?.nombre ?? ""}`;
      const g =
        mapa.get(key) ??
        { fecha: r.fecha, campo: r.campos?.nombre ?? "", filas: [] as any[], totalCajas: 0 };
      g.filas.push(r);
      g.totalCajas += Number(r.cajas ?? 0);
      mapa.set(key, g);
    }
    return Array.from(mapa.values()).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [registros]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Registros de corte</h1>
      <p className="mb-6 text-sm text-campo-600">Historial de todo lo capturado en Corte diario, agrupado por día y campo.</p>

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

      {loading && <p className="text-sm text-campo-400">Cargando...</p>}
      {!loading && grupos.length === 0 && (
        <p className="text-sm text-campo-400">Sin registros en el rango seleccionado.</p>
      )}

      {grupos.map((g) => (
        <details key={`${g.fecha}__${g.campo}`} className="card mb-2 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
            <span className="text-sm font-medium text-campo-800">
              {g.fecha} — {g.campo}
              <span className="ml-2 font-normal text-campo-500">
                ({g.filas.length} renglón(es) · {g.totalCajas.toFixed(0)} cajas)
              </span>
            </span>
          </summary>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-campo-500">
              <tr>
                <th className="px-4 py-1">Cuadro</th>
                <th className="px-4 py-1">Distribuidor</th>
                <th className="px-4 py-1">Calibre</th>
                <th className="px-4 py-1">Tipo</th>
                <th className="px-4 py-1">Unidades</th>
                <th className="px-4 py-1">Cajas</th>
                <th className="px-4 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {g.filas.map((r: any) =>
                editandoId === r.id ? (
                  <tr key={r.id} className="border-t border-campo-50 bg-campo-50">
                    <td className="px-4 py-1 text-campo-800">{r.cuadros?.nombre}</td>
                    <td className="px-4 py-1 text-campo-800">{r.distribuidores?.nombre}</td>
                    <td className="px-4 py-1 text-campo-800">{r.calibres?.nombre}</td>
                    <td className="px-4 py-1 text-campo-600 capitalize">{r.tipo_unidad}</td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="any"
                        className="input w-20"
                        value={edicionCantidad}
                        onChange={(e) => setEdicionCantidad(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-1 text-campo-600">
                      {(parseFloat(edicionCantidad || "0") * tasaEfectiva(r.distribuidor_id, r.calibre_id, r.tipo_unidad)).toFixed(0)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right">
                      <button className="btn-secondary mr-1" onClick={() => guardarEdicion(r)}>
                        Guardar
                      </button>
                      <button className="btn-secondary" onClick={() => setEditandoId(null)}>
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-t border-campo-50">
                    <td className="px-4 py-1 text-campo-800">{r.cuadros?.nombre}</td>
                    <td className="px-4 py-1 text-campo-800">{r.distribuidores?.nombre}</td>
                    <td className="px-4 py-1 text-campo-800">{r.calibres?.nombre}</td>
                    <td className="px-4 py-1 text-campo-600 capitalize">{r.tipo_unidad}</td>
                    <td className="px-4 py-1 text-campo-800">{r.cantidad_unidades}</td>
                    <td className="px-4 py-1 text-campo-800">{Number(r.cajas).toFixed(0)}</td>
                    <td className="whitespace-nowrap px-4 py-1 text-right">
                      <button className="btn-secondary mr-1" onClick={() => empezarEdicion(r)}>
                        Editar
                      </button>
                      <button className="btn-danger" onClick={() => eliminar(r.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
