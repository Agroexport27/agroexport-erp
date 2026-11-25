"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SolicitudForm from "@/components/administrativo/SolicitudForm";
import { fechaMx } from "@/lib/administrativo";

const COLOR: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  AUTORIZADA: "bg-green-100 text-green-800",
  RECHAZADA: "bg-red-100 text-red-700",
  CANCELADA: "bg-gray-100 text-gray-600",
};

export default function SolicitudesPage() {
  const supabase = createClient();
  const [filas, setFilas] = useState<any[]>([]);
  const [lineasPor, setLineasPor] = useState<Record<string, any[]>>({});
  const [filtro, setFiltro] = useState<"PENDIENTE" | "AUTORIZADA" | "TODAS">("PENDIENTE");
  const [esAutorizador, setEsAutorizador] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; ocId?: string } | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    let q = supabase
      .from("adm_solicitudes")
      .select("*, campos(nombre), adm_ordenes_compra:orden_compra_id(id, folio, estatus)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (filtro !== "TODAS") q = q.eq("estatus", filtro);
    const { data, error } = await q;
    if (error) setError(error.message);
    else {
      setFilas(data ?? []);
      const ids = (data ?? []).map((s: any) => s.id);
      if (ids.length > 0) {
        const { data: lin } = await supabase
          .from("adm_solicitud_lineas")
          .select("solicitud_id, orden, descripcion, cantidad, unidad")
          .in("solicitud_id", ids)
          .order("orden");
        const mapa: Record<string, any[]> = {};
        for (const l of (lin ?? []) as any[]) (mapa[l.solicitud_id] = mapa[l.solicitud_id] ?? []).push(l);
        setLineasPor(mapa);
      } else setLineasPor({});
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.rpc("adm_soy_autorizador").then(({ data }) => setEsAutorizador(!!data));
  }, []);
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function autorizar(s: any) {
    if (!confirm(`¿Autorizar la solicitud ${s.folio}? Se generará la orden de compra.`)) return;
    setTrabajando(s.id);
    setError(null);
    const { data, error } = await supabase.rpc("adm_autorizar_solicitud", { p_id: s.id });
    setTrabajando(null);
    if (error) {
      setError(error.message);
      return;
    }
    setMensaje({ texto: `Solicitud ${s.folio} autorizada. Se generó su orden de compra.`, ocId: data as string });
    cargar();
  }

  async function rechazar(s: any) {
    const motivo = prompt(`Motivo del rechazo de ${s.folio} (opcional):`);
    if (motivo === null) return;
    setTrabajando(s.id);
    const { error } = await supabase.rpc("adm_rechazar_solicitud", { p_id: s.id, p_motivo: motivo || null });
    setTrabajando(null);
    if (error) setError(error.message);
    else cargar();
  }

  async function eliminar(s: any) {
    if (!confirm(`¿Eliminar la solicitud ${s.folio}? No se puede deshacer.`)) return;
    const { error } = await supabase.from("adm_solicitudes").delete().eq("id", s.id);
    if (error) setError(error.message);
    else cargar();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Solicitudes de compra</h1>
      <p className="mb-4 text-sm text-campo-600">
        Captura la solicitud. Un autorizador la aprueba con un botón y se genera sola la orden de compra.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {mensaje && (
        <div className="mb-4 rounded-md border border-campo-200 bg-campo-50 px-4 py-2 text-sm text-campo-800">
          {mensaje.texto}{" "}
          {mensaje.ocId && (
            <a className="font-medium underline" href={`/administrativo/ordenes/${mensaje.ocId}`}>
              Abrir orden de compra →
            </a>
          )}
        </div>
      )}

      {!mostrarForm && !editando && (
        <button className="btn-primary mb-4" onClick={() => setMostrarForm(true)}>
          + Nueva solicitud
        </button>
      )}
      {(mostrarForm || editando) && (
        <SolicitudForm
          solicitud={editando ?? undefined}
          onGuardada={() => {
            setMostrarForm(false);
            setEditando(null);
            cargar();
          }}
          onCancelar={() => {
            setMostrarForm(false);
            setEditando(null);
          }}
        />
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {(["PENDIENTE", "AUTORIZADA", "TODAS"] as const).map((f) => (
          <button key={f} className={filtro === f ? "btn-primary" : "btn-secondary"} onClick={() => setFiltro(f)}>
            {f === "PENDIENTE" ? "Pendientes" : f === "AUTORIZADA" ? "Autorizadas" : "Todas"}
          </button>
        ))}
        {!esAutorizador && (
          <span className="self-center text-xs text-campo-400">
            Tu usuario no es autorizador: puedes capturar solicitudes, pero no autorizarlas.
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando…</p>}
      {!loading && filas.length === 0 && <p className="text-sm text-campo-400">Sin solicitudes.</p>}

      {filas.map((s) => {
        const lin = lineasPor[s.id] ?? [];
        const oc = s.adm_ordenes_compra;
        return (
          <div key={s.id} className="card mb-2 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-2">
              <button className="text-left" onClick={() => setAbierta(abierta === s.id ? null : s.id)}>
                <span className="text-sm font-semibold text-campo-900">{s.folio}</span>
                <span className="ml-2 text-xs text-campo-500">
                  {fechaMx(s.fecha)} · {s.solicitante || "—"} · {s.campos?.nombre ?? "—"}
                </span>
                {s.urgente && <span className="ml-2 rounded bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">URGENTE</span>}
              </button>
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${COLOR[s.estatus]}`}>{s.estatus}</span>
              <span className="text-xs text-campo-500">{lin.length} concepto(s)</span>
              {oc && (
                <a className="text-xs font-medium text-campo-700 underline" href={`/administrativo/ordenes/${oc.id}`}>
                  {oc.folio} ({oc.estatus})
                </a>
              )}
              <span className="ml-auto flex flex-wrap gap-1">
                {s.estatus === "PENDIENTE" && (
                  <>
                    <button className="btn-secondary text-xs" onClick={() => setEditando(s)}>
                      Editar
                    </button>
                    {esAutorizador && (
                      <>
                        <button className="btn-primary text-xs" disabled={trabajando === s.id} onClick={() => autorizar(s)}>
                          {trabajando === s.id ? "…" : "✓ Autorizar"}
                        </button>
                        <button className="btn-danger text-xs" disabled={trabajando === s.id} onClick={() => rechazar(s)}>
                          Rechazar
                        </button>
                      </>
                    )}
                  </>
                )}
                {s.estatus !== "AUTORIZADA" && (
                  <button className="btn-danger text-xs" onClick={() => eliminar(s)}>
                    Eliminar
                  </button>
                )}
              </span>
            </div>
            {abierta === s.id && (
              <div className="border-t border-campo-100 bg-campo-50/40 px-4 py-2 text-sm">
                {s.uso && <p className="text-campo-700"><b>Uso:</b> {s.uso}</p>}
                {s.notas && <p className="text-campo-700"><b>Notas:</b> {s.notas}</p>}
                {s.estatus !== "PENDIENTE" && (
                  <p className="text-xs text-campo-500">
                    {s.estatus === "AUTORIZADA" ? "Autorizada" : "Rechazada"} por {s.autorizada_nombre ?? s.autorizada_por} el{" "}
                    {s.autorizada_at ? new Date(s.autorizada_at).toLocaleString("es-MX") : "—"}
                    {s.motivo_rechazo ? ` — ${s.motivo_rechazo}` : ""}
                  </p>
                )}
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {lin.map((l, i) => (
                      <tr key={i} className="border-t border-campo-100">
                        <td className="py-1 text-campo-800">{l.descripcion}</td>
                        <td className="py-1 text-right text-campo-700">
                          {Number(l.cantidad)} {l.unidad ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
