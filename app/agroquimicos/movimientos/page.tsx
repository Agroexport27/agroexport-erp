"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Producto = { id: string; nombre: string; unidad: string };
type Opcion = { id: string; label: string };

type Linea = {
  key: string;
  productoId: string;
  productoTexto: string;
  cantidad: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function MovimientosAgroquimicosPage() {
  const supabase = createClient();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [campos, setCampos] = useState<Opcion[]>([]);
  const [movimientosRecientes, setMovimientosRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [folio, setFolio] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([
    { key: uid(), productoId: "", productoTexto: "", cantidad: "" },
  ]);

  async function cargarCatalogos() {
    const [{ data: prod }, { data: camp }] = await Promise.all([
      supabase.from("catalogo_productos").select("id, nombre, unidad").eq("activo", true).order("nombre"),
      supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    setProductos(prod ?? []);
    setCampos((camp ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
  }

  async function eliminarMovimiento(id: string) {
    if (!confirm("¿Eliminar este movimiento? Se revierte del inventario. No se puede deshacer.")) return;
    const { error } = await supabase.from("movimientos_inventario_agroquimicos").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargarMovimientosRecientes();
  }

  async function cargarMovimientosRecientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("movimientos_inventario_agroquimicos")
      .select("id, fecha, tipo, cantidad, folio, observaciones, origen_tipo, campos(nombre), catalogo_productos(nombre, unidad)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    else setMovimientosRecientes(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarCatalogos();
    cargarMovimientosRecientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function agregarLinea() {
    setLineas((l) => [...l, { key: uid(), productoId: "", productoTexto: "", cantidad: "" }]);
  }

  function quitarLinea(key: string) {
    setLineas((l) => l.filter((x) => x.key !== key));
  }

  function actualizarLinea(key: string, cambios: Partial<Linea>) {
    setLineas((l) => l.map((x) => (x.key === key ? { ...x, ...cambios } : x)));
  }

  function manejarTextoProducto(key: string, texto: string) {
    const match = productos.find((p) => p.nombre === texto);
    actualizarLinea(key, { productoTexto: texto, productoId: match ? match.id : "" });
  }

  async function guardarTodo() {
    if (!campoId) {
      setError("Selecciona el campo.");
      return;
    }
    const validas = lineas.filter((l) => l.productoId && l.cantidad);
    if (validas.length === 0) {
      setError("Agrega al menos un producto con cantidad.");
      return;
    }
    setGuardando(true);
    setError(null);

    const filas = validas.map((l) => ({
      folio: folio || null,
      producto_id: l.productoId,
      campo_id: campoId,
      fecha,
      tipo,
      cantidad: parseFloat(l.cantidad),
      observaciones: observaciones || null,
      origen_tipo: "ajuste_manual",
    }));

    const { error } = await supabase.from("movimientos_inventario_agroquimicos").insert(filas);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMensajeExito(`Se guardaron ${filas.length} movimientos.`);
    setLineas([{ key: uid(), productoId: "", productoTexto: "", cantidad: "" }]);
    setFolio("");
    setObservaciones("");
    cargarMovimientosRecientes();
    setTimeout(() => setMensajeExito(null), 4000);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">
        Entradas y salidas — Agroquímicos
      </h1>
      <p className="mb-6 text-sm text-campo-600">
        Usa "Entrada" para capturar tu inventario inicial (con observación
        "Inventario inicial") y de ahí en adelante para compras; usa
        "Salida" para consumos o mermas manuales.
      </p>

      <datalist id="productos-datalist">
        {productos.map((p) => (
          <option key={p.id} value={p.nombre} />
        ))}
      </datalist>

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

      <div className="card mb-4 grid grid-cols-5 items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Fecha</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
            <option value="">Selecciona...</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as "entrada" | "salida")}>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Folio (opcional)</label>
          <input className="input" value={folio} onChange={(e) => setFolio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Observaciones</label>
          <input
            className="input"
            placeholder="ej. Inventario inicial"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>
      </div>

      <div className="card mb-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Unidad</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const producto = productos.find((p) => p.id === l.productoId);
              return (
                <tr key={l.key} className="border-t border-campo-50">
                  <td className="px-4 py-1">
                    <input
                      className="input w-72"
                      list="productos-datalist"
                      placeholder="Buscar producto..."
                      value={l.productoTexto}
                      onChange={(e) => manejarTextoProducto(l.key, e.target.value)}
                    />
                    {l.productoTexto && !l.productoId && (
                      <p className="text-[10px] text-red-500">Sin coincidencia exacta</p>
                    )}
                  </td>
                  <td className="px-4 py-1 text-campo-600">{producto?.unidad ?? "—"}</td>
                  <td className="px-4 py-1">
                    <input
                      type="number"
                      step="any"
                      className="input w-28"
                      value={l.cantidad}
                      onChange={(e) => actualizarLinea(l.key, { cantidad: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-1">
                    <button className="text-red-500 hover:text-red-700" onClick={() => quitarLinea(l.key)}>
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-campo-50 px-4 py-2">
          <button className="btn-secondary text-xs" onClick={agregarLinea}>
            + Agregar producto
          </button>
        </div>
      </div>

      <button className="btn-primary mb-8" onClick={guardarTodo} disabled={guardando}>
        {guardando ? "Guardando..." : `Guardar ${lineas.filter((l) => l.productoId && l.cantidad).length} movimientos`}
      </button>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Movimientos recientes</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2">Observaciones</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Cargando...</td></tr>
            )}
            {!loading && movimientosRecientes.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={7}>Todavía no hay movimientos.</td></tr>
            )}
            {movimientosRecientes.map((m: any) => (
              <tr key={m.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{m.fecha}</td>
                <td className="px-4 py-2 text-campo-800">{m.campos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{m.catalogo_productos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">
                  <span className={m.tipo === "entrada" ? "text-campo-700" : "text-tierra-600"}>
                    {m.tipo}
                  </span>
                </td>
                <td className="px-4 py-2 text-campo-800">
                  {m.cantidad} {m.catalogo_productos?.unidad}
                </td>
                <td className="px-4 py-2 text-campo-600">{m.observaciones ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {(!m.origen_tipo || m.origen_tipo === "ajuste_manual") ? (
                    <button className="btn-danger" onClick={() => eliminarMovimiento(m.id)}>
                      Eliminar
                    </button>
                  ) : (
                    <span className="text-[11px] text-campo-400">Viene de una aplicación</span>
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
