"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelEmbarques } from "@/lib/excel/embarques";
import { generarPdfEmbarques } from "@/lib/pdf/embarques";
import { EMPAQUE_OPCIONES } from "@/lib/embarquesConfig";
import MultiSelectCuadros from "@/components/MultiSelectCuadros";
import { generarManifiestoDeRemision } from "@/lib/manifiestoHelper";
import { fechaLocalHoy } from "@/lib/fechaLocal";

type Opcion = { id: string; label: string };

type EdicionManifiesto = {
  fechaEmpaque: string;
  manifiesto: string;
  empaque: string;
  distribuidorId: string;
  cuadroIds: string[];
  detalle: Record<string, { cajas: string; bins: string }>;
  tipoTarima: string;
  cantidadTarimas: string;
  tipoTarima2: string;
  cantidadTarimas2: string;
};

const TIPOS_TARIMA = ["TARIMA CHEP", "TARIMA AZUL", "TARIMA CAFE TACON"];

export default function RegistrosEmbarquesPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<EdicionManifiesto | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [cuadrosPorCampo, setCuadrosPorCampo] = useState<Record<string, Opcion[]>>({});

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(fechaLocalHoy());
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
        "id, fecha_empaque, manifiesto, caja_transporte, empaque, campo_id, distribuidor_id, tipo_tarima, cantidad_tarimas, tipo_tarima_2, cantidad_tarimas_2, campos(nombre), cuadros(nombre), distribuidores(nombre), remision_detalle(id, calibre_id, etiqueta_libre, cantidad_cajas, cantidad_bins, calibres(nombre)), remision_envio_cuadro(cuadro_id, cuadros(nombre))"
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

  // Las salidas de tarima que genera Embarques no quedan ligadas por id al
  // movimiento exacto (así se creaban desde antes), así que en vez de
  // intentar encontrar y borrar el movimiento original, se inserta un
  // movimiento de "entrada" que lo revierte -- nunca se toca ni se arriesga
  // el movimiento de otra remisión.
  async function ajustarInventarioTarima(
    tipoTarimaNombre: string | null,
    cantidad: number,
    campoId: string | null,
    fecha: string,
    tipo: "entrada" | "salida",
    observaciones: string
  ) {
    if (!tipoTarimaNombre || !cantidad || cantidad <= 0 || !campoId) return;
    const { data: material } = await supabase
      .from("materiales_empaque")
      .select("id")
      .eq("nombre", tipoTarimaNombre)
      .maybeSingle();
    if (!material) return;
    await supabase.from("movimiento_material_empaque").insert({
      material_id: material.id,
      campo_id: campoId,
      fecha,
      tipo,
      cantidad,
      observaciones,
      origen_tipo: "embarque",
    });
  }

  async function eliminar(r: any) {
    if (!confirm("¿Eliminar esta remisión completa? No se puede deshacer.")) return;

    if (r.cantidad_tarimas && Number(r.cantidad_tarimas) > 0) {
      await ajustarInventarioTarima(
        r.tipo_tarima,
        Number(r.cantidad_tarimas),
        r.campo_id,
        r.fecha_empaque,
        "entrada",
        `Reversión por eliminar remisión (manifiesto ${r.manifiesto ?? "—"})`
      );
    }
    if (r.cantidad_tarimas_2 && Number(r.cantidad_tarimas_2) > 0) {
      await ajustarInventarioTarima(
        r.tipo_tarima_2,
        Number(r.cantidad_tarimas_2),
        r.campo_id,
        r.fecha_empaque,
        "entrada",
        `Reversión por eliminar remisión (manifiesto ${r.manifiesto ?? "—"})`
      );
    }

    const { error } = await supabase.from("remision_envio").delete().eq("id", r.id);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  async function descargarPdfManifiesto(id: string) {
    setError(null);
    try {
      await generarManifiestoDeRemision(supabase, id);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo generar el PDF del manifiesto.");
    }
  }

  async function cuadrosDelCampo(campoId: string): Promise<Opcion[]> {
    if (cuadrosPorCampo[campoId]) return cuadrosPorCampo[campoId];
    const { data } = await supabase
      .from("cuadros")
      .select("id, nombre, orden")
      .eq("campo_id", campoId)
      .order("orden");
    const opciones = (data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }));
    setCuadrosPorCampo((prev) => ({ ...prev, [campoId]: opciones }));
    return opciones;
  }

  async function empezarEdicion(r: any) {
    setError(null);
    if (r.campo_id) await cuadrosDelCampo(r.campo_id);
    const cuadroIdsIniciales =
      (r.remision_envio_cuadro ?? []).map((x: any) => x.cuadro_id).filter(Boolean) ??
      [];
    const detalle: Record<string, { cajas: string; bins: string }> = {};
    for (const d of r.remision_detalle ?? []) {
      detalle[d.id] = {
        cajas: Number(d.cantidad_cajas ?? 0) > 0 ? String(d.cantidad_cajas) : "",
        bins: Number(d.cantidad_bins ?? 0) > 0 ? String(d.cantidad_bins) : "",
      };
    }
    setEdicion({
      fechaEmpaque: r.fecha_empaque,
      manifiesto: r.manifiesto ?? "",
      empaque: r.empaque ?? EMPAQUE_OPCIONES[0],
      distribuidorId: r.distribuidor_id ?? "",
      cuadroIds: cuadroIdsIniciales,
      detalle,
      tipoTarima: r.tipo_tarima ?? TIPOS_TARIMA[0],
      cantidadTarimas: Number(r.cantidad_tarimas ?? 0) > 0 ? String(r.cantidad_tarimas) : "",
      tipoTarima2: r.tipo_tarima_2 ?? "",
      cantidadTarimas2: Number(r.cantidad_tarimas_2 ?? 0) > 0 ? String(r.cantidad_tarimas_2) : "",
    });
    setEditandoId(r.id);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEdicion(null);
  }

  function actualizarDetalleEdicion(detalleId: string, campo: "cajas" | "bins", valor: string) {
    setEdicion((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        detalle: {
          ...prev.detalle,
          [detalleId]: { ...prev.detalle[detalleId], [campo]: valor },
        },
      };
    });
  }

  async function guardarEdicion(r: any) {
    if (!edicion) return;
    setGuardandoEdicion(true);
    setError(null);

    const cantidadTarimaNueva = edicion.cantidadTarimas ? parseFloat(edicion.cantidadTarimas) || 0 : 0;
    const cantidadTarimaNueva2 = edicion.cantidadTarimas2 ? parseFloat(edicion.cantidadTarimas2) || 0 : 0;

    const { error: errCab } = await supabase
      .from("remision_envio")
      .update({
        fecha_empaque: edicion.fechaEmpaque,
        manifiesto: edicion.manifiesto || null,
        empaque: edicion.empaque,
        distribuidor_id: edicion.distribuidorId || null,
        cuadro_id: edicion.cuadroIds[0] ?? null,
        tipo_tarima: cantidadTarimaNueva > 0 ? edicion.tipoTarima : null,
        cantidad_tarimas: cantidadTarimaNueva > 0 ? cantidadTarimaNueva : null,
        tipo_tarima_2: cantidadTarimaNueva2 > 0 ? edicion.tipoTarima2 : null,
        cantidad_tarimas_2: cantidadTarimaNueva2 > 0 ? cantidadTarimaNueva2 : null,
      })
      .eq("id", r.id);

    if (errCab) {
      setError(errCab.message);
      setGuardandoEdicion(false);
      return;
    }

    // Si la tarima (tipo o cantidad) cambió, revertir lo anterior y aplicar
    // lo nuevo -- nunca se edita el movimiento original, se agregan
    // movimientos de ajuste (mismo patrón que usa Corte). Se hace igual
    // para los dos posibles tipos de tarima del embarque.
    async function reconciliarTarima(
      nombreAnterior: string | null,
      cantidadAnterior: number,
      nombreNuevo: string | null,
      cantidadNueva: number
    ) {
      const cambio = nombreAnterior !== nombreNuevo || cantidadAnterior !== cantidadNueva;
      if (!cambio) return;
      if (cantidadAnterior > 0) {
        await ajustarInventarioTarima(
          nombreAnterior,
          cantidadAnterior,
          r.campo_id,
          edicion!.fechaEmpaque,
          "entrada",
          `Reversión por editar remisión (manifiesto ${r.manifiesto ?? "—"})`
        );
      }
      if (cantidadNueva > 0) {
        await ajustarInventarioTarima(
          nombreNuevo,
          cantidadNueva,
          r.campo_id,
          edicion!.fechaEmpaque,
          "salida",
          `Tarimas entregadas (editado, manifiesto ${edicion!.manifiesto || "—"})`
        );
      }
    }

    await reconciliarTarima(
      r.tipo_tarima ?? null,
      Number(r.cantidad_tarimas ?? 0),
      cantidadTarimaNueva > 0 ? edicion.tipoTarima : null,
      cantidadTarimaNueva
    );
    await reconciliarTarima(
      r.tipo_tarima_2 ?? null,
      Number(r.cantidad_tarimas_2 ?? 0),
      cantidadTarimaNueva2 > 0 ? edicion.tipoTarima2 : null,
      cantidadTarimaNueva2
    );

    // Reemplazar los cuadros asociados con la selección actual
    await supabase.from("remision_envio_cuadro").delete().eq("remision_id", r.id);
    if (edicion.cuadroIds.length > 0) {
      const { error: errCuadros } = await supabase
        .from("remision_envio_cuadro")
        .insert(edicion.cuadroIds.map((cuadroId) => ({ remision_id: r.id, cuadro_id: cuadroId })));
      if (errCuadros) {
        setError(errCuadros.message);
        setGuardandoEdicion(false);
        return;
      }
    }

    const actualizacionesDetalle = Object.entries(edicion.detalle).map(([detalleId, valores]) =>
      supabase
        .from("remision_detalle")
        .update({
          cantidad_cajas: parseFloat(valores.cajas || "0") || 0,
          cantidad_bins: parseFloat(valores.bins || "0") || 0,
        })
        .eq("id", detalleId)
    );
    const resultados = await Promise.all(actualizacionesDetalle);
    const errDet = resultados.find((res) => res.error)?.error;

    setGuardandoEdicion(false);
    if (errDet) {
      setError(errDet.message);
      return;
    }

    cancelarEdicion();
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
        calibre: d.calibres?.nombre ? (d.etiqueta_libre ? `${d.calibres.nombre} ${d.etiqueta_libre}` : d.calibres.nombre) : (d.etiqueta_libre ?? ""),
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
                <Fragment key={r.id}>
                  <tr className="border-t border-campo-50">
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
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {editandoId === r.id ? (
                        <button className="btn-secondary" onClick={cancelarEdicion}>
                          Cerrar
                        </button>
                      ) : (
                        <>
                          <button className="btn-secondary mr-1" onClick={() => descargarPdfManifiesto(r.id)}>
                            PDF
                          </button>
                          <button className="btn-secondary mr-1" onClick={() => empezarEdicion(r)}>
                            Editar
                          </button>
                          <button className="btn-danger" onClick={() => eliminar(r)}>
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {editandoId === r.id && edicion && (
                    <tr className="border-t border-campo-100 bg-campo-50">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Fecha de empaque</label>
                            <input
                              type="date"
                              className="input"
                              value={edicion.fechaEmpaque}
                              onChange={(e) => setEdicion({ ...edicion, fechaEmpaque: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Manifiesto</label>
                            <input
                              className="input"
                              value={edicion.manifiesto}
                              onChange={(e) => setEdicion({ ...edicion, manifiesto: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Empaque</label>
                            <select
                              className="input"
                              value={edicion.empaque}
                              onChange={(e) => setEdicion({ ...edicion, empaque: e.target.value })}
                            >
                              {EMPAQUE_OPCIONES.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Distribuidor</label>
                            <select
                              className="input"
                              value={edicion.distribuidorId}
                              onChange={(e) => setEdicion({ ...edicion, distribuidorId: e.target.value })}
                            >
                              <option value="">Selecciona...</option>
                              {distribuidores.map((d) => (
                                <option key={d.id} value={d.id}>{d.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2 md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-campo-600">Cuadro(s)</label>
                            <MultiSelectCuadros
                              opciones={cuadrosPorCampo[r.campo_id] ?? []}
                              seleccionados={edicion.cuadroIds}
                              onChange={(ids) => setEdicion({ ...edicion, cuadroIds: ids })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Tipo de tarima</label>
                            <select
                              className="input"
                              value={edicion.tipoTarima}
                              onChange={(e) => setEdicion({ ...edicion, tipoTarima: e.target.value })}
                            >
                              {TIPOS_TARIMA.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Cantidad de tarimas</label>
                            <input
                              type="number"
                              step="any"
                              min={0}
                              className="input"
                              value={edicion.cantidadTarimas}
                              onChange={(e) => setEdicion({ ...edicion, cantidadTarimas: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">2do tipo de tarima</label>
                            <select
                              className="input"
                              value={edicion.tipoTarima2}
                              onChange={(e) => setEdicion({ ...edicion, tipoTarima2: e.target.value })}
                            >
                              <option value="">Ninguno</option>
                              {TIPOS_TARIMA.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Cantidad (2do tipo)</label>
                            <input
                              type="number"
                              step="any"
                              min={0}
                              className="input"
                              value={edicion.cantidadTarimas2}
                              onChange={(e) => setEdicion({ ...edicion, cantidadTarimas2: e.target.value })}
                              disabled={!edicion.tipoTarima2}
                            />
                          </div>
                        </div>

                        {(r.remision_detalle ?? []).length > 0 && (
                          <div className="mb-3">
                            <p className="mb-1 text-xs font-medium text-campo-600">Cantidades capturadas</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                              {(r.remision_detalle ?? []).map((d: any) => (
                                <div key={d.id} className="rounded-md border border-campo-200 bg-white p-2">
                                  <p className="mb-1 text-[11px] text-campo-500">
                                    {d.calibres?.nombre ? (d.etiqueta_libre ? `${d.calibres.nombre} · ${d.etiqueta_libre}` : d.calibres.nombre) : (d.etiqueta_libre ?? "—")}
                                  </p>
                                  <div className="flex gap-1">
                                    <div className="flex-1">
                                      <label className="block text-[10px] text-campo-400">Cajas</label>
                                      <input
                                        type="number"
                                        step="any"
                                        min={0}
                                        className="input px-2 py-1 text-xs"
                                        value={edicion.detalle[d.id]?.cajas ?? ""}
                                        onChange={(e) => actualizarDetalleEdicion(d.id, "cajas", e.target.value)}
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-[10px] text-campo-400">Bins</label>
                                      <input
                                        type="number"
                                        step="any"
                                        min={0}
                                        className="input px-2 py-1 text-xs"
                                        value={edicion.detalle[d.id]?.bins ?? ""}
                                        onChange={(e) => actualizarDetalleEdicion(d.id, "bins", e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            className="btn-primary"
                            onClick={() => guardarEdicion(r)}
                            disabled={guardandoEdicion}
                          >
                            {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                          </button>
                          <button className="btn-secondary" onClick={cancelarEdicion} disabled={guardandoEdicion}>
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
