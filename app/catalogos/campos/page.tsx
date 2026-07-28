"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Campo = {
  id: string;
  nombre: string;
  activo: boolean;
};

// Esta página es el PATRÓN de referencia para todos los catálogos
// editables (proveedores, distribuidores, productos, viveros, etc.):
// listar, agregar, editar inline, eliminar y desactivar.
export default function CamposPage() {
  const supabase = createClient();
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  async function cargarCampos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("campos")
      .select("*")
      .order("nombre");
    if (error) setError(error.message);
    else setCampos(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarCampos();
  }, []);

  async function agregarCampo() {
    if (!nuevoNombre.trim()) return;
    const { error } = await supabase
      .from("campos")
      .insert({ nombre: nuevoNombre.trim() });
    if (error) {
      setError(
        error.code === "23505"
          ? "Ya existe un campo con ese nombre."
          : error.message
      );
      return;
    }
    setNuevoNombre("");
    setError(null);
    cargarCampos();
  }

  async function eliminarCampo(id: string) {
    if (!confirm("¿Eliminar este campo? Esta acción no se puede deshacer.")) {
      return;
    }
    const { error } = await supabase.from("campos").delete().eq("id", id);
    if (error) {
      // Si el campo tiene cuadros u otros registros ligados, la base de
      // datos rechaza el borrado (on delete restrict) para no perder
      // datos. En ese caso, lo correcto es desactivarlo en vez de
      // borrarlo.
      setError(
        "No se pudo eliminar: este campo tiene cuadros u otros registros ligados. Desactívalo en su lugar (botón de estatus) para que deje de aparecer como opción."
      );
      return;
    }
    setError(null);
    cargarCampos();
  }

  async function toggleActivo(campo: Campo) {
    const { error } = await supabase
      .from("campos")
      .update({ activo: !campo.activo })
      .eq("id", campo.id);
    if (error) setError(error.message);
    else cargarCampos();
  }

  const camposVisibles = mostrarInactivos
    ? campos
    : campos.filter((c) => c.activo);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-campo-900">Campos</h1>
          <p className="text-sm text-campo-600">
            Santa Inés, Santa Inés Sur, Don Luis, Guamuchilar...
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-campo-600">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
          />
          Mostrar inactivos
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 flex items-end gap-3 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Nombre del campo nuevo
          </label>
          <input
            className="input"
            placeholder="ej. Casas Grandes"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregarCampo()}
          />
        </div>
        <button className="btn-primary" onClick={agregarCampo}>
          Agregar campo
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Estatus</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={3}>
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && camposVisibles.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={3}>
                  No hay campos {mostrarInactivos ? "" : "activos"} todavía.
                </td>
              </tr>
            )}
            {camposVisibles.map((campo) => (
              <tr key={campo.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{campo.nombre}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleActivo(campo)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      campo.activo
                        ? "bg-campo-100 text-campo-700"
                        : "bg-tierra-100 text-tierra-600"
                    }`}
                  >
                    {campo.activo ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="btn-danger"
                    onClick={() => eliminarCampo(campo.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

