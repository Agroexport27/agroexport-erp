"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dinero, fechaMx } from "@/lib/administrativo";

const COLOR: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  PARCIAL: "bg-blue-100 text-blue-800",
  SURTIDA: "bg-green-100 text-green-800",
  CANCELADA: "bg-gray-100 text-gray-600",
};

export default function OrdenesCompraPage() {
  const supabase = createClient();
  const router = useRouter();
  const [filas, setFilas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<"ABIERTAS" | "SURTIDA" | "TODAS">("ABIERTAS");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    let q = supabase
      .from("adm_ordenes_compra")
      .select("*, adm_solicitudes:solicitud_id(folio)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (filtro === "ABIERTAS") q = q.in("estatus", ["PENDIENTE", "PARCIAL"]);
    if (filtro === "SURTIDA") q = q.eq("estatus", "SURTIDA");
    const { data, error } = await q;
    if (error) setError(error.message);
    else setFilas(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function nueva() {
    const { data, error } = await supabase.from("adm_ordenes_compra").insert({}).select("id").single();
    if (error || !data) {
      setError(error?.message ?? "No se pudo crear");
      return;
    }
    router.push(`/administrativo/ordenes/${data.id}`);
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(
    (o) =>
      !q ||
      o.folio?.toLowerCase().includes(q) ||
      o.proveedor_nombre?.toLowerCase().includes(q) ||
      o.adm_solicitudes?.folio?.toLowerCase().includes(q)
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Órdenes de compra</h1>
      <p className="mb-4 text-sm text-campo-600">
        Se generan solas al autorizar una solicitud, o puedes crear una directa. Todo se puede modificar.
      </p>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={nueva}>
          + Nueva orden de compra
        </button>
        {(["ABIERTAS", "SURTIDA", "TODAS"] as const).map((f) => (
          <button key={f} className={filtro === f ? "btn-primary" : "btn-secondary"} onClick={() => setFiltro(f)}>
            {f === "ABIERTAS" ? "Pendientes / parciales" : f === "SURTIDA" ? "Surtidas" : "Todas"}
          </button>
        ))}
        <input
          className="input max-w-xs"
          placeholder="Buscar folio o proveedor"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Folio</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Solicitud</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2">Surtido</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Cargando…</td></tr>
            )}
            {!loading && visibles.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Sin órdenes.</td></tr>
            )}
            {visibles.map((o) => (
              <tr key={o.id} className="border-t border-campo-50">
                <td className="px-4 py-2 font-medium text-campo-900">{o.folio}</td>
                <td className="px-4 py-2 text-campo-700">{fechaMx(o.fecha)}</td>
                <td className="px-4 py-2 text-campo-800">{o.proveedor_nombre || <span className="text-campo-400">Sin proveedor</span>}</td>
                <td className="px-4 py-2 text-campo-600">{o.adm_solicitudes?.folio ?? "—"}</td>
                <td className="px-4 py-2 text-right text-campo-800">{dinero(Number(o.total), o.moneda)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${COLOR[o.estatus]}`}>{o.estatus}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <a className="btn-secondary text-xs" href={`/administrativo/ordenes/${o.id}`}>
                    Abrir
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
