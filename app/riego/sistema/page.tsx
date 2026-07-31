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
  const [editando, setEditando] = useState<Record<string, { caudal: string; sepGoteros: string; sepLineas: string }>>({});

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

  function empezarEdicion(cuadroId: string) {
    const s = sistemas[cuadroId];
    setEditando({
      ...editando,
      [cuadroId]: {
        caudal: s ? String(s.caudal_gotero_lh) : "",
        sepGoteros: s ? String(s.separacion_goteros_m) : "",
        sepLineas: s ? String(s.separacion_lineas_m) : "",
      },
    });
  }

  async function guardar(cuadroId: string) {
    const v = editando[cuadroId];
    if (!v || !v.caudal || !v.sepGoteros || !v.sepLineas) {
      setError("Llena los 3 valores antes de guardar.");
      return;
    }
    const existente = sistemas[cuadroId];
    const payload = {
      cuadro_id: cuadroId,
      caudal_gotero_lh: parseFloat(v.caudal),
      separacion_goteros_m: parseFloat(v.sepGoteros),
      separacion_lineas_m: parseFloat(v.sepLineas),
    };
    const { error } = existente
      ? await supabase.from("sistema_riego_cuadro").update(payload).eq("id", existente.id)
      : await supabase.from("sistema_riego_cuadro").insert(payload);
    if (error) {
      setError(error.message);
      return;
    }
    const nuevo = { ...editando };
    delete nuevo[cuadroId];
    setEditando(nuevo);
    cargar();
  }

  const cuadrosFiltrados = cuadros.filter(
    (c) =>
      !busqueda.trim() ||
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.campos?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Sistema de riego por cuadro</h1>
      <p className="mb-6 text-sm text-campo-600">
        Estos valores se usan para calcular la lámina de riego automáticamente en los reportes.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

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
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Caudal gotero (L/h)</th>
              <th className="px-4 py-2">Sep. goteros (m)</th>
              <th className="px-4 py-2">Sep. líneas (m)</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={6}>Cargando...</td></tr>
            )}
            {!loading &&
              cuadrosFiltrados.map((c) => {
                const s = sistemas[c.id];
                const enEdicion = editando[c.id];
                return (
                  <tr key={c.id} className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">{c.campos?.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">{c.nombre}</td>
                    {enEdicion ? (
                      <>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            className="input w-24"
                            value={enEdicion.caudal}
                            onChange={(e) =>
                              setEditando({ ...editando, [c.id]: { ...enEdicion, caudal: e.target.value } })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            className="input w-24"
                            value={enEdicion.sepGoteros}
                            onChange={(e) =>
                              setEditando({ ...editando, [c.id]: { ...enEdicion, sepGoteros: e.target.value } })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            className="input w-24"
                            value={enEdicion.sepLineas}
                            onChange={(e) =>
                              setEditando({ ...editando, [c.id]: { ...enEdicion, sepLineas: e.target.value } })
                            }
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button className="btn-secondary" onClick={() => guardar(c.id)}>
                            Guardar
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-campo-800">{s?.caudal_gotero_lh ?? "—"}</td>
                        <td className="px-4 py-2 text-campo-800">{s?.separacion_goteros_m ?? "—"}</td>
                        <td className="px-4 py-2 text-campo-800">{s?.separacion_lineas_m ?? "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <button className="btn-secondary" onClick={() => empezarEdicion(c.id)}>
                            {s ? "Editar" : "Definir"}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
