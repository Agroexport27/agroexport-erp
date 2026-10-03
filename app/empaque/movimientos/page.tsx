"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fechaLocalHoy } from "@/lib/fechaLocal";

type Opcion = { id: string; label: string };

export default function MovimientosMaterialesPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [materiales, setMateriales] = useState<Opcion[]>([]);
  const [recientes, setRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [campoId, setCampoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [materialTexto, setMaterialTexto] = useState("");
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  // --- edición inline ---
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edFecha, setEdFecha] = useState("");
  const [edCampoId, setEdCampoId] = useState("");
  const [edTipo, setEdTipo] = useState<"entrada" | "salida">("entrada");
  const [edMaterialTexto, setEdMaterialTexto] = useState("");
  const [edMaterialId, setEdMaterialId] = useState<string | null>(null);
  const [edCantidad, setEdCantidad] = useState("");
  const [edObservaciones, setEdObservaciones] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }));
        setCampos(opciones);
        if (opciones.length > 0) setCampoId(opciones[0].id);
      });
    supabase
      .from("materiales_empaque")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setMateriales((data ?? []).map((m: any) => ({ id: m.id, label: m.nombre }))));
  }, []);

  async function cargarRecientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("movimiento_material_empaque")
      .select("id, fecha, tipo, cantidad, observaciones, origen_tipo, material_id, campo_id, campos(nombre), materiales_empaque(nombre)")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(30);
    if (error) setError(error.message);
    else setRecientes(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarRecientes();
  }, []);

  function manejarTextoMaterial(texto: string) {
    const match = materiales.find((m) => m.label === texto);
    setMaterialTexto(texto);
    setMaterialId(match ? match.id : null);
  }

  function manejarTextoMaterialEdicion(texto: string) {
    const match = materiales.find((m) => m.label === texto);
    setEdMaterialTexto(texto);
    setEdMaterialId(match ? match.id : null);
  }

  async function recalcularStock(materialId: string, campoId: string) {
    const { data } = await supabase
      .from("movimiento_material_empaque")
      .select("tipo, cantidad")
      .eq("material_id", materialId)
      .eq("campo_id", campoId);
    const stock = (data ?? []).reduce(
      (acc: number, m: any) => acc + (m.tipo === "entrada" ? Number(m.cantidad) : -Number(m.cantidad)),
      0
    );
    await supabase
      .from("inventario_materiales_empaque")
      .upsert({ material_id: materialId, campo_id: campoId, stock_actual: stock }, { onConflict: "material_id,campo_id" });
  }

  async function guardar() {
    if (!campoId || !materialId || !cantidad) {
      setError("Selecciona campo, material (de la lista) y cantidad.");
      return;
    }
    setGuardando(true);
    setError(null);
    const { error } = await supabase.from("movimiento_material_empaque").insert({
      material_id: materialId,
      campo_id: campoId,
      fecha,
      tipo,
      cantidad: parseFloat(cantidad),
      observaciones: observaciones || null,
      origen_tipo: "ajuste_manual",
    });
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMensajeExito(`${tipo === "entrada" ? "Entrada" : "Salida"} de ${cantidad} guardada.`);
    setMaterialTexto("");
    setMaterialId(null);
    setCantidad("");
    setObservaciones("");
    cargarRecientes();
    setTimeout(() => setMensajeExito(null), 4000);
  }

  async function eliminar(m: any) {
    if (!confirm("¿Eliminar este movimiento? Se revierte del inventario. No se puede deshacer.")) return;
    const { error } = await supabase.from("movimiento_material_empaque").delete().eq("id", m.id);
    if (error) {
      setError(error.message);
      return;
    }
    await recalcularStock(m.material_id, m.campo_id);
    cargarRecientes();
  }

  function empezarEdicion(m: any) {
    setEditandoId(m.id);
    setEdFecha(m.fecha);
    setEdCampoId(m.campo_id);
    setEdTipo(m.tipo);
    setEdMaterialTexto(m.materiales_empaque?.nombre ?? "");
    setEdMaterialId(m.material_id);
    setEdCantidad(String(m.cantidad));
    setEdObservaciones(m.observaciones ?? "");
  }

  function cancelarEdicion() {
    setEditandoId(null);
  }

  async function guardarEdicion(m: any) {
    if (!edCampoId || !edMaterialId || !edCantidad) {
      setError("Selecciona campo, material (de la lista) y cantidad.");
      return;
    }
    setGuardandoEdicion(true);
    setError(null);
    const { error } = await supabase
      .from("movimiento_material_empaque")
      .update({
        fecha: edFecha,
        campo_id: edCampoId,
        tipo: edTipo,
        material_id: edMaterialId,
        cantidad: parseFloat(edCantidad),
        observaciones: edObservaciones || null,
      })
      .eq("id", m.id);
    setGuardandoEdicion(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Recalcular stock del material/campo original y, si cambiaron, del nuevo también.
    await recalcularStock(m.material_id, m.campo_id);
    if (edMaterialId !== m.material_id || edCampoId !== m.campo_id) {
      await recalcularStock(edMaterialId, edCampoId);
    }
    setEditandoId(null);
    cargarRecientes();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Entradas y salidas — Materiales</h1>
      <p className="mb-6 text-sm text-campo-600">
        Las salidas por Corte diario se descuentan solas — aquí captura entradas (compras) o ajustes manuales.
      </p>

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

      <div className="card mb-6 p-4">
        <div className="mb-4 flex gap-2">
          <button className={tipo === "entrada" ? "btn-primary" : "btn-secondary"} onClick={() => setTipo("entrada")}>
            Entrada
          </button>
          <button className={tipo === "salida" ? "btn-primary" : "btn-secondary"} onClick={() => setTipo("salida")}>
            Salida (ajuste manual)
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Fecha</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
            <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Material</label>
            <input
              className="input"
              list="materiales-datalist"
              value={materialTexto}
              onChange={(e) => manejarTextoMaterial(e.target.value)}
            />
            <datalist id="materiales-datalist">
              {materiales.map((m) => (
                <option key={m.id} value={m.label} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Cantidad</label>
            <input type="number" step="any" className="input" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="sm:col-span-2 md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-campo-600">Observaciones</label>
            <input className="input" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary mt-4" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Movimientos recientes</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Material</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2">Observaciones</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Cargando...</td></tr>}
            {!loading && recientes.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Todavía no hay movimientos.</td></tr>
            )}
            {recientes.map((m: any) => {
              const editable = !m.origen_tipo || m.origen_tipo === "ajuste_manual";
              return (
                <Fragment key={m.id}>
                  <tr className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">{m.fecha}</td>
                    <td className="px-4 py-2 text-campo-800">{m.campos?.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">{m.materiales_empaque?.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">
                      <span className={m.tipo === "entrada" ? "text-campo-700" : "text-tierra-600"}>{m.tipo}</span>
                    </td>
                    <td className="px-4 py-2 text-campo-800">{m.cantidad}</td>
                    <td className="px-4 py-2 text-campo-600">{m.observaciones ?? "—"}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {editable ? (
                        editandoId === m.id ? (
                          <button className="btn-secondary" onClick={cancelarEdicion}>Cancelar</button>
                        ) : (
                          <span className="inline-flex gap-2">
                            <button className="btn-secondary" onClick={() => empezarEdicion(m)}>Editar</button>
                            <button className="btn-danger" onClick={() => eliminar(m)}>Eliminar</button>
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-campo-400">Viene de un Corte</span>
                      )}
                    </td>
                  </tr>
                  {editandoId === m.id && (
                    <tr className="border-t border-campo-50 bg-campo-50/50">
                      <td className="px-4 py-3" colSpan={7}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Fecha</label>
                            <input type="date" className="input" value={edFecha} onChange={(e) => setEdFecha(e.target.value)} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
                            <select className="input" value={edCampoId} onChange={(e) => setEdCampoId(e.target.value)}>
                              {campos.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Material</label>
                            <input
                              className="input"
                              list="materiales-datalist-edicion"
                              value={edMaterialTexto}
                              onChange={(e) => manejarTextoMaterialEdicion(e.target.value)}
                            />
                            <datalist id="materiales-datalist-edicion">
                              {materiales.map((mm) => (
                                <option key={mm.id} value={mm.label} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Tipo</label>
                            <select className="input" value={edTipo} onChange={(e) => setEdTipo(e.target.value as "entrada" | "salida")}>
                              <option value="entrada">Entrada</option>
                              <option value="salida">Salida</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-campo-600">Cantidad</label>
                            <input type="number" step="any" className="input" value={edCantidad} onChange={(e) => setEdCantidad(e.target.value)} />
                          </div>
                          <div className="sm:col-span-2 md:col-span-3">
                            <label className="mb-1 block text-xs font-medium text-campo-600">Observaciones</label>
                            <input className="input" value={edObservaciones} onChange={(e) => setEdObservaciones(e.target.value)} />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className="btn-primary" onClick={() => guardarEdicion(m)} disabled={guardandoEdicion}>
                            {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                          </button>
                          <button className="btn-secondary" onClick={cancelarEdicion}>Cancelar</button>
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
