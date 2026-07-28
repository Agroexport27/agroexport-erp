"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Campo = { id: string; nombre: string };
type Cultivo = { id: string; nombre: string };
type Cuadro = {
  id: string;
  campo_id: string;
  nombre: string;
  hectareas: number;
  bajo_malla: boolean;
  cultivo_id: string | null;
  campos: { nombre: string } | null;
};

export default function CuadrosPage() {
  const supabase = createClient();
  const [campos, setCampos] = useState<Campo[]>([]);
  const [cultivos, setCultivos] = useState<Cultivo[]>([]);
  const [cuadros, setCuadros] = useState<Cuadro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [campoId, setCampoId] = useState("");
  const [nombre, setNombre] = useState("");
  const [hectareas, setHectareas] = useState("");
  const [bajoMalla, setBajoMalla] = useState(false);

  async function cargar() {
    setLoading(true);
    const [{ data: cData, error: cErr }, { data: qData, error: qErr }, { data: cvData }] =
      await Promise.all([
        supabase
          .from("campos")
          .select("id, nombre")
          .eq("activo", true)
          .order("nombre"),
        supabase
          .from("cuadros")
          .select(
            "id, campo_id, nombre, hectareas, bajo_malla, cultivo_id, campos(nombre)"
          )
          .order("campo_id")
          .order("nombre"),
        supabase.from("cultivos").select("id, nombre").eq("activo", true).order("nombre"),
      ]);
    if (cErr) setError(cErr.message);
    if (qErr) setError(qErr.message);
    setCampos(cData ?? []);
    setCuadros((qData as any) ?? []);
    setCultivos(cvData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function agregarCuadro() {
    if (!campoId || !nombre.trim() || !hectareas) return;
    const { error } = await supabase.from("cuadros").insert({
      campo_id: campoId,
      nombre: nombre.trim(),
      hectareas: parseFloat(hectareas),
      bajo_malla: bajoMalla,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNombre("");
    setHectareas("");
    setBajoMalla(false);
    cargar();
  }

  async function asignarCultivo(cuadroId: string, cultivoId: string) {
    const { error } = await supabase
      .from("cuadros")
      .update({ cultivo_id: cultivoId || null })
      .eq("id", cuadroId);
    if (error) setError(error.message);
    else cargar();
  }

  async function eliminarCuadro(id: string) {
    if (!confirm("¿Eliminar este cuadro?")) return;
    const { error } = await supabase.from("cuadros").delete().eq("id", id);
    if (error) {
      setError(
        "No se pudo eliminar (tiene registros ligados, ej. programas o cortes)."
      );
      return;
    }
    cargar();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Cuadros</h1>
      <p className="mb-6 text-sm text-campo-600">
        Cada cuadro pertenece a un campo y tiene sus propias hectáreas.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-5 items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Campo
          </label>
          <select
            className="input"
            value={campoId}
            onChange={(e) => setCampoId(e.target.value)}
          >
            <option value="">Selecciona...</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Cuadro #
          </label>
          <input
            className="input"
            placeholder="ej. 27A"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Hectáreas
          </label>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="ej. 10"
            value={hectareas}
            onChange={(e) => setHectareas(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={bajoMalla}
            onChange={(e) => setBajoMalla(e.target.checked)}
          />
          <label className="text-sm text-campo-700">Malla sombra</label>
        </div>
        <button className="btn-primary" onClick={agregarCuadro}>
          Agregar cuadro
        </button>
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando...</p>}

      {campos.map((campo) => {
        const cuadrosDelCampo = cuadros.filter((q) => q.campo_id === campo.id);
        if (cuadrosDelCampo.length === 0) return null;
        const totalHas = cuadrosDelCampo.reduce(
          (sum, q) => sum + Number(q.hectareas),
          0
        );
        return (
          <div key={campo.id} className="card mb-4 overflow-hidden">
            <div className="flex items-center justify-between bg-campo-50 px-4 py-2">
              <h2 className="text-sm font-semibold text-campo-800">
                {campo.nombre}
              </h2>
              <span className="text-xs text-campo-500">
                {cuadrosDelCampo.length} cuadros · {totalHas.toFixed(2)} has
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-campo-600">
                <tr>
                  <th className="px-4 py-2">Cuadro</th>
                  <th className="px-4 py-2">Hectáreas</th>
                  <th className="px-4 py-2">Cultivo actual</th>
                  <th className="px-4 py-2">Malla sombra</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {cuadrosDelCampo.map((q) => (
                  <tr key={q.id} className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">{q.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">
                      {q.hectareas}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="input"
                        value={q.cultivo_id ?? ""}
                        onChange={(e) => asignarCultivo(q.id, e.target.value)}
                      >
                        <option value="">Sin asignar</option>
                        {cultivos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-campo-800">
                      {q.bajo_malla ? "Sí" : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="btn-danger"
                        onClick={() => eliminarCuadro(q.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {!loading && cuadros.length === 0 && (
        <p className="text-sm text-campo-400">
          Todavía no hay cuadros. Agrega el primero arriba.
        </p>
      )}
    </div>
  );
}
