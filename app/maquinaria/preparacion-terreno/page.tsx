"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarPdfPreparacionTerreno } from "@/lib/pdf/preparacionTerreno";

type Opcion = { id: string; label: string };

type Actividad = { id: string; nombre: string; diasPorHectarea: number; orden: number };

type Cuadro = {
  cuadroId: string;
  nombre: string;
  hectareas: number;
  fechaTrasplante: string | null;
};

type Celda = { completado: boolean; fecha: string; dirty?: boolean };

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO + "T00:00:00");
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function PreparacionTerrenoPage() {
  const supabase = createClient();

  const [ciclos, setCiclos] = useState<{ id: string; clave: string }[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [campos, setCampos] = useState<Opcion[]>([]);
  const [campoId, setCampoId] = useState("");

  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [cuadros, setCuadros] = useState<Cuadro[]>([]);
  const [celdas, setCeldas] = useState<Record<string, Celda>>({}); // key: actividadId__cuadroId
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("ciclos")
      .select("id, clave")
      .order("clave", { ascending: false })
      .then(({ data }) => {
        setCiclos(data ?? []);
        if (data && data.length > 0) setCicloId(data[0].id);
      });
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }));
        setCampos(opciones);
        if (opciones.length > 0) setCampoId(opciones[0].id);
      });
    supabase
      .from("preparacion_terreno_actividades")
      .select("id, nombre, dias_por_hectarea, orden")
      .order("orden")
      .then(({ data }) =>
        setActividades(
          (data ?? []).map((a: any) => ({
            id: a.id,
            nombre: a.nombre,
            diasPorHectarea: Number(a.dias_por_hectarea),
            orden: a.orden,
          }))
        )
      );
  }, []);

  async function cargarDatos() {
    if (!cicloId || !campoId) return;
    setLoading(true);
    setError(null);

    const { data: prog, error: errProg } = await supabase
      .from("cuadro_ciclo")
      .select("hectareas, fecha_planeada, fecha_real, cuadros(id, nombre, campo_id, orden)")
      .eq("ciclo_id", cicloId);
    if (errProg) {
      setError(errProg.message);
      setLoading(false);
      return;
    }
    const filasCuadro: Cuadro[] = (prog ?? [])
      .filter((r: any) => r.cuadros?.campo_id === campoId)
      .map((r: any) => ({
        cuadroId: r.cuadros?.id,
        nombre: r.cuadros?.nombre ?? "",
        hectareas: Number(r.hectareas ?? 0),
        fechaTrasplante: r.fecha_real ?? r.fecha_planeada ?? null,
        orden: r.cuadros?.orden ?? 9999,
      }))
      .sort((a: any, b: any) => a.orden - b.orden);
    setCuadros(filasCuadro);

    const cuadroIds = filasCuadro.map((c) => c.cuadroId);
    if (cuadroIds.length > 0) {
      const { data: estatus } = await supabase
        .from("preparacion_terreno_estatus")
        .select("cuadro_id, actividad_prep_id, completado, fecha")
        .eq("ciclo_id", cicloId)
        .in("cuadro_id", cuadroIds);
      const nuevasCeldas: Record<string, Celda> = {};
      for (const e of (estatus ?? []) as any[]) {
        nuevasCeldas[`${e.actividad_prep_id}__${e.cuadro_id}`] = {
          completado: e.completado,
          fecha: e.fecha ?? "",
        };
      }
      setCeldas(nuevasCeldas);
    } else {
      setCeldas({});
    }

    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId, campoId]);

  // Fechas estimadas: cada cuadro tiene su propia secuencia de 14 pasos,
  // terminando justo en la fecha de trasplante (el ultimo paso, CINTA,
  // cae ese mismo dia; los anteriores se calculan hacia atras segun su
  // rendimiento en dias/hectarea).
  const fechasEstimadas = useMemo(() => {
    const mapa: Record<string, string> = {};
    const DIAS_ANTES_DE_TRASPLANTE = 7; // meta: listo 1 semana antes
    for (const cuadro of cuadros) {
      if (!cuadro.fechaTrasplante) continue;
      const fechaMeta = sumarDias(cuadro.fechaTrasplante, DIAS_ANTES_DE_TRASPLANTE);
      const duraciones = actividades.map((a) => a.diasPorHectarea * cuadro.hectareas);
      for (let i = 0; i < actividades.length; i++) {
        const restante = duraciones.slice(i + 1).reduce((s, d) => s + d, 0);
        mapa[`${actividades[i].id}__${cuadro.cuadroId}`] = sumarDias(fechaMeta, Math.round(restante));
      }
    }
    return mapa;
  }, [cuadros, actividades]);

  const [resumenCuadros, setResumenCuadros] = useState<
    (Cuadro & { campoNombre: string })[]
  >([]);
  const [resumenCeldas, setResumenCeldas] = useState<Record<string, boolean>>({});

  async function cargarResumenFaltantes() {
    if (!cicloId) return;
    const { data: prog } = await supabase
      .from("cuadro_ciclo")
      .select("hectareas, fecha_planeada, fecha_real, cuadros(id, nombre, orden, campos(nombre))")
      .eq("ciclo_id", cicloId);
    const filas = (prog ?? []).map((r: any) => ({
      cuadroId: r.cuadros?.id,
      nombre: r.cuadros?.nombre ?? "",
      campoNombre: r.cuadros?.campos?.nombre ?? "",
      hectareas: Number(r.hectareas ?? 0),
      fechaTrasplante: r.fecha_real ?? r.fecha_planeada ?? null,
    }));
    setResumenCuadros(filas);

    const cuadroIds = filas.map((f) => f.cuadroId);
    if (cuadroIds.length > 0) {
      const { data: estatus } = await supabase
        .from("preparacion_terreno_estatus")
        .select("cuadro_id, actividad_prep_id, completado")
        .eq("ciclo_id", cicloId)
        .in("cuadro_id", cuadroIds);
      const mapa: Record<string, boolean> = {};
      for (const e of (estatus ?? []) as any[]) {
        mapa[`${e.actividad_prep_id}__${e.cuadro_id}`] = e.completado;
      }
      setResumenCeldas(mapa);
    } else {
      setResumenCeldas({});
    }
  }

  useEffect(() => {
    cargarResumenFaltantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  const faltantesPorActividad = useMemo(() => {
    return actividades.map((a) => {
      const cuadrosFaltantes = resumenCuadros.filter(
        (c) => !(resumenCeldas[`${a.id}__${c.cuadroId}`] ?? false)
      );
      const totalHa = cuadrosFaltantes.reduce((s, c) => s + c.hectareas, 0);
      return { actividad: a.nombre, totalHa, cuadros: cuadrosFaltantes };
    });
  }, [actividades, resumenCuadros, resumenCeldas]);


  function toggleCompletado(actividadId: string, cuadroId: string) {
    const key = `${actividadId}__${cuadroId}`;
    setCeldas((prev) => {
      const actual = prev[key];
      const nuevoCompletado = !(actual?.completado ?? false);
      return {
        ...prev,
        [key]: {
          completado: nuevoCompletado,
          fecha: nuevoCompletado ? actual?.fecha || new Date().toISOString().slice(0, 10) : "",
          dirty: true,
        },
      };
    });
  }

  function cambiarFecha(actividadId: string, cuadroId: string, fecha: string) {
    const key = `${actividadId}__${cuadroId}`;
    setCeldas((prev) => ({
      ...prev,
      [key]: { completado: prev[key]?.completado ?? false, fecha, dirty: true },
    }));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const filas = Object.entries(celdas)
      .filter(([, v]) => v.dirty)
      .map(([key, v]) => {
        const [actividadId, cuadroId] = key.split("__");
        return {
          actividad_prep_id: actividadId,
          cuadro_id: cuadroId,
          ciclo_id: cicloId,
          completado: v.completado,
          fecha: v.fecha || null,
        };
      });
    if (filas.length === 0) {
      setGuardando(false);
      setError("No hay cambios para guardar.");
      return;
    }
    const { error } = await supabase
      .from("preparacion_terreno_estatus")
      .upsert(filas, { onConflict: "cuadro_id,ciclo_id,actividad_prep_id" });
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMensajeExito(`Guardado: ${filas.length} cambio(s).`);
    setTimeout(() => setMensajeExito(null), 4000);
    cargarDatos();
    cargarResumenFaltantes();
  }

  function descargarPdf() {
    const campoNombre = campos.find((c) => c.id === campoId)?.label ?? "";
    generarPdfPreparacionTerreno({
      campoNombre,
      actividades: actividades.map((a) => a.nombre),
      cuadros: cuadros.map((c) => ({
        nombre: c.nombre,
        hectareas: c.hectareas,
        fechaTrasplante: c.fechaTrasplante,
        celdas: actividades.map((a) => {
          const key = `${a.id}__${c.cuadroId}`;
          const celda = celdas[key];
          const completado = celda?.completado ?? false;
          const fecha = completado ? celda?.fecha || fechasEstimadas[key] || "" : "";
          return { completado, fecha };
        }),
      })),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Preparación de terreno</h1>
      <p className="mb-6 text-sm text-campo-600">
        Marca cada paso conforme se termina. Lo que aún no está marcado muestra una fecha estimada
        (calculada según el rendimiento por hectárea y la fecha de trasplante).
      </p>

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

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Ciclo</label>
          <select className="input" value={cicloId} onChange={(e) => setCicloId(e.target.value)}>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
        <button className="btn-secondary" onClick={descargarPdf}>
          Descargar PDF de avance
        </button>
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando...</p>}
      {!loading && cuadros.length === 0 && (
        <p className="text-sm text-campo-400">
          Este campo no tiene cuadros en el Programa de este ciclo, o no tienen fecha de trasplante todavía.
        </p>
      )}

      {cuadros.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-campo-50 text-xs font-medium text-campo-600">
              <tr>
                <th className="sticky left-0 bg-campo-50 px-3 py-2 text-left">Actividad</th>
                {cuadros.map((c) => (
                  <th key={c.cuadroId} className="px-2 py-1 text-center">
                    {c.nombre}
                  </th>
                ))}
              </tr>
              <tr className="text-[10px] font-normal text-campo-400">
                <td className="sticky left-0 bg-campo-50 px-3 py-1">Has / Trasplante</td>
                {cuadros.map((c) => (
                  <td key={c.cuadroId} className="px-2 py-1 text-center">
                    {c.hectareas} ha
                    <br />
                    {c.fechaTrasplante ?? "sin fecha"}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {actividades.map((a) => (
                <tr key={a.id} className="border-t border-campo-50">
                  <td className="sticky left-0 bg-white px-3 py-1 text-xs text-campo-700">{a.nombre}</td>
                  {cuadros.map((c) => {
                    const key = `${a.id}__${c.cuadroId}`;
                    const celda = celdas[key];
                    const completado = celda?.completado ?? false;
                    return (
                      <td key={c.cuadroId} className="px-1 py-1 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <input
                            type="checkbox"
                            checked={completado}
                            onChange={() => toggleCompletado(a.id, c.cuadroId)}
                          />
                          {completado ? (
                            <span className="text-xs text-campo-600">✓ Listo</span>
                          ) : (
                            <span className="text-[10px] italic text-campo-400">
                              {fechasEstimadas[key] || "—"}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold text-campo-800">
        Resumen de faltantes — todo el ciclo, todos los campos
      </h2>
      <p className="mb-3 text-xs text-campo-500">
        Cuántas hectáreas faltan de cada actividad, y de qué cuadros exactamente.
      </p>
      {faltantesPorActividad.map((f) => (
        <details key={f.actividad} className="card mb-2 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
            <span className="text-sm font-medium text-campo-800">{f.actividad}</span>
            <span className="text-xs text-campo-600">
              {f.totalHa > 0 ? `Faltan ${f.totalHa.toFixed(1)} ha` : "Completo ✓"}
            </span>
          </summary>
          {f.cuadros.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-campo-500">
                <tr>
                  <th className="px-4 py-1">Campo</th>
                  <th className="px-4 py-1">Cuadro</th>
                  <th className="px-4 py-1">Hectáreas</th>
                </tr>
              </thead>
              <tbody>
                {f.cuadros.map((c) => (
                  <tr key={c.cuadroId} className="border-t border-campo-50">
                    <td className="px-4 py-1 text-campo-800">{c.campoNombre}</td>
                    <td className="px-4 py-1 text-campo-800">{c.nombre}</td>
                    <td className="px-4 py-1 text-campo-800">{c.hectareas} ha</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      ))}
    </div>
  );
}
