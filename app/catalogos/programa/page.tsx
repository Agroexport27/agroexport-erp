"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { id: string; label: string };
type Cultivo = { id: string; nombre: string };
type Variedad = { id: string; nombre: string; cultivo_id: string };
type Cuadro = { id: string; nombre: string; campo_id: string; hectareas: number };

type Fila = {
  id: string;
  cuadro_id: string;
  variedad_id: string;
  fecha_planeada: string | null;
  fecha_real: string | null;
  hectareas: number | null;
  cantidad_plantas: number | null;
  millares: number | null;
  cuadros: { nombre: string; campo_id: string; campos: { nombre: string } | null } | null;
  variedades: { nombre: string; cultivo_id: string; cultivos: { nombre: string } | null } | null;
};

export default function ProgramaPage() {
  const supabase = createClient();

  const [ciclos, setCiclos] = useState<{ id: string; clave: string }[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [campos, setCampos] = useState<Opcion[]>([]);
  const [cultivos, setCultivos] = useState<Cultivo[]>([]);
  const [variedades, setVariedades] = useState<Variedad[]>([]);
  const [cuadros, setCuadros] = useState<Cuadro[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{
    hectareas: string;
    fechaPlaneada: string;
    fechaReal: string;
  } | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevoCuadroId, setNuevoCuadroId] = useState("");
  const [nuevoVariedadId, setNuevoVariedadId] = useState("");
  const [nuevoHectareas, setNuevoHectareas] = useState("");
  const [nuevoFecha, setNuevoFecha] = useState("");
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  async function cargarCatalogos() {
    const [{ data: cic }, { data: camp }, { data: cult }, { data: vars }, { data: cua }] =
      await Promise.all([
        supabase.from("ciclos").select("id, clave").order("clave", { ascending: false }),
        supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("cultivos").select("id, nombre").order("nombre"),
        supabase.from("variedades").select("id, nombre, cultivo_id").order("nombre"),
        supabase.from("cuadros").select("id, nombre, campo_id, hectareas").order("nombre"),
      ]);
    setCiclos(cic ?? []);
    if (cic && cic.length > 0 && !cicloId) setCicloId(cic[0].id);
    setCampos((camp ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
    setCultivos(cult ?? []);
    setVariedades(vars ?? []);
    setCuadros((cua as any) ?? []);
  }

  async function cargarPrograma(ciclo: string) {
    if (!ciclo) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cuadro_ciclo")
      .select(
        "id, cuadro_id, variedad_id, fecha_planeada, fecha_real, hectareas, cantidad_plantas, millares, cuadros(nombre, campo_id, campos(nombre)), variedades(nombre, cultivo_id, cultivos(nombre))"
      )
      .eq("ciclo_id", ciclo);
    if (error) setError(error.message);
    else setFilas((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cicloId) cargarPrograma(cicloId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  // Agrupa por campo -> cultivo, igual que tu formato original
  const agrupado = useMemo(() => {
    const porCampo = new Map<string, Map<string, Fila[]>>();
    for (const f of filas) {
      const campo = f.cuadros?.campos?.nombre ?? "Sin campo";
      const cultivo = f.variedades?.cultivos?.nombre ?? "Sin cultivo";
      if (!porCampo.has(campo)) porCampo.set(campo, new Map());
      const porCultivo = porCampo.get(campo)!;
      if (!porCultivo.has(cultivo)) porCultivo.set(cultivo, []);
      porCultivo.get(cultivo)!.push(f);
    }
    return Array.from(porCampo.entries()).map(([campo, mapaCultivo]) => ({
      campo,
      cultivos: Array.from(mapaCultivo.entries()).map(([cultivo, filas]) => ({
        cultivo,
        filas: filas.sort((a, b) => (a.cuadros?.nombre ?? "").localeCompare(b.cuadros?.nombre ?? "", undefined, { numeric: true })),
        totalHa: filas.reduce((s, f) => s + Number(f.hectareas ?? 0), 0),
      })),
    }));
  }, [filas]);

  function empezarEdicion(f: Fila) {
    setEditandoId(f.id);
    setEdicion({
      hectareas: f.hectareas != null ? String(f.hectareas) : "",
      fechaPlaneada: f.fecha_planeada ?? "",
      fechaReal: f.fecha_real ?? "",
    });
  }

  async function guardarEdicion(id: string) {
    if (!edicion) return;
    const { error } = await supabase
      .from("cuadro_ciclo")
      .update({
        hectareas: edicion.hectareas ? parseFloat(edicion.hectareas) : null,
        fecha_planeada: edicion.fechaPlaneada || null,
        fecha_real: edicion.fechaReal || null,
      })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditandoId(null);
    setEdicion(null);
    cargarPrograma(cicloId);
  }

  async function eliminarFila(id: string) {
    if (!confirm("¿Quitar este cuadro del programa?")) return;
    const { error } = await supabase.from("cuadro_ciclo").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargarPrograma(cicloId);
  }

  async function agregarNuevo() {
    if (!nuevoCuadroId || !nuevoVariedadId || !nuevoHectareas) {
      setError("Selecciona cuadro, variedad y hectáreas.");
      return;
    }
    setGuardandoNuevo(true);
    setError(null);
    const { error } = await supabase.from("cuadro_ciclo").insert({
      cuadro_id: nuevoCuadroId,
      ciclo_id: cicloId,
      variedad_id: nuevoVariedadId,
      hectareas: parseFloat(nuevoHectareas),
      fecha_planeada: nuevoFecha || null,
    });
    setGuardandoNuevo(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Actualiza tambien el cultivo actual del cuadro (para prorrateo de costos)
    const variedad = variedades.find((v) => v.id === nuevoVariedadId);
    if (variedad) {
      await supabase.from("cuadros").update({ cultivo_id: variedad.cultivo_id }).eq("id", nuevoCuadroId);
    }
    setNuevoCuadroId("");
    setNuevoVariedadId("");
    setNuevoHectareas("");
    setNuevoFecha("");
    setMostrarForm(false);
    cargarPrograma(cicloId);
  }

  const variedadesFiltradas = variedades; // se muestran todas, agrupadas por nombre de cultivo en el label

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Programa</h1>
      <p className="mb-6 text-sm text-campo-600">
        Qué cultivo/variedad tiene sembrado cada cuadro, por ciclo — con fecha planeada y fecha real.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Ciclo</label>
          <select className="input" value={cicloId} onChange={(e) => setCicloId(e.target.value)}>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Agregar cuadro al programa"}
        </button>
      </div>

      {mostrarForm && (
        <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Cuadro</label>
            <select className="input" value={nuevoCuadroId} onChange={(e) => setNuevoCuadroId(e.target.value)}>
              <option value="">Selecciona...</option>
              {cuadros.map((c) => (
                <option key={c.id} value={c.id}>
                  {campos.find((cp) => cp.id === c.campo_id)?.label} — {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Variedad</label>
            <select className="input" value={nuevoVariedadId} onChange={(e) => setNuevoVariedadId(e.target.value)}>
              <option value="">Selecciona...</option>
              {variedadesFiltradas.map((v) => (
                <option key={v.id} value={v.id}>
                  {cultivos.find((c) => c.id === v.cultivo_id)?.nombre} — {v.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Hectáreas</label>
            <input
              type="number"
              step="any"
              className="input"
              value={nuevoHectareas}
              onChange={(e) => setNuevoHectareas(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Fecha planeada</label>
            <input type="date" className="input" value={nuevoFecha} onChange={(e) => setNuevoFecha(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={agregarNuevo} disabled={guardandoNuevo}>
            {guardandoNuevo ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-campo-400">Cargando...</p>}
      {!loading && agrupado.length === 0 && (
        <p className="text-sm text-campo-400">No hay programa capturado para este ciclo todavía.</p>
      )}

      {agrupado.map((c) => (
        <div key={c.campo} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-campo-900">{c.campo}</h2>
          {c.cultivos.map((cv) => (
            <div key={cv.cultivo} className="card mb-3 overflow-x-auto">
              <div className="flex items-center justify-between bg-campo-50 px-4 py-2">
                <h3 className="text-sm font-medium text-campo-800">{cv.cultivo}</h3>
                <span className="text-xs text-campo-600">{cv.totalHa.toFixed(2)} ha total</span>
              </div>
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs font-medium text-campo-600">
                  <tr>
                    <th className="px-4 py-2">Cuadro</th>
                    <th className="px-4 py-2">Hectáreas</th>
                    <th className="px-4 py-2">Variedad</th>
                    <th className="px-4 py-2">Fecha planeada</th>
                    <th className="px-4 py-2">Fecha real</th>
                    <th className="px-4 py-2">Plantas</th>
                    <th className="px-4 py-2">Millares</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cv.filas.map((f) =>
                    editandoId === f.id && edicion ? (
                      <tr key={f.id} className="border-t border-campo-50 bg-campo-50">
                        <td className="px-4 py-1 text-campo-800">{f.cuadros?.nombre}</td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            className="input w-24"
                            value={edicion.hectareas}
                            onChange={(e) => setEdicion({ ...edicion, hectareas: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-1 text-campo-800">{f.variedades?.nombre}</td>
                        <td className="px-2 py-1">
                          <input
                            type="date"
                            className="input"
                            value={edicion.fechaPlaneada}
                            onChange={(e) => setEdicion({ ...edicion, fechaPlaneada: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="date"
                            className="input"
                            value={edicion.fechaReal}
                            onChange={(e) => setEdicion({ ...edicion, fechaReal: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-1 text-campo-600">{f.cantidad_plantas ?? "—"}</td>
                        <td className="px-4 py-1 text-campo-600">{f.millares ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right">
                          <button className="btn-secondary mr-1" onClick={() => guardarEdicion(f.id)}>
                            Guardar
                          </button>
                          <button className="btn-secondary" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={f.id} className="border-t border-campo-50">
                        <td className="px-4 py-2 text-campo-800">{f.cuadros?.nombre}</td>
                        <td className="px-4 py-2 text-campo-800">{f.hectareas ?? "—"}</td>
                        <td className="px-4 py-2 text-campo-800">{f.variedades?.nombre}</td>
                        <td className="px-4 py-2 text-campo-800">{f.fecha_planeada ?? "—"}</td>
                        <td className="px-4 py-2 text-campo-800">
                          {f.fecha_real ?? <span className="text-campo-300">Pendiente</span>}
                        </td>
                        <td className="px-4 py-2 text-campo-600">
                          {f.cantidad_plantas != null ? Number(f.cantidad_plantas).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-2 text-campo-600">{f.millares ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          <button className="btn-secondary mr-1" onClick={() => empezarEdicion(f)}>
                            Editar
                          </button>
                          <button className="btn-danger" onClick={() => eliminarFila(f.id)}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
