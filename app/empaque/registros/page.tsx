"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelInventarioMateriales } from "@/lib/excel/inventarioMateriales";
import { generarPdfInventarioMateriales } from "@/lib/pdf/inventarioMateriales";
import { fechaLocalHoy } from "@/lib/fechaLocal";

type Opcion = { id: string; label: string };

export default function MovimientosHistorialMaterialesPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [materiales, setMateriales] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(fechaLocalHoy());
  const [campoId, setCampoId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [tipo, setTipo] = useState<"" | "entrada" | "salida">("");

  // --- edición inline ---
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edFecha, setEdFecha] = useState("");
  const [edCampoId, setEdCampoId] = useState("");
  const [edTipo, setEdTipo] = useState<"entrada" | "salida">("entrada");
  const [edMaterialId, setEdMaterialId] = useState("");
  const [edCantidad, setEdCantidad] = useState("");
  const [edObservaciones, setEdObservaciones] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
    supabase
      .from("materiales_empaque")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setMateriales((data ?? []).map((m: any) => ({ id: m.id, label: m.nombre }))));
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("movimiento_material_empaque")
      .select("id, fecha, tipo, cantidad, observaciones, origen_tipo, material_id, campo_id, campos(nombre), materiales_empaque(nombre)")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .order("fecha", { ascending: false });

    if (campoId) query = query.eq("campo_id", campoId);
    if (materialId) query = query.eq("material_id", materialId);
    if (tipo) query = query.eq("tipo", tipo);

    const { data, error } = await query.limit(3000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalEntradas = registros.filter((r) => r.tipo === "entrada").reduce((s, r) => s + Number(r.cantidad ?? 0), 0);
  const totalSalidas = registros.filter((r) => r.tipo === "salida").reduce((s, r) => s + Number(r.cantidad ?? 0), 0);

  function filasParaExport() {
    return registros.map((r: any) => ({
      campo: r.campos?.nombre ?? "",
      material: `${r.fecha} — ${r.tipo} — ${r.materiales_empaque?.nombre ?? ""}`,
      stock: Number(r.cantidad ?? 0),
    }));
  }

  async function recalcularStock(matId: string, camId: string) {
    const { data } = await supabase
      .from("movimiento_material_empaque")
      .select("tipo, cantidad")
      .eq("material_id", matId)
      .eq("campo_id", camId);
    const stock = (data ?? []).reduce(
      (acc: number, m: any) => acc + (m.tipo === "entrada" ? Number(m.cantidad) : -Number(m.cantidad)),
      0
    );
    await supabase
      .from("inventario_materiales_empaque")
      .upsert({ material_id: matId, campo_id: camId, stock_actual: stock }, { onConflict: "material_id,campo_id" });
  }

  async function eliminar(r: any) {
    if (!confirm("¿Eliminar este movimiento? Se revierte del inventario. No se puede deshacer.")) return;
    const { error } = await supabase.from("movimiento_material_empaque").delete().eq("id", r.id);
    if (error) {
      setError(error.message);
      return;
    }
    await recalcularStock(r.material_id, r.campo_id);
    consultar();
  }

  function empezarEdicion(r: any) {
    setEditandoId(r.id);
    setEdFecha(r.fecha);
    setEdCampoId(r.campo_id);
    setEdTipo(r.tipo);
    setEdMaterialId(r.material_id);
    setEdCantidad(String(r.cantidad));
    setEdObservaciones(r.observaciones ?? "");
  }

  function cancelarEdicion() {
    setEditandoId(null);
  }

  async function guardarEdicion(r: any) {
    if (!edCampoId || !edMaterialId || !edCantidad) {
      setError("Selecciona campo, material y cantidad.");
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
      .eq("id", r.id);
    setGuardandoEdicion(false);
    if (error) {
      setError(error.message);
      return;
    }
    await recalcularStock(r.material_id, r.campo_id);
    if (edMaterialId !== r.material_id || edCampoId !== r.campo_id) {
      await recalcularStock(edMaterialId, edCampoId);
    }
    setEditandoId(null);
    consultar();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Movimientos</h1>
      <p className="mb-6 text-sm text-campo-600">
        Todas las entradas y salidas de materiales, filtrables por periodo.
      </p>

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
          <label className="mb-1 block text-xs font-medium text-campo-600">Material</label>
          <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Todos</option>
            {materiales.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
          <button className="btn-secondary" onClick={() => generarExcelInventarioMateriales(filasParaExport())}>
            Excel
          </button>
          <button className="btn-secondary" onClick={() => generarPdfInventarioMateriales(filasParaExport())}>
            PDF
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total entradas</p>
          <p className="text-2xl font-semibold text-campo-900">{totalEntradas.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total salidas</p>
          <p className="text-2xl font-semibold text-campo-900">{totalSalidas.toLocaleString()}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Material</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2">Origen</th>
              <th className="px-4 py-2">Observaciones</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={8}>Cargando...</td></tr>}
            {!loading && registros.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={8}>Sin registros en el rango seleccionado.</td></tr>
            )}
            {registros.map((r: any) => {
              const editable = !r.origen_tipo || r.origen_tipo === "ajuste_manual";
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">{r.fecha}</td>
                    <td className="px-4 py-2 text-campo-800">{r.campos?.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">{r.materiales_empaque?.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">
                      <span className={r.tipo === "entrada" ? "text-campo-700" : "text-tierra-600"}>{r.tipo}</span>
                    </td>
                    <td className="px-4 py-2 text-campo-800">{r.cantidad}</td>
                    <td className="px-4 py-2 text-campo-600">
                      {r.origen_tipo === "corte_diario" ? "Corte diario" : r.origen_tipo === "embarque" ? "Embarque" : "Manual"}
                    </td>
                    <td className="px-4 py-2 text-campo-600">{r.observaciones ?? "—"}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {editable ? (
                        editandoId === r.id ? (
                          <button className="btn-secondary" onClick={cancelarEdicion}>Cancelar</button>
                        ) : (
                          <span className="inline-flex gap-2">
                            <button className="btn-secondary" onClick={() => empezarEdicion(r)}>Editar</button>
                            <button className="btn-danger" onClick={() => eliminar(r)}>Eliminar</button>
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-campo-400">No editable</span>
                      )}
                    </td>
                  </tr>
                  {editandoId === r.id && (
                    <tr className="border-t border-campo-50 bg-campo-50/50">
                      <td className="px-4 py-3" colSpan={8}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
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
                            <select className="input" value={edMaterialId} onChange={(e) => setEdMaterialId(e.target.value)}>
                              {materiales.map((m) => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                            </select>
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
                          <div className="sm:col-span-2 md:col-span-5">
                            <label className="mb-1 block text-xs font-medium text-campo-600">Observaciones</label>
                            <input className="input" value={edObservaciones} onChange={(e) => setEdObservaciones(e.target.value)} />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className="btn-primary" onClick={() => guardarEdicion(r)} disabled={guardandoEdicion}>
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
