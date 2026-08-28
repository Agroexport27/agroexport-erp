"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CONFIG_EMBARQUES, EMPAQUE_OPCIONES } from "@/lib/embarquesConfig";

type Opcion = { id: string; label: string };

export default function EmbarquesPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [campoId, setCampoId] = useState("");
  const [cuadros, setCuadros] = useState<Opcion[]>([]);
  const [cuadroId, setCuadroId] = useState("");
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [distribuidorNombre, setDistribuidorNombre] = useState("");
  const [calibres, setCalibres] = useState<{ id: string; nombre: string }[]>([]);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [manifiesto, setManifiesto] = useState("");
  const [cajaTransporte, setCajaTransporte] = useState("");
  const [empaque, setEmpaque] = useState("Convencional");

  const [valoresCajas, setValoresCajas] = useState<Record<string, string>>({});
  const [valoresBins, setValoresBins] = useState<Record<string, string>>({});

  const [recientes, setRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

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
      .eq("activo", true)
      .order("orden", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        const opciones = (data ?? []).map((d: any) => ({ id: d.id, label: d.nombre }));
        setDistribuidores(opciones);
        const primero = opciones.find((d: any) => CONFIG_EMBARQUES[d.label]);
        if (primero) setDistribuidorNombre(primero.label);
      });

    supabase
      .from("cultivos")
      .select("id")
      .eq("nombre", "Sandía Mini")
      .maybeSingle()
      .then(async ({ data: cultivo }) => {
        if (!cultivo) return;
        const { data } = await supabase
          .from("calibres")
          .select("id, nombre")
          .eq("cultivo_id", cultivo.id);
        setCalibres(data ?? []);
      });
  }, []);

  useEffect(() => {
    if (!campoId) return;
    supabase
      .from("cuadros")
      .select("id, nombre, orden")
      .eq("campo_id", campoId)
      .order("orden")
      .then(({ data }) => setCuadros((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
  }, [campoId]);

  async function cargarRecientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("remision_envio")
      .select(
        "id, fecha_empaque, manifiesto, caja_transporte, empaque, campos(nombre), cuadros(nombre), distribuidores(nombre), remision_detalle(cantidad_cajas, cantidad_bins)"
      )
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) setError(error.message);
    else setRecientes(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarRecientes();
  }, []);

  const config = distribuidorNombre ? CONFIG_EMBARQUES[distribuidorNombre] : null;

  const totalCajas = useMemo(
    () => Object.values(valoresCajas).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [valoresCajas]
  );
  const totalBins = useMemo(
    () => Object.values(valoresBins).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [valoresBins]
  );

  async function guardar() {
    if (!campoId || !distribuidorNombre || !config) {
      setError("Selecciona campo y distribuidor.");
      return;
    }
    if (totalCajas === 0 && totalBins === 0) {
      setError("No hay ninguna cantidad capturada todavía.");
      return;
    }
    setGuardando(true);
    setError(null);

    const distribuidorId = distribuidores.find((d) => d.label === distribuidorNombre)?.id;
    const { data: remision, error: errRem } = await supabase
      .from("remision_envio")
      .insert({
        distribuidor_id: distribuidorId,
        fecha_empaque: fecha,
        manifiesto: manifiesto || null,
        cuadro_id: cuadroId || null,
        caja_transporte: cajaTransporte || null,
        campo_id: campoId,
        empaque,
      })
      .select("id")
      .single();

    if (errRem || !remision) {
      setError(errRem?.message ?? "No se pudo crear la remisión.");
      setGuardando(false);
      return;
    }

    const detalle: any[] = [];
    for (const nombreCal of config.cajas) {
      const cantidad = parseFloat(valoresCajas[nombreCal] || "0");
      if (cantidad <= 0) continue;
      const calibreId = calibres.find((c) => c.nombre === nombreCal)?.id;
      detalle.push({
        remision_id: remision.id,
        calibre_id: calibreId ?? null,
        etiqueta_libre: calibreId ? null : nombreCal,
        cantidad_cajas: cantidad,
        cantidad_bins: 0,
      });
    }
    for (const bin of config.bins) {
      const cantidad = parseFloat(valoresBins[bin.etiqueta] || "0");
      if (cantidad <= 0) continue;
      detalle.push({
        remision_id: remision.id,
        calibre_id: null,
        etiqueta_libre: bin.etiqueta,
        cantidad_cajas: 0,
        cantidad_bins: cantidad,
      });
    }

    const { error: errDet } = await supabase.from("remision_detalle").insert(detalle);
    setGuardando(false);
    if (errDet) {
      setError("Se creó la remisión pero falló el detalle: " + errDet.message);
      return;
    }

    setMensajeExito(
      `Remisión guardada: ${totalCajas.toFixed(0)} cajas${totalBins > 0 ? `, ${totalBins.toFixed(0)} bins` : ""}.`
    );
    setManifiesto("");
    setCajaTransporte("");
    setValoresCajas({});
    setValoresBins({});
    cargarRecientes();
    setTimeout(() => setMensajeExito(null), 5000);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Embarques</h1>
      <p className="mb-2 text-sm text-campo-600">
        Lo que realmente se exportó cada día a Nogales, por distribuidor.
      </p>
      <a href="/embarques/registros" className="mb-6 inline-block text-sm text-campo-700 underline">
        Ver todos los registros →
      </a>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {mensajeExito && (
        <div className="mb-4 rounded-md border border-campo-200 bg-campo-50 px-4 py-2 text-sm text-campo-700">
          {mensajeExito}
        </div>
      )}

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Fecha de empaque</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Distribuidor</label>
          <select className="input" value={distribuidorNombre} onChange={(e) => setDistribuidorNombre(e.target.value)}>
            <option value="">Selecciona...</option>
            {distribuidores.map((d) => (
              <option key={d.id} value={d.label} disabled={!CONFIG_EMBARQUES[d.label]}>
                {d.label}{!CONFIG_EMBARQUES[d.label] ? " (próximamente)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Manifiesto</label>
          <input className="input" value={manifiesto} onChange={(e) => setManifiesto(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Caja (unidad transporte)</label>
          <input className="input" value={cajaTransporte} onChange={(e) => setCajaTransporte(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select
            className="input"
            value={campoId}
            onChange={(e) => {
              setCampoId(e.target.value);
              setCuadroId("");
            }}
          >
            <option value="">Selecciona...</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Work Orden / Lote (cuadro)</label>
          <select className="input" value={cuadroId} onChange={(e) => setCuadroId(e.target.value)}>
            <option value="">Selecciona...</option>
            {cuadros.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Empaque</label>
          <select className="input" value={empaque} onChange={(e) => setEmpaque(e.target.value)}>
            {EMPAQUE_OPCIONES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end text-sm text-campo-700">
          <div>
            <span className="text-xs text-campo-500">Total:</span>{" "}
            <span className="font-semibold">
              {totalCajas.toFixed(0)} cajas{totalBins > 0 ? `, ${totalBins.toFixed(0)} bins` : ""}
            </span>
          </div>
        </div>
      </div>

      {config && (
        <div className="card mb-6 p-4">
          <p className="mb-2 text-xs font-medium text-campo-600">Cajas por calibre</p>
          <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
            {config.cajas.map((nombreCal) => (
              <div key={nombreCal}>
                <label className="mb-1 block text-[11px] text-campo-500">{nombreCal}</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="input"
                  value={valoresCajas[nombreCal] ?? ""}
                  onChange={(e) => setValoresCajas({ ...valoresCajas, [nombreCal]: e.target.value })}
                />
              </div>
            ))}
          </div>

          {config.bins.length > 0 && (
            <>
              <p className="mb-2 text-xs font-medium text-campo-600">Bins</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {config.bins.map((bin) => (
                  <div key={bin.etiqueta}>
                    <label className="mb-1 block text-[11px] text-campo-500">{bin.etiqueta}</label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="input"
                      value={valoresBins[bin.etiqueta] ?? ""}
                      onChange={(e) => setValoresBins({ ...valoresBins, [bin.etiqueta]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button className="btn-primary mb-8" onClick={guardar} disabled={guardando || !config}>
        {guardando ? "Guardando..." : "Guardar remisión"}
      </button>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Remisiones recientes</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Distribuidor</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Manifiesto</th>
              <th className="px-4 py-2">Empaque</th>
              <th className="px-4 py-2">Cajas</th>
              <th className="px-4 py-2">Bins</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={8}>Cargando...</td></tr>}
            {!loading && recientes.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={8}>Todavía no hay remisiones.</td></tr>
            )}
            {recientes.map((r: any) => {
              const totalCajasR = (r.remision_detalle ?? []).reduce((s: number, d: any) => s + Number(d.cantidad_cajas ?? 0), 0);
              const totalBinsR = (r.remision_detalle ?? []).reduce((s: number, d: any) => s + Number(d.cantidad_bins ?? 0), 0);
              return (
                <tr key={r.id} className="border-t border-campo-50">
                  <td className="px-4 py-2 text-campo-800">{r.fecha_empaque}</td>
                  <td className="px-4 py-2 text-campo-800">{r.distribuidores?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">{r.campos?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">{r.cuadros?.nombre ?? "—"}</td>
                  <td className="px-4 py-2 text-campo-800">{r.manifiesto ?? "—"}</td>
                  <td className="px-4 py-2 text-campo-600">{r.empaque}</td>
                  <td className="px-4 py-2 text-campo-800">{totalCajasR.toFixed(0)}</td>
                  <td className="px-4 py-2 text-campo-800">{totalBinsR > 0 ? totalBinsR.toFixed(0) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
