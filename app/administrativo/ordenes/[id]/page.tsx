"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LineasEditor from "@/components/administrativo/LineasEditor";
import {
  ItemCatalogo,
  LineaUI,
  cargarCatalogoCompras,
  dinero,
  fechaMx,
  uid,
} from "@/lib/administrativo";
import { generarPdfOrdenCompra } from "@/lib/pdf/ordenCompra";
import { fechaLocalHoy } from "@/lib/fechaLocal";

const COLOR: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  PARCIAL: "bg-blue-100 text-blue-800",
  SURTIDA: "bg-green-100 text-green-800",
  CANCELADA: "bg-gray-100 text-gray-600",
};

export default function OrdenCompraPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [oc, setOc] = useState<any | null>(null);
  const [lineas, setLineas] = useState<LineaUI[]>([]);
  const [recepciones, setRecepciones] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [campos, setCampos] = useState<{ id: string; nombre: string }[]>([]);
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [solicitudFolio, setSolicitudFolio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [estatusOriginal, setEstatusOriginal] = useState<string>("");
  const [hermanas, setHermanas] = useState<any[]>([]); // otras órdenes de la misma solicitud
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [dividiendo, setDividiendo] = useState(false);

  // Recepción
  const [recFecha, setRecFecha] = useState(fechaLocalHoy());
  const [recCampo, setRecCampo] = useState("");
  const [recObs, setRecObs] = useState("");
  const [recCant, setRecCant] = useState<Record<string, string>>({});
  const [recibiendo, setRecibiendo] = useState(false);

  async function cargar() {
    const { data: o, error: eo } = await supabase.from("adm_ordenes_compra").select("*").eq("id", id).single();
    if (eo || !o) {
      setError(eo?.message ?? "No existe la orden");
      return;
    }
    setOc(o);
    setEstatusOriginal(o.estatus);
    if (!recCampo && o.campo_id) setRecCampo(o.campo_id);
    const [{ data: lin }, { data: rec }] = await Promise.all([
      supabase.from("adm_oc_lineas").select("*").eq("oc_id", id).order("orden"),
      supabase
        .from("adm_oc_recepciones")
        .select("*, adm_oc_lineas(descripcion, unidad), campos(nombre)")
        .eq("oc_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setLineas(
      (lin ?? []).map((l: any) => ({
        key: uid(),
        id: l.id,
        descripcion: l.descripcion,
        cantidad: String(l.cantidad),
        unidad: l.unidad ?? "",
        precio: String(Number(l.precio_unitario) || ""),
        tipo_item: l.tipo_item,
        producto_id: l.producto_id,
        material_id: l.material_id,
        cantidad_recibida: Number(l.cantidad_recibida),
      }))
    );
    setRecepciones(rec ?? []);
    if (o.solicitud_id) {
      const { data: s } = await supabase.from("adm_solicitudes").select("folio").eq("id", o.solicitud_id).single();
      setSolicitudFolio(s?.folio ?? null);
      const { data: otras } = await supabase
        .from("adm_ordenes_compra")
        .select("id, folio, proveedor_nombre, estatus, total, moneda")
        .eq("solicitud_id", o.solicitud_id)
        .order("created_at");
      setHermanas((otras ?? []).filter((x: any) => x.id !== id));
    } else setHermanas([]);
    setSeleccion(new Set());
  }

  useEffect(() => {
    cargar();
    cargarCatalogoCompras(supabase).then(setCatalogo);
    supabase.from("adm_proveedores").select("*").eq("activo", true).order("nombre").then(({ data }) => setProveedores(data ?? []));
    supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre").then(({ data }) => setCampos(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set(campo: string, valor: any) {
    setOc((prev: any) => ({ ...prev, [campo]: valor }));
  }

  function elegirProveedor(provId: string) {
    const p = proveedores.find((x) => x.id === provId);
    if (!p) {
      set("proveedor_id", null);
      return;
    }
    setOc((prev: any) => ({
      ...prev,
      proveedor_id: p.id,
      proveedor_nombre: p.nombre,
      proveedor_rfc: p.rfc ?? "",
      proveedor_contacto: [p.contacto, p.telefono].filter(Boolean).join(" · "),
      proveedor_direccion: p.direccion ?? "",
      condiciones_pago: prev.condiciones_pago || p.condiciones_pago || "",
    }));
  }

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((s, l) => s + (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0), 0);
    const ivaPct = Number(oc?.iva_pct ?? 0);
    const iva = subtotal * (ivaPct / 100);
    return { subtotal, iva, total: subtotal + iva };
  }, [lineas, oc?.iva_pct]);

  async function guardar(): Promise<boolean> {
    setError(null);
    setMensaje(null);
    const validas = lineas.filter((l) => l.descripcion.trim());
    setGuardando(true);
    const { error: eu } = await supabase
      .from("adm_ordenes_compra")
      .update({
        fecha: oc.fecha,
        proveedor_id: oc.proveedor_id || null,
        proveedor_nombre: oc.proveedor_nombre || null,
        proveedor_rfc: oc.proveedor_rfc || null,
        proveedor_contacto: oc.proveedor_contacto || null,
        proveedor_direccion: oc.proveedor_direccion || null,
        solicitante: oc.solicitante || null,
        campo_id: oc.campo_id || null,
        fecha_entrega: oc.fecha_entrega || null,
        lugar_entrega: oc.lugar_entrega || null,
        condiciones_pago: oc.condiciones_pago || null,
        moneda: oc.moneda || "MXN",
        iva_pct: Number(oc.iva_pct) || 0,
        subtotal: totales.subtotal,
        iva: totales.iva,
        total: totales.total,
        notas: oc.notas || null,
        estatus: oc.estatus,
      })
      .eq("id", id);
    if (eu) {
      setGuardando(false);
      setError(eu.message);
      return false;
    }

    // Renglones: actualiza los existentes, inserta los nuevos, borra los quitados (sin recepciones).
    const { data: existentes } = await supabase.from("adm_oc_lineas").select("id").eq("oc_id", id);
    const idsActuales = new Set(validas.filter((l) => l.id).map((l) => l.id));
    const aBorrar = (existentes ?? []).map((l: any) => l.id).filter((x: string) => !idsActuales.has(x));
    if (aBorrar.length > 0) await supabase.from("adm_oc_lineas").delete().in("id", aBorrar);

    for (let i = 0; i < validas.length; i++) {
      const l = validas[i];
      const fila = {
        oc_id: id,
        orden: i + 1,
        descripcion: l.descripcion.trim(),
        cantidad: parseFloat(l.cantidad) || 1,
        unidad: l.unidad || null,
        precio_unitario: parseFloat(l.precio) || 0,
        tipo_item: l.tipo_item,
        producto_id: l.producto_id,
        material_id: l.material_id,
      };
      const { error: el } = l.id
        ? await supabase.from("adm_oc_lineas").update(fila).eq("id", l.id)
        : await supabase.from("adm_oc_lineas").insert(fila);
      if (el) {
        setGuardando(false);
        setError(el.message);
        return false;
      }
    }
    // Si cambiaron cantidades, el estatus de surtido se recalcula; si lo cambiaste tú a mano, se respeta.
    if (oc.estatus !== "CANCELADA" && oc.estatus === estatusOriginal) {
      await supabase.rpc("adm_recalcular_estatus_oc", { p_oc: id });
    }
    setGuardando(false);
    setMensaje("Orden guardada.");
    await cargar();
    return true;
  }

  async function moverAOrdenNueva() {
    const ids = lineas.filter((l) => l.id && seleccion.has(l.id)).map((l) => l.id!);
    if (ids.length === 0) {
      setError("Marca los conceptos que irán a otra orden (otro proveedor).");
      return;
    }
    setDividiendo(true);
    const ok = await guardar(); // primero guarda lo que tengas en pantalla
    if (!ok) {
      setDividiendo(false);
      return;
    }
    const { data, error } = await supabase.rpc("adm_dividir_oc", { p_oc: id, p_lineas: ids });
    setDividiendo(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/administrativo/ordenes/${data as string}`);
  }

  async function descargarPdf() {
    let autorizo: string | null = oc.autorizada_nombre ?? null;
    generarPdfOrdenCompra({
      folio: oc.folio,
      fecha: oc.fecha,
      estatus: oc.estatus,
      solicitudFolio,
      proveedor: {
        nombre: oc.proveedor_nombre ?? "",
        rfc: oc.proveedor_rfc,
        contacto: oc.proveedor_contacto,
        direccion: oc.proveedor_direccion,
      },
      solicitante: oc.solicitante,
      campo: campos.find((c) => c.id === oc.campo_id)?.nombre ?? null,
      fechaEntrega: oc.fecha_entrega,
      lugarEntrega: oc.lugar_entrega,
      condicionesPago: oc.condiciones_pago,
      moneda: oc.moneda,
      ivaPct: Number(oc.iva_pct) || 0,
      notas: oc.notas,
      autorizo,
      autorizoFecha: oc.autorizada_at ? String(oc.autorizada_at).slice(0, 10) : null,
      lineas: lineas
        .filter((l) => l.descripcion.trim())
        .map((l) => ({
          descripcion: l.descripcion,
          cantidad: parseFloat(l.cantidad) || 0,
          unidad: l.unidad,
          precio: parseFloat(l.precio) || 0,
        })),
    });
  }

  async function recibir() {
    setError(null);
    setMensaje(null);
    const items = Object.entries(recCant)
      .map(([linea_id, c]) => ({ linea_id, cantidad: parseFloat(c) }))
      .filter((x) => x.cantidad > 0);
    if (items.length === 0) {
      setError("Captura la cantidad recibida de al menos un renglón.");
      return;
    }
    const requiereCampo = items.some((it) => {
      const l = lineas.find((x) => x.id === it.linea_id);
      return l && l.tipo_item !== "libre";
    });
    if (requiereCampo && !recCampo) {
      setError("Elige el campo al que entra el inventario.");
      return;
    }
    setRecibiendo(true);
    const { error } = await supabase.rpc("adm_recibir_oc", {
      p_oc: id,
      p_fecha: recFecha,
      p_campo: recCampo || null,
      p_lineas: items,
      p_obs: recObs || null,
    });
    setRecibiendo(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRecCant({});
    setRecObs("");
    setMensaje("Recepción registrada. Lo de agroquímicos / empaque ya entró al inventario.");
    await cargar();
  }

  async function eliminarRecepcion(r: any) {
    if (!confirm("¿Eliminar esta recepción? Se quita la entrada del inventario.")) return;
    const { error } = await supabase.rpc("adm_eliminar_recepcion", { p_id: r.id });
    if (error) setError(error.message);
    else cargar();
  }

  async function eliminarOrden() {
    if (recepciones.length > 0) {
      setError("Esta orden tiene recepciones. Elimínalas primero (o cancela la orden).");
      return;
    }
    if (!confirm(`¿Eliminar la orden ${oc.folio}? No se puede deshacer.`)) return;
    const { error } = await supabase.from("adm_ordenes_compra").delete().eq("id", id);
    if (error) setError(error.message);
    else router.push("/administrativo/ordenes");
  }

  if (!oc) {
    return <p className="text-sm text-campo-400">{error ?? "Cargando…"}</p>;
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <a href="/administrativo/ordenes" className="text-sm text-campo-500 underline">← Órdenes</a>
        <h1 className="text-2xl font-semibold text-campo-900">Orden de compra {oc.folio}</h1>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${COLOR[oc.estatus]}`}>{oc.estatus}</span>
        {solicitudFolio && <span className="text-xs text-campo-500">Ligada a {solicitudFolio}</span>}
      </div>
      {oc.autorizada_nombre && (
        <p className="mb-3 text-xs text-campo-500">
          Autorizada por {oc.autorizada_nombre} el {oc.autorizada_at ? new Date(oc.autorizada_at).toLocaleString("es-MX") : "—"}
        </p>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {mensaje && (
        <div className="mb-3 rounded-md border border-campo-200 bg-campo-50 px-4 py-2 text-sm text-campo-700">{mensaje}</div>
      )}

      <div className="card mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Fecha</label>
            <input type="date" className="input" value={oc.fecha ?? ""} onChange={(e) => set("fecha", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-campo-600">Proveedor (catálogo)</label>
            <select className="input" value={oc.proveedor_id ?? ""} onChange={(e) => elegirProveedor(e.target.value)}>
              <option value="">— Elegir / escribir abajo —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Estatus</label>
            <select className="input" value={oc.estatus} onChange={(e) => set("estatus", e.target.value)}>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PARCIAL">Parcial</option>
              <option value="SURTIDA">Surtida</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Nombre del proveedor</label>
            <input className="input" value={oc.proveedor_nombre ?? ""} onChange={(e) => set("proveedor_nombre", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">RFC</label>
            <input className="input" value={oc.proveedor_rfc ?? ""} onChange={(e) => set("proveedor_rfc", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Contacto / teléfono</label>
            <input className="input" value={oc.proveedor_contacto ?? ""} onChange={(e) => set("proveedor_contacto", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Dirección</label>
            <input className="input" value={oc.proveedor_direccion ?? ""} onChange={(e) => set("proveedor_direccion", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Solicita</label>
            <input className="input" value={oc.solicitante ?? ""} onChange={(e) => set("solicitante", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Campo (entra al inventario de)</label>
            <select className="input" value={oc.campo_id ?? ""} onChange={(e) => set("campo_id", e.target.value)}>
              <option value="">—</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Fecha de entrega</label>
            <input type="date" className="input" value={oc.fecha_entrega ?? ""} onChange={(e) => set("fecha_entrega", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Lugar de entrega</label>
            <input className="input" value={oc.lugar_entrega ?? ""} onChange={(e) => set("lugar_entrega", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Condiciones de pago</label>
            <input className="input" value={oc.condiciones_pago ?? ""} onChange={(e) => set("condiciones_pago", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Moneda</label>
            <select className="input" value={oc.moneda} onChange={(e) => set("moneda", e.target.value)}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">IVA %</label>
            <input type="number" step="any" className="input" value={oc.iva_pct ?? 0} onChange={(e) => set("iva_pct", e.target.value)} />
          </div>
          <div className="sm:col-span-2 md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-campo-600">Notas</label>
            <textarea className="input" rows={2} value={oc.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card mb-4 p-4">
        <h2 className="mb-2 text-sm font-semibold text-campo-800">Conceptos</h2>
        <LineasEditor lineas={lineas} onChange={setLineas} catalogo={catalogo} conPrecio moneda={oc.moneda} />
        <div className="mt-3 flex flex-col items-end text-sm text-campo-700">
          <span>Subtotal: {dinero(totales.subtotal, oc.moneda)}</span>
          <span>IVA ({Number(oc.iva_pct) || 0}%): {dinero(totales.iva, oc.moneda)}</span>
          <span className="font-semibold text-campo-900">Total: {dinero(totales.total, oc.moneda)}</span>
        </div>
      </div>

      {solicitudFolio && (
        <div className="card mb-4 p-4">
          <h2 className="mb-1 text-sm font-semibold text-campo-800">Otro proveedor para esta solicitud</h2>
          <p className="mb-2 text-xs text-campo-500">
            Una solicitud puede tener varias órdenes de compra. Marca los conceptos que compra otro proveedor y pásalos a una orden nueva
            (se guarda lo que traes en pantalla antes de moverlos).
          </p>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
            {lineas.filter((l) => l.id).map((l) => {
              const bloqueado = Number(l.cantidad_recibida ?? 0) > 0;
              return (
                <label key={l.key} className={`flex items-center gap-2 text-sm ${bloqueado ? "text-campo-300" : "text-campo-700"}`}>
                  <input
                    type="checkbox"
                    disabled={bloqueado}
                    checked={seleccion.has(l.id!)}
                    onChange={(e) =>
                      setSeleccion((prev) => {
                        const n = new Set(prev);
                        if (e.target.checked) n.add(l.id!);
                        else n.delete(l.id!);
                        return n;
                      })
                    }
                  />
                  {l.descripcion || "(sin descripción)"}
                </label>
              );
            })}
          </div>
          <button className="btn-secondary" onClick={moverAOrdenNueva} disabled={dividiendo || guardando}>
            {dividiendo ? "Moviendo…" : "Mover marcados a una orden nueva"}
          </button>
          {hermanas.length > 0 && (
            <div className="mt-3 border-t border-campo-100 pt-2 text-xs text-campo-600">
              <p className="mb-1 font-medium">Otras órdenes de {solicitudFolio}:</p>
              {hermanas.map((h) => (
                <a key={h.id} href={`/administrativo/ordenes/${h.id}`} className="mr-4 underline">
                  {h.folio} · {h.proveedor_nombre || "sin proveedor"} · {h.estatus}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button className="btn-secondary" onClick={descargarPdf}>
          Descargar PDF
        </button>
        <button className="btn-danger ml-auto" onClick={eliminarOrden}>
          Eliminar orden
        </button>
      </div>
      <p className="mb-6 -mt-3 text-xs text-campo-400">
        El PDF usa lo que ves en pantalla; guarda antes de seguir si hiciste cambios.
      </p>

      {oc.estatus !== "CANCELADA" && lineas.some((l) => l.id) && (
        <div className="card mb-4 p-4">
          <h2 className="mb-1 text-sm font-semibold text-campo-800">Recepción de mercancía</h2>
          <p className="mb-3 text-xs text-campo-500">
            Captura lo que llegó (puede ser parcial). Lo de agroquímicos y material de empaque entra solo al inventario del campo elegido.
          </p>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-campo-600">Fecha de recepción</label>
              <input type="date" className="input" value={recFecha} onChange={(e) => setRecFecha(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-campo-600">Campo (inventario)</label>
              <select className="input" value={recCampo} onChange={(e) => setRecCampo(e.target.value)}>
                <option value="">—</option>
                {campos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-campo-600">Observaciones (remisión, factura…)</label>
              <input className="input" value={recObs} onChange={(e) => setRecObs(e.target.value)} />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-campo-500">
              <tr>
                <th className="py-1">Concepto</th>
                <th className="py-1 text-right">Pedido</th>
                <th className="py-1 text-right">Recibido</th>
                <th className="py-1 text-right">Falta</th>
                <th className="w-28 py-1">Recibo ahora</th>
              </tr>
            </thead>
            <tbody>
              {lineas.filter((l) => l.id).map((l) => {
                const pedido = parseFloat(l.cantidad) || 0;
                const rec = Number(l.cantidad_recibida ?? 0);
                const falta = Math.max(pedido - rec, 0);
                return (
                  <tr key={l.key} className="border-t border-campo-50">
                    <td className="py-1 text-campo-800">
                      {l.descripcion}
                      {l.tipo_item !== "libre" && <span className="ml-1 text-[10px] text-campo-500">↔ inventario</span>}
                    </td>
                    <td className="py-1 text-right text-campo-700">{pedido} {l.unidad}</td>
                    <td className="py-1 text-right text-campo-700">{rec}</td>
                    <td className="py-1 text-right text-campo-700">{falta}</td>
                    <td className="py-1">
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="any"
                          className="input"
                          value={recCant[l.id!] ?? ""}
                          onChange={(e) => setRecCant((p) => ({ ...p, [l.id!]: e.target.value }))}
                        />
                        {falta > 0 && (
                          <button className="btn-secondary px-2 text-xs" title="Recibir todo lo que falta" onClick={() => setRecCant((p) => ({ ...p, [l.id!]: String(falta) }))}>
                            Todo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-3">
            <button className="btn-primary" onClick={recibir} disabled={recibiendo}>
              {recibiendo ? "Registrando…" : "Registrar recepción"}
            </button>
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                const todo: Record<string, string> = {};
                for (const l of lineas) {
                  if (!l.id) continue;
                  const falta = Math.max((parseFloat(l.cantidad) || 0) - Number(l.cantidad_recibida ?? 0), 0);
                  if (falta > 0) todo[l.id] = String(falta);
                }
                setRecCant(todo);
              }}
            >
              Llenar todo lo pendiente
            </button>
          </div>

          {recepciones.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-semibold text-campo-700">Recepciones registradas</h3>
              <table className="w-full text-xs">
                <tbody>
                  {recepciones.map((r) => (
                    <tr key={r.id} className="border-t border-campo-50">
                      <td className="py-1 text-campo-700">{fechaMx(r.fecha)}</td>
                      <td className="py-1 text-campo-800">{r.adm_oc_lineas?.descripcion}</td>
                      <td className="py-1 text-right text-campo-800">{Number(r.cantidad)} {r.adm_oc_lineas?.unidad}</td>
                      <td className="py-1 text-campo-500">{r.campos?.nombre ?? ""}</td>
                      <td className="py-1 text-campo-500">{r.observaciones ?? ""}</td>
                      <td className="py-1 text-right">
                        <button className="btn-danger px-2 text-[11px]" onClick={() => eliminarRecepcion(r)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
