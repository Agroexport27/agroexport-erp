"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const VACIO = { nombre: "", rfc: "", contacto: "", telefono: "", email: "", direccion: "", condiciones_pago: "", notas: "" };
const CAMPOS: { k: keyof typeof VACIO; label: string }[] = [
  { k: "nombre", label: "Nombre / razón social" },
  { k: "rfc", label: "RFC" },
  { k: "contacto", label: "Contacto" },
  { k: "telefono", label: "Teléfono" },
  { k: "email", label: "Correo" },
  { k: "direccion", label: "Dirección" },
  { k: "condiciones_pago", label: "Condiciones de pago" },
  { k: "notas", label: "Notas" },
];

export default function ProveedoresPage() {
  const supabase = createClient();
  const [filas, setFilas] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ ...VACIO });
  const [editId, setEditId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const { data, error } = await supabase.from("adm_proveedores").select("*").order("nombre");
    if (error) setError(error.message);
    else setFilas(data ?? []);
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
    const fila: any = {};
    for (const c of CAMPOS) fila[c.k] = form[c.k]?.trim() || null;
    fila.nombre = form.nombre.trim();
    const { error } = editId
      ? await supabase.from("adm_proveedores").update(fila).eq("id", editId)
      : await supabase.from("adm_proveedores").insert(fila);
    if (error) {
      setError(error.code === "23505" ? "Ya existe un proveedor con ese nombre." : error.message);
      return;
    }
    setForm({ ...VACIO });
    setEditId(null);
    cargar();
  }

  function editar(p: any) {
    setEditId(p.id);
    const f: Record<string, string> = {};
    for (const c of CAMPOS) f[c.k] = p[c.k] ?? "";
    setForm(f);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function alternarActivo(p: any) {
    const { error } = await supabase.from("adm_proveedores").update({ activo: !p.activo }).eq("id", p.id);
    if (error) setError(error.message);
    else cargar();
  }

  async function eliminar(p: any) {
    if (!confirm(`¿Eliminar a ${p.nombre}? Las órdenes ya hechas conservan su nombre.`)) return;
    const { error } = await supabase.from("adm_proveedores").delete().eq("id", p.id);
    if (error) setError(error.message);
    else cargar();
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(
    (p) => (verInactivos || p.activo) && (!q || [p.nombre, p.rfc, p.contacto].some((x) => String(x ?? "").toLowerCase().includes(q)))
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Proveedores</h1>
      <p className="mb-4 text-sm text-campo-600">Alta y edición de proveedores para las órdenes de compra.</p>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="card mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-campo-800">{editId ? "Editar proveedor" : "Nuevo proveedor"}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {CAMPOS.map((c) => (
            <div key={c.k}>
              <label className="mb-1 block text-xs font-medium text-campo-600">{c.label}</label>
              <input className="input" value={form[c.k] ?? ""} onChange={(e) => setForm({ ...form, [c.k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" onClick={guardar}>{editId ? "Guardar cambios" : "Agregar proveedor"}</button>
          {editId && (
            <button className="btn-secondary" onClick={() => { setEditId(null); setForm({ ...VACIO }); }}>Cancelar</button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-campo-600">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">RFC</th>
              <th className="px-4 py-2">Contacto</th>
              <th className="px-4 py-2">Pago</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={5}>Sin proveedores.</td></tr>
            )}
            {visibles.map((p) => (
              <tr key={p.id} className={`border-t border-campo-50 ${p.activo ? "" : "opacity-50"}`}>
                <td className="px-4 py-2 font-medium text-campo-900">{p.nombre}</td>
                <td className="px-4 py-2 text-campo-700">{p.rfc ?? "—"}</td>
                <td className="px-4 py-2 text-campo-700">{[p.contacto, p.telefono, p.email].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-2 text-campo-700">{p.condiciones_pago ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <button className="btn-secondary mr-1 text-xs" onClick={() => editar(p)}>Editar</button>
                  <button className="btn-secondary mr-1 text-xs" onClick={() => alternarActivo(p)}>{p.activo ? "Desactivar" : "Activar"}</button>
                  <button className="btn-danger text-xs" onClick={() => eliminar(p)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
