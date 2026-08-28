"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { id: string; label: string };

export default function MovimientosMaterialesPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [materiales, setMateriales] = useState<Opcion[]>([]);
  const [recientes, setRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [materialTexto, setMaterialTexto] = useState("");
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

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
      .select("id, fecha, tipo, cantidad, observaciones, origen_tipo, campos(nombre), materiales_empaque(nombre)")
      .order("created_at", { ascending: false })
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

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este movimiento? Se revierte del inventario. No se puede deshacer.")) return;
    const { error } = await supabase.from("movimiento_material_empaque").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
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
            {recientes.map((m: any) => (
              <tr key={m.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{m.fecha}</td>
                <td className="px-4 py-2 text-campo-800">{m.campos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{m.materiales_empaque?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">
                  <span className={m.tipo === "entrada" ? "text-campo-700" : "text-tierra-600"}>{m.tipo}</span>
                </td>
                <td className="px-4 py-2 text-campo-800">{m.cantidad}</td>
                <td className="px-4 py-2 text-campo-600">{m.observaciones ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {(!m.origen_tipo || m.origen_tipo === "ajuste_manual") ? (
                    <button className="btn-danger" onClick={() => eliminar(m.id)}>Eliminar</button>
                  ) : (
                    <span className="text-[11px] text-campo-400">Viene de un Corte</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
