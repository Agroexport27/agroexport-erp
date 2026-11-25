"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Conceptos de compra que NO son agroquímico ni material de empaque (refacciones, servicios, etc.).
// Los agroquímicos y el material de empaque se dan de alta en Planeación → Catálogos y
// aparecen solos aquí, enlazados con su inventario.
export default function ConceptosPage() {
  const supabase = createClient();
  const [filas, setFilas] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [agro, setAgro] = useState<any[]>([]);
  const [mats, setMats] = useState<any[]>([]);
  const [form, setForm] = useState({ nombre: "", unidad: "", precio_referencia: "", proveedor_id: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [c, p, a, m] = await Promise.all([
      supabase.from("adm_conceptos").select("*, adm_proveedores(nombre)").order("nombre"),
      supabase.from("adm_proveedores").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("catalogo_productos").select("id, nombre, unidad, categoria").eq("activo", true).order("nombre"),
      supabase.from("materiales_empaque").select("*").order("nombre"),
    ]);
    if (c.error) setError(c.error.message);
    setFilas(c.data ?? []);
    setProveedores(p.data ?? []);
    setAgro(a.data ?? []);
    setMats(m.data ?? []);
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    setError(null);
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const fila = {
      nombre: form.nombre.trim(),
      unidad: form.unidad.trim() || null,
      precio_referencia: form.precio_referencia ? parseFloat(form.precio_referencia) : null,
      proveedor_id: form.proveedor_id || null,
    };
    const { error } = editId
      ? await supabase.from("adm_conceptos").update(fila).eq("id", editId)
      : await supabase.from("adm_conceptos").insert(fila);
    if (error) {
      setError(error.code === "23505" ? "Ya existe un concepto con ese nombre." : error.message);
      return;
    }
    setForm({ nombre: "", unidad: "", precio_referencia: "", proveedor_id: "" });
    setEditId(null);
    cargar();
  }

  function editar(c: any) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre,
      unidad: c.unidad ?? "",
      precio_referencia: c.precio_referencia != null ? String(c.precio_referencia) : "",
      proveedor_id: c.proveedor_id ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminar(c: any) {
    if (!confirm(`¿Eliminar "${c.nombre}"?`)) return;
    const { error } = await supabase.from("adm_conceptos").delete().eq("id", c.id);
    if (error) setError(error.message);
    else cargar();
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter((c) => !q || c.nombre.toLowerCase().includes(q));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Productos y conceptos</h1>
      <p className="mb-4 text-sm text-campo-600">
        Aquí das de alta lo que compras y no es agroquímico ni empaque (refacciones, servicios, herramientas…). Los
        agroquímicos ({agro.length}) y materiales de empaque ({mats.length}) salen solos del catálogo y se enlazan con su inventario;
        se dan de alta en Planeación → Catálogos.
      </p>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="card mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-campo-800">{editId ? "Editar concepto" : "Nuevo concepto"}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Unidad</label>
            <input className="input" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Precio de referencia</label>
            <input type="number" step="any" className="input" value={form.precio_referencia} onChange={(e) => setForm({ ...form, precio_referencia: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Proveedor habitual</label>
            <select className="input" value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}>
              <option value="">—</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" onClick={guardar}>{editId ? "Guardar cambios" : "Agregar concepto"}</button>
          {editId && (
            <button className="btn-secondary" onClick={() => { setEditId(null); setForm({ nombre: "", unidad: "", precio_referencia: "", proveedor_id: "" }); }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <input className="input mb-3 max-w-xs" placeholder="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Concepto</th>
              <th className="px-4 py-2">Unidad</th>
              <th className="px-4 py-2 text-right">Precio ref.</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={5}>Sin conceptos.</td></tr>
            )}
            {visibles.map((c) => (
              <tr key={c.id} className="border-t border-campo-50">
                <td className="px-4 py-2 font-medium text-campo-900">{c.nombre}</td>
                <td className="px-4 py-2 text-campo-700">{c.unidad ?? "—"}</td>
                <td className="px-4 py-2 text-right text-campo-700">{c.precio_referencia != null ? Number(c.precio_referencia).toLocaleString("es-MX") : "—"}</td>
                <td className="px-4 py-2 text-campo-700">{c.adm_proveedores?.nombre ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <button className="btn-secondary mr-1 text-xs" onClick={() => editar(c)}>Editar</button>
                  <button className="btn-danger text-xs" onClick={() => eliminar(c)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
