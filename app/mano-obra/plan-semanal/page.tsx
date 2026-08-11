"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarPdfPlanSemanal } from "@/lib/pdf/planSemanal";

type Opcion = { id: string; label: string };

type CuadroPrograma = {
  cuadroId: string;
  cuadroNombre: string;
  campoNombre: string;
  hectareas: number;
  fechaInicio: string;
  cultivoNombre: string;
};

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function lunesDeLaSemana(fechaISO: string): string {
  const d = new Date(fechaISO + "T00:00:00");
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default function PlanSemanalPage() {
  const supabase = createClient();

  const [ciclos, setCiclos] = useState<{ id: string; clave: string }[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [actividadesOpciones, setActividadesOpciones] = useState<Opcion[]>([]);
  const [actividadId, setActividadId] = useState("");
  const [campoId, setCampoId] = useState("");
  const [campos, setCampos] = useState<Opcion[]>([]);
  const [semanaInicio, setSemanaInicio] = useState(lunesDeLaSemana(new Date().toISOString().slice(0, 10)));

  const [cuadrosPrograma, setCuadrosPrograma] = useState<CuadroPrograma[]>([]);
  const [registrosReales, setRegistrosReales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
    supabase
      .from("actividades")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((a: any) => ({ id: a.id, label: a.nombre }));
        setActividadesOpciones(opciones);
        const deshierbe = opciones.find((a: any) => a.label.toUpperCase().includes("DESHIERBE"));
        if (deshierbe) setActividadId(deshierbe.id);
      });
  }, []);

  async function cargarPrograma() {
    if (!cicloId) return;
    setLoading(true);
    setError(null);
    let query = supabase
      .from("cuadro_ciclo")
      .select(
        "hectareas, fecha_planeada, fecha_real, cuadros(id, nombre, campo_id, campos(nombre)), variedades(cultivos(nombre))"
      )
      .eq("ciclo_id", cicloId);
    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    let filas = (data ?? []) as any[];
    if (campoId) filas = filas.filter((r) => r.cuadros?.campo_id === campoId);

    const resultado: CuadroPrograma[] = [];
    for (const r of filas) {
      const fecha = r.fecha_real ?? r.fecha_planeada;
      if (!fecha) continue;
      resultado.push({
        cuadroId: r.cuadros?.id,
        cuadroNombre: r.cuadros?.nombre ?? "",
        campoNombre: r.cuadros?.campos?.nombre ?? "",
        hectareas: Number(r.hectareas ?? 0),
        fechaInicio: fecha,
        cultivoNombre: r.variedades?.cultivos?.nombre ?? "",
      });
    }
    resultado.sort((a, b) => a.cuadroNombre.localeCompare(b.cuadroNombre, undefined, { numeric: true }));
    setCuadrosPrograma(resultado);
    setLoading(false);
  }

  async function cargarReales() {
    if (!actividadId) return;
    const semanaFin = sumarDias(semanaInicio, 6);
    const { data, error } = await supabase
      .from("mano_obra_jornales")
      .select("fecha, cuadro_id, jornales")
      .eq("actividad_id", actividadId)
      .gte("fecha", semanaInicio)
      .lte("fecha", semanaFin);
    if (!error) setRegistrosReales(data ?? []);
  }

  useEffect(() => {
    cargarPrograma();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId, campoId]);

  useEffect(() => {
    cargarReales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaInicio, actividadId]);

  const diasDeLaSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => sumarDias(semanaInicio, i)),
    [semanaInicio]
  );

  const planPorCuadro = useMemo(() => {
    return cuadrosPrograma
      .map((c) => {
        const fechaCorte = sumarDias(c.fechaInicio, 60);
        const jornales = Math.floor(c.hectareas);
        const diasActivos = diasDeLaSemana.map((dia) => dia >= c.fechaInicio && dia <= fechaCorte);
        const activoAlgunDia = diasActivos.some(Boolean);
        return { ...c, jornales, diasActivos, fechaCorte, activoAlgunDia };
      })
      .filter((c) => c.activoAlgunDia && c.jornales > 0);
  }, [cuadrosPrograma, diasDeLaSemana]);

  const realesPorCuadroFecha = useMemo(() => {
    const conteos = new Map<string, number>();
    for (const r of registrosReales) {
      const key = `${r.cuadro_id}__${r.fecha}`;
      conteos.set(key, (conteos.get(key) ?? 0) + Number(r.jornales));
    }
    return conteos;
  }, [registrosReales]);

  function descargarPdf() {
    const nombreActividad = actividadesOpciones.find((a) => a.id === actividadId)?.label ?? "Actividad";
    generarPdfPlanSemanal({
      actividad: nombreActividad,
      semanaInicio,
      dias: diasDeLaSemana,
      filas: planPorCuadro.map((c) => ({
        campo: c.campoNombre,
        cuadro: c.cuadroNombre,
        jornales: c.jornales,
        diasActivos: c.diasActivos,
      })),
    });
  }

  const totalPorDia = diasDeLaSemana.map((_, i) =>
    planPorCuadro.reduce((s, c) => s + (c.diasActivos[i] ? c.jornales : 0), 0)
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Plan semanal de labores</h1>
      <p className="mb-6 text-sm text-campo-600">
        Calcula cuántos jornales entran cada día a cada cuadro (1 jornal/ha, redondeado hacia abajo,
        fijo desde que se planta hasta 60 días después).
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-5">
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
            <option value="">Todos</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Actividad</label>
          <select className="input" value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
            {actividadesOpciones.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Semana (lunes)</label>
          <input
            type="date"
            className="input"
            value={semanaInicio}
            onChange={(e) => setSemanaInicio(lunesDeLaSemana(e.target.value))}
          />
        </div>
        <button className="btn-primary" onClick={descargarPdf}>
          Descargar PDF de la semana
        </button>
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando...</p>}

      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-3 py-2">Campo</th>
              <th className="px-3 py-2">Cuadro</th>
              <th className="px-3 py-2">Cultivo</th>
              <th className="px-3 py-2">Jornales/día</th>
              {DIAS_SEMANA.map((d, i) => (
                <th key={d} className="px-3 py-2 text-center">
                  {d}
                  <br />
                  <span className="font-normal text-[10px] text-campo-400">{diasDeLaSemana[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planPorCuadro.length === 0 && (
              <tr><td className="px-3 py-4 text-campo-400" colSpan={11}>Sin cuadros activos esta semana.</td></tr>
            )}
            {planPorCuadro.map((c) => (
              <tr key={c.cuadroId} className="border-t border-campo-50">
                <td className="px-3 py-2 text-campo-800">{c.campoNombre}</td>
                <td className="px-3 py-2 text-campo-800">{c.cuadroNombre}</td>
                <td className="px-3 py-2 text-campo-600">{c.cultivoNombre}</td>
                <td className="px-3 py-2 font-medium text-campo-800">{c.jornales}</td>
                {c.diasActivos.map((activo, i) => {
                  const key = `${c.cuadroId}__${diasDeLaSemana[i]}`;
                  const real = realesPorCuadroFecha.get(key);
                  return (
                    <td key={i} className="px-3 py-2 text-center">
                      {activo ? (
                        <div>
                          <span className="text-campo-800">{c.jornales}</span>
                          {real !== undefined && (
                            <span
                              className={`ml-1 text-[10px] ${
                                real >= c.jornales ? "text-campo-500" : "text-tierra-600"
                              }`}
                            >
                              (real: {real})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-campo-200">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {planPorCuadro.length > 0 && (
            <tfoot>
              <tr className="border-t border-campo-100 bg-campo-50 font-medium">
                <td className="px-3 py-2 text-campo-800" colSpan={4}>Total jornales/día</td>
                {totalPorDia.map((t, i) => (
                  <td key={i} className="px-3 py-2 text-center text-campo-800">{t || "—"}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-campo-500">
        El número chico "(real: N)" viene de Mano de obra → Registro real de jornales — en verde si cumple
        o supera el plan, en naranja si falta gente.
      </p>
    </div>
  );
}
