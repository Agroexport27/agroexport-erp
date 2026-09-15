"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { id: string; label: string };

export default function InventarioCosechaPage() {
  const supabase = createClient();

  const [ciclos, setCiclos] = useState<{ id: string; clave: string; fecha_inicio: string; fecha_fin: string }[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [cultivoId, setCultivoId] = useState("");

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cortado, setCortado] = useState<any[]>([]);
  const [embarcado, setEmbarcado] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("ciclos")
      .select("id, clave, fecha_inicio, fecha_fin")
      .order("clave", { ascending: false })
      .then(({ data }) => {
        setCiclos(data ?? []);
        if (data && data.length > 0) {
          setCicloId(data[0].id);
          setFechaInicio(data[0].fecha_inicio);
          setFechaFin(data[0].fecha_fin);
        }
      });
    supabase
      .from("cultivos")
      .select("id, nombre")
      .neq("nombre", "Solarizado")
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }));
        setCultivos(opciones);
        const mini = opciones.find((c: any) => c.label === "Sandía Mini");
        setCultivoId(mini ? mini.id : opciones[0]?.id ?? "");
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
    if (!fechaInicio || !fechaFin || !cultivoId) return;
    setLoading(true);
    setError(null);

    const [{ data: corte, error: errCorte }, { data: envios, error: errEnvios }] = await Promise.all([
      supabase
        .from("corte_diario")
        .select("cajas, distribuidor_id, distribuidores(nombre), calibre_id, calibres(nombre)")
        .eq("cultivo_id", cultivoId)
        .eq("tipo_unidad", "pallet")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin),
      supabase
        .from("remision_detalle")
        .select(
          "cantidad_cajas, calibre_id, calibres(nombre), remision_envio!inner(distribuidor_id, fecha_empaque, cultivo_id, distribuidores(nombre))"
        )
        .eq("remision_envio.cultivo_id", cultivoId)
        .gte("remision_envio.fecha_empaque", fechaInicio)
        .lte("remision_envio.fecha_empaque", fechaFin)
        .not("calibre_id", "is", null),
    ]);

    if (errCorte) setError(errCorte.message);
    if (errEnvios) setError(errEnvios.message);
    setCortado(corte ?? []);
    setEmbarcado(envios ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId, cultivoId]);

  const comparativo = useMemo(() => {
    // key: distribuidor__calibre
    const mapa = new Map<
      string,
      { distribuidor: string; calibre: string; cortado: number; embarcado: number }
    >();

    for (const r of cortado) {
      const dist = r.distribuidores?.nombre ?? "Sin distribuidor";
      const cal = r.calibres?.nombre ?? "Sin calibre";
      const key = `${dist}__${cal}`;
      const item = mapa.get(key) ?? { distribuidor: dist, calibre: cal, cortado: 0, embarcado: 0 };
      item.cortado += Number(r.cajas ?? 0);
      mapa.set(key, item);
    }
    for (const r of embarcado) {
      const dist = r.remision_envio?.distribuidores?.nombre ?? "Sin distribuidor";
      const cal = r.calibres?.nombre ?? "Sin calibre";
      const key = `${dist}__${cal}`;
      const item = mapa.get(key) ?? { distribuidor: dist, calibre: cal, cortado: 0, embarcado: 0 };
      item.embarcado += Number(r.cantidad_cajas ?? 0);
      mapa.set(key, item);
    }

    const filas = Array.from(mapa.values())
      .map((f) => ({ ...f, diferencia: f.cortado - f.embarcado }))
      .sort((a, b) => a.distribuidor.localeCompare(b.distribuidor) || a.calibre.localeCompare(b.calibre));

    const totalCortado = filas.reduce((s, f) => s + f.cortado, 0);
    const totalEmbarcado = filas.reduce((s, f) => s + f.embarcado, 0);
    const totalDiferencia = totalCortado - totalEmbarcado;

    const porDistribuidor = new Map<string, { cortado: number; embarcado: number }>();
    for (const f of filas) {
      const item = porDistribuidor.get(f.distribuidor) ?? { cortado: 0, embarcado: 0 };
      item.cortado += f.cortado;
      item.embarcado += f.embarcado;
      porDistribuidor.set(f.distribuidor, item);
    }

    return { filas, totalCortado, totalEmbarcado, totalDiferencia, porDistribuidor };
  }, [cortado, embarcado]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Inventario — Corte vs Embarques</h1>
      <p className="mb-6 text-sm text-campo-600">
        La diferencia entre lo que se empacó y lo que ya se exportó — es lo que debería quedar en piso.
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
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Cultivo</label>
          <select className="input" value={cultivoId} onChange={(e) => setCultivoId(e.target.value)}>
            {cultivos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
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
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total cortado</p>
          <p className="text-2xl font-semibold text-campo-900">{comparativo.totalCortado.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total embarcado</p>
          <p className="text-2xl font-semibold text-campo-900">{comparativo.totalEmbarcado.toLocaleString()}</p>
        </div>
        <div className="card border-2 border-tierra-300 p-4">
          <p className="text-xs text-campo-500">En piso (diferencia)</p>
          <p className="text-2xl font-bold text-tierra-700">{comparativo.totalDiferencia.toLocaleString()}</p>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Por distribuidor</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Distribuidor</th>
              <th className="px-4 py-2 text-center">Cortado</th>
              <th className="px-4 py-2 text-center">Embarcado</th>
              <th className="px-4 py-2 text-center">En piso</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(comparativo.porDistribuidor.entries()).map(([dist, v]) => (
              <tr key={dist} className="border-t border-campo-50">
                <td className="px-4 py-1 text-campo-800">{dist}</td>
                <td className="px-4 py-1 text-center text-campo-800">{v.cortado.toFixed(0)}</td>
                <td className="px-4 py-1 text-center text-campo-800">{v.embarcado.toFixed(0)}</td>
                <td className="px-4 py-1 text-center font-medium text-tierra-700">
                  {(v.cortado - v.embarcado).toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Detalle por distribuidor y calibre</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Distribuidor</th>
              <th className="px-4 py-2">Calibre</th>
              <th className="px-4 py-2 text-center">Cortado</th>
              <th className="px-4 py-2 text-center">Embarcado</th>
              <th className="px-4 py-2 text-center">En piso</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={5}>Cargando...</td></tr>}
            {!loading && comparativo.filas.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={5}>Sin datos en el rango.</td></tr>
            )}
            {comparativo.filas.map((f) => (
              <tr key={`${f.distribuidor}__${f.calibre}`} className="border-t border-campo-50">
                <td className="px-4 py-1 text-campo-800">{f.distribuidor}</td>
                <td className="px-4 py-1 text-campo-800">{f.calibre}</td>
                <td className="px-4 py-1 text-center text-campo-800">{f.cortado.toFixed(0)}</td>
                <td className="px-4 py-1 text-center text-campo-800">{f.embarcado.toFixed(0)}</td>
                <td className={`px-4 py-1 text-center font-medium ${f.diferencia !== 0 ? "text-tierra-700" : "text-campo-400"}`}>
                  {f.diferencia.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-campo-500">
        Nota: esta comparación es solo para cajas (pallets) por calibre — los bins de Corte y de
        Embarques usan medidas distintas y todavía no se pueden reconciliar de la misma forma.
      </p>
    </div>
  );
}
