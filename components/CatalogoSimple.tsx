"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { value: string; label: string };

export type CampoDef = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  options?: Opcion[];
  // Para selects que dependen de otra tabla (ej. campo_base_id -> campos)
  relacion?: { tabla: string; valueCol: string; labelCol: string };
  requerido?: boolean;
};

// Componente genérico para catálogos simples: lista + agregar + eliminar.
// Se usa para viveros, distribuidores, proveedores de semilla, actividades,
// materiales de empaque, ciclos, productos agroquímicos, vehículos, etc.
export default function CatalogoSimple({
  tabla,
  titulo,
  subtitulo,
  campos,
  ordenPor,
  ordenNumerico,
}: {
  tabla: string;
  titulo: string;
  subtitulo?: string;
  campos: CampoDef[];
  ordenPor: string;
  ordenNumerico?: boolean;
}) {
  const supabase = createClient();
  const [filas, setFilas] = useState<any[]>([]);
  const [opcionesRelacion, setOpcionesRelacion] = useState<
    Record<string, Opcion[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");

  const LIMITE_SIN_BUSCAR = 200;
  const filasFiltradas = busqueda.trim()
    ? filas.filter((f) =>
        campos.some((c) =>
          String(f[c.name] ?? "").toLowerCase().includes(busqueda.trim().toLowerCase())
        )
      )
    : filas.slice(0, LIMITE_SIN_BUSCAR);

  async function cargar() {
    setLoading(true);

    // Supabase limita cuantas filas devuelve por request (normalmente
    // 1000). Para catalogos grandes (ej. 12,000+ empleados) hay que
    // pedirlas en tandas hasta traerlas todas.
    const TAMANO_TANDA = 1000;
    let todasLasFilas: any[] = [];
    let desde = 0;
    let error: any = null;

    while (true) {
      const { data, error: errTanda } = await supabase
        .from(tabla)
        .select("*")
        .order(ordenPor)
        .range(desde, desde + TAMANO_TANDA - 1);
      if (errTanda) {
        error = errTanda;
        break;
      }
      todasLasFilas = todasLasFilas.concat(data ?? []);
      if (!data || data.length < TAMANO_TANDA) break;
      desde += TAMANO_TANDA;
    }

    if (error) setError(error.message);
    else {
      let filasCargadas = todasLasFilas;
      if (ordenNumerico) {
        filasCargadas = [...filasCargadas].sort(
          (a, b) => Number(a[ordenPor]) - Number(b[ordenPor])
        );
      }
      setFilas(filasCargadas);
    }

    // Carga las opciones de los selects que dependen de otra tabla
    for (const campo of campos) {
      if (campo.relacion) {
        const { data: relData } = await supabase
          .from(campo.relacion.tabla)
          .select(`${campo.relacion.valueCol}, ${campo.relacion.labelCol}`)
          .order(campo.relacion.labelCol);
        setOpcionesRelacion((prev) => ({
          ...prev,
          [campo.name]: (relData ?? []).map((r: any) => ({
            value: r[campo.relacion!.valueCol],
            label: r[campo.relacion!.labelCol],
          })),
        }));
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valoresEdicion, setValoresEdicion] = useState<Record<string, string>>({});

  function empezarEdicion(fila: any) {
    setEditandoId(fila.id);
    const iniciales: Record<string, string> = {};
    for (const campo of campos) {
      iniciales[campo.name] = fila[campo.name] ?? "";
    }
    setValoresEdicion(iniciales);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setValoresEdicion({});
  }

  async function guardarEdicion(id: string) {
    const payload: Record<string, any> = {};
    for (const campo of campos) {
      const val = valoresEdicion[campo.name];
      payload[campo.name] =
        val === "" ? null : campo.type === "number" ? parseFloat(val) : val;
    }
    const { error } = await supabase.from(tabla).update(payload).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setEditandoId(null);
    cargar();
  }

  async function agregar() {
    const payload: Record<string, any> = {};
    for (const campo of campos) {
      const val = nuevo[campo.name];
      if (campo.requerido && !val) {
        setError(`Falta "${campo.label}"`);
        return;
      }
      if (val === undefined || val === "") continue;
      payload[campo.name] = campo.type === "number" ? parseFloat(val) : val;
    }
    const { error } = await supabase.from(tabla).insert(payload);
    if (error) {
      setError(
        error.code === "23505"
          ? "Ya existe un registro con ese nombre."
          : error.message
      );
      return;
    }
    setNuevo({});
    setError(null);
    cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) {
      setError(
        "No se pudo eliminar: tiene registros ligados en otra parte del sistema."
      );
      return;
    }
    setError(null);
    cargar();
  }

  function valorMostrable(campo: CampoDef, fila: any) {
    if (campo.relacion) {
      const ops = opcionesRelacion[campo.name] ?? [];
      return ops.find((o) => o.value === fila[campo.name])?.label ?? "—";
    }
    return fila[campo.name] ?? "—";
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">
        {titulo}
        {!loading && (
          <span className="ml-2 text-sm font-normal text-campo-500">
            ({filas.length} registros)
          </span>
        )}
      </h1>
      {subtitulo && <p className="mb-6 text-sm text-campo-600">{subtitulo}</p>}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid items-end gap-3 p-4"
        style={{ gridTemplateColumns: `repeat(${campos.length}, 1fr) auto` }}
      >
        {campos.map((campo) => (
          <div key={campo.name}>
            <label className="mb-1 block text-xs font-medium text-campo-600">
              {campo.label}
            </label>
            {campo.type === "select" || campo.relacion ? (
              <select
                className="input"
                value={nuevo[campo.name] ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, [campo.name]: e.target.value })
                }
              >
                <option value="">Selecciona...</option>
                {(campo.relacion
                  ? opcionesRelacion[campo.name] ?? []
                  : campo.options ?? []
                ).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                type={campo.type === "number" ? "number" : campo.type === "date" ? "date" : "text"}
                step={campo.type === "number" ? "any" : undefined}
                value={nuevo[campo.name] ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, [campo.name]: e.target.value })
                }
              />
            )}
          </div>
        ))}
        <button className="btn-primary" onClick={agregar}>
          Agregar
        </button>
      </div>

      {filas.length > LIMITE_SIN_BUSCAR && (
        <div className="mb-3">
          <input
            className="input max-w-xs"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {!busqueda.trim() && (
            <p className="mt-1 text-xs text-campo-500">
              Mostrando los primeros {LIMITE_SIN_BUSCAR} de {filas.length}. Escribe arriba para buscar en todos.
            </p>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              {campos.map((campo) => (
                <th key={campo.name} className="px-4 py-2">
                  {campo.label}
                </th>
              ))}
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={campos.length + 1}>
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && filasFiltradas.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={campos.length + 1}>
                  {busqueda.trim() ? "Sin resultados." : "Todavía no hay registros. Agrega el primero arriba."}
                </td>
              </tr>
            )}
            {filasFiltradas.map((fila) => (
              <tr key={fila.id} className="border-t border-campo-50">
                {editandoId === fila.id
                  ? campos.map((campo) => (
                      <td key={campo.name} className="px-4 py-2">
                        {campo.type === "select" || campo.relacion ? (
                          <select
                            className="input"
                            value={valoresEdicion[campo.name] ?? ""}
                            onChange={(e) =>
                              setValoresEdicion({
                                ...valoresEdicion,
                                [campo.name]: e.target.value,
                              })
                            }
                          >
                            <option value="">Selecciona...</option>
                            {(campo.relacion
                              ? opcionesRelacion[campo.name] ?? []
                              : campo.options ?? []
                            ).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input"
                            type={
                              campo.type === "number"
                                ? "number"
                                : campo.type === "date"
                                ? "date"
                                : "text"
                            }
                            step={campo.type === "number" ? "any" : undefined}
                            value={valoresEdicion[campo.name] ?? ""}
                            onChange={(e) =>
                              setValoresEdicion({
                                ...valoresEdicion,
                                [campo.name]: e.target.value,
                              })
                            }
                          />
                        )}
                      </td>
                    ))
                  : campos.map((campo) => (
                      <td key={campo.name} className="px-4 py-2 text-campo-800">
                        {valorMostrable(campo, fila)}
                      </td>
                    ))}
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  {editandoId === fila.id ? (
                    <>
                      <button
                        className="btn-secondary mr-2"
                        onClick={() => guardarEdicion(fila.id)}
                      >
                        Guardar
                      </button>
                      <button className="btn-secondary" onClick={cancelarEdicion}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-secondary mr-2"
                        onClick={() => empezarEdicion(fila)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => eliminar(fila.id)}
                      >
                        Eliminar
                      </button>
                    </>
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
