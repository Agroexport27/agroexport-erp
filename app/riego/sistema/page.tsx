"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Cuadro = { id: string; nombre: string; campos: { nombre: string } | null };
type Sistema = {
  id: string;
  cuadro_id: string;
  caudal_gotero_lh: number;
  separacion_goteros_m: number;
  separacion_lineas_m: number;
};

export default function SistemaRiegoPage() {
  const supabase = createClient();
  const [cuadros, setCuadros] = useState<Cuadro[]>([]);
  const [sistemas, setSistemas] = useState<Record<string, Sistema>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const [caudalMasivo, setCaudalMasivo] = useState("");
  const [sepGoterosMasivo, setSepGoterosMasivo] = useState("");
  const [sepLineasMasivo, setSepLineasMasivo] = useState("");
  const [guardandoMasivo, setGuardandoMasivo] = useState(false);

  async function cargar() {
    setLoading(true);
    const [{ data: cua }, { data: sis }] = await Promise.all([
      supabase.from("cuadros").select("id, nombre, campos(nombre)").order("campo_id").order("nombre"),
      supabase.from("sistema_riego_cuadro").select("*"),
    ]);
    setCuadros((cua as any) ?? []);
    const mapa: Record<string, Sistema> = {};
    for (const s of (sis ?? []) as any[]) {
      mapa[s.cuadro_id] = s;
    }
    setSistemas(mapa);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const cuadrosFiltrados = cuadros.filter(
    (c) =>
      !busqueda.trim() ||
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.campos?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (seleccionados.size === cuadrosFiltrados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(cuadrosFiltrados.map((c) => c.id)));
    }
  }

  async function aplicarMasivo() {
    if (seleccionados.size === 0) {
      setError("Selecciona al menos un cuadro (casillas de la izquierda).");
      return;
    }
    if (!caudalMasivo || !sepGoterosMasivo || !sepLineasMasivo) {
      setError("Llena caudal y las dos separaciones antes de aplicar.");
      return;
    }
    setGuardandoMasivo(true);
    setError(null);

    const payload = {
      caudal_gotero_lh: parseFloat(caudalMasivo),
      separacion_goteros_m: parseFloat(sepGoterosMasivo),
      separacion_lineas_m: parseFloat(sepLineasMasivo),
    };

    for (const cuadroId of seleccionados) {
      const existente = sistemas[cuadroId];
      if (existente) {
        await supabase.from("sistema_riego_cuadro").update(payload).eq("id", existente.id);
      } else {
        await supabase.from("sistema_riego_cuadro").insert({ cuadro_id: cuadroId, ...payload });
      }
    }

    setGuardandoMasivo(false);
    setSeleccionados(new Set());
    cargar();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Sistema de riego por cuadro</h1>
      <p className="mb-6 text-sm text-campo-600">
        Caudal del gotero y separaciones (la "cinta") — normalmente es la
        misma para muchos cuadros, así que puedes aplicarla a varios a la
        vez.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Caudal gotero (L/h)</label>
          <input
            type="number"
            step="any"
            className="input w-32"
            value={caudalMasivo}
            onChange={(e) => setCaudalMasivo(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Sep. goteros (m)</label>
          <input
            type="number"
            step="any"
            className="input w-32"
            value={sepGoterosMasivo}
            onChange={(e) => setSepGoterosMasivo(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Sep. líneas (m)</label>
          <input
            type="number"
            step="any"
            className="input w-32"
            value={sepLineasMasivo}
            onChange={(e) => setSepLineasMasivo(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={aplicarMasivo} disabled={guardandoMasivo}>
          {guardandoMasivo
            ? "Aplicando..."
            : `Aplicar a ${seleccionados.size} seleccionados`}
        </button>
      </div>

      <input
        className="input mb-4 max-w-xs"
        placeholder="Buscar cuadro o campo..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={seleccionados.size === cuadrosFiltrados.length && cuadrosFiltrados.length > 0}
                  onChange={toggleTodos}
                />
              </th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Caudal gotero (L/h)</th>
              <th className="px-4 py-2">Sep. goteros (m)</th>
              <th className="px-4 py-2">Sep. líneas (m)</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={6}>Cargando...</td></tr>
            )}
            {!loading &&
              cuadrosFiltrados.map((c) => {
                const s = sistemas[c.id];
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-campo-50 ${
                      seleccionados.has(c.id) ? "bg-campo-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-campo-800">{c.campos?.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">{c.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">{s?.caudal_gotero_lh ?? "—"}</td>
                    <td className="px-4 py-2 text-campo-800">{s?.separacion_goteros_m ?? "—"}</td>
                    <td className="px-4 py-2 text-campo-800">{s?.separacion_lineas_m ?? "—"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
