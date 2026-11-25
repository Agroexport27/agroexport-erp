"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LineasEditor from "./LineasEditor";
import { ItemCatalogo, LineaUI, cargarCatalogoCompras, lineaVacia, uid } from "@/lib/administrativo";
import { fechaLocalHoy } from "@/lib/fechaLocal";

// Captura / edición de una solicitud de compra (a mano).
export default function SolicitudForm({
  solicitud,
  onGuardada,
  onCancelar,
}: {
  solicitud?: any; // si viene, es edición (solo PENDIENTE)
  onGuardada: () => void;
  onCancelar: () => void;
}) {
  const supabase = createClient();
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [campos, setCampos] = useState<{ id: string; nombre: string }[]>([]);

  const [fecha, setFecha] = useState(solicitud?.fecha ?? fechaLocalHoy());
  const [solicitante, setSolicitante] = useState(solicitud?.solicitante ?? "");
  const [campoId, setCampoId] = useState(solicitud?.campo_id ?? "");
  const [uso, setUso] = useState(solicitud?.uso ?? "");
  const [notas, setNotas] = useState(solicitud?.notas ?? "");
  const [urgente, setUrgente] = useState(!!solicitud?.urgente);
  const [sinOrden, setSinOrden] = useState(solicitud?.requiere_oc === false);
  const [monto, setMonto] = useState(solicitud?.monto != null ? String(solicitud.monto) : "");
  const [lineas, setLineas] = useState<LineaUI[]>([lineaVacia()]);

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarCatalogoCompras(supabase).then(setCatalogo);
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos(data ?? []));
    if (solicitud?.id) {
      supabase
        .from("adm_solicitud_lineas")
        .select("*")
        .eq("solicitud_id", solicitud.id)
        .order("orden")
        .then(({ data }) => {
          if (data && data.length > 0)
            setLineas(
              data.map((l: any) => ({
                key: uid(),
                id: l.id,
                descripcion: l.descripcion,
                cantidad: String(l.cantidad),
                unidad: l.unidad ?? "",
                precio: "",
                tipo_item: l.tipo_item,
                producto_id: l.producto_id,
                material_id: l.material_id,
              }))
            );
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    setError(null);
    const validas = lineas.filter((l) => l.descripcion.trim());
    if (validas.length === 0) {
      setError("Agrega al menos un concepto.");
      return;
    }
    setGuardando(true);
    const { data: u } = await supabase.auth.getUser();

    const cabecera = {
      fecha,
      solicitante: solicitante || null,
      campo_id: campoId || null,
      uso: uso || null,
      notas: notas || null,
      urgente,
      requiere_oc: !sinOrden,
      monto: sinOrden && monto ? parseFloat(monto) : null,
    };

    let solicitudId: string = solicitud?.id;
    if (solicitud?.id) {
      const { error: errUpd } = await supabase.from("adm_solicitudes").update(cabecera).eq("id", solicitud.id);
      if (errUpd) {
        setGuardando(false);
        setError(errUpd.message);
        return;
      }
      await supabase.from("adm_solicitud_lineas").delete().eq("solicitud_id", solicitud.id);
    } else {
      const { data: nueva, error: errIns } = await supabase
        .from("adm_solicitudes")
        .insert({ ...cabecera, capturada_por: u.user?.email ?? null })
        .select("id")
        .single();
      if (errIns || !nueva) {
        setGuardando(false);
        setError(errIns?.message ?? "No se pudo guardar");
        return;
      }
      solicitudId = nueva.id;
    }

    const { error: errLin } = await supabase.from("adm_solicitud_lineas").insert(
      validas.map((l, i) => ({
        solicitud_id: solicitudId,
        orden: i + 1,
        descripcion: l.descripcion.trim(),
        cantidad: parseFloat(l.cantidad) || 1,
        unidad: l.unidad || null,
        tipo_item: l.tipo_item,
        producto_id: l.producto_id,
        material_id: l.material_id,
      }))
    );
    setGuardando(false);
    if (errLin) {
      setError(errLin.message);
      return;
    }
    onGuardada();
  }

  return (
    <div className="card mb-6 p-4">
      <h2 className="mb-3 text-sm font-semibold text-campo-800">
        {solicitud ? `Editar solicitud ${solicitud.folio}` : "Nueva solicitud de compra"}
      </h2>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Fecha</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Solicita</label>
          <input className="input" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
            <option value="">—</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-campo-700">
          <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
          Urgente
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 md:col-span-4">
          <label className="flex items-center gap-2 text-sm text-campo-700">
            <input type="checkbox" checked={sinOrden} onChange={(e) => setSinOrden(e.target.checked)} />
            No requiere orden de compra (reembolso, gasto, etc.)
          </label>
          {sinOrden && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-campo-600">Monto</label>
              <input type="number" step="any" className="input w-36" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
          )}
        </div>
        <div className="sm:col-span-2 md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-campo-600">Para qué / dónde se usa</label>
          <input className="input" value={uso} onChange={(e) => setUso(e.target.value)} />
        </div>
        <div className="sm:col-span-2 md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-campo-600">Notas</label>
          <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>

      <LineasEditor lineas={lineas} onChange={setLineas} catalogo={catalogo} />

      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar solicitud"}
        </button>
        <button className="btn-secondary" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
