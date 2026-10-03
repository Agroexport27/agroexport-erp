"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarPdfPlanDeshierbe } from "@/lib/pdf/planDeshierbe";
import { fechaLocalHoy } from "@/lib/fechaLocal";

type Opcion = { id: string; label: string };

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function lunesDeLaSemana(fechaISO: string): Date {
  const d = new Date(fechaISO + "T00:00:00");
  const dia = d.getDay(); // 0=domingo...6=sabado
  const diffHastaLunes = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diffHastaLunes);
  return d;
}

function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

function formatoISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PlanDeshierbePage() {
  const supabase = createClient();

  const [ciclos, setCiclos] = useState<{ id: string; clave: string }[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [programa, setPrograma] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaReferencia, setFechaReferencia] = useState(fechaLocalHoy());
  const [registrosReales, setRegistrosReales] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("ciclos")
      .select("id, clave")
      .order("clave", { ascending: false })
      .then(({ data }) => {
        setCiclos(data ?? []);
        if (data && data.length > 0) setCicloId(data[0].id);
      });
  }, []);

  async function cargarPrograma() {
    if (!cicloId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("cuadro_ciclo")
      .select(
        "id, hectareas, fecha_planeada, fecha_real, cuadros(id, nombre, campos(nombre)), variedades(nombre, cultivos(nombre))"
      )
      .eq("ciclo_id", cicloId);
    if (error) setError(error.message);
    else setPrograma(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarPrograma();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  // Ventana de deshierbe por cuadro: de la fecha de siembra hasta 60
  // dias despues (una semana antes de cosecha, segun se definio), con
  // jornales fijos = piso(hectareas), constante todos los dias.
  const cuadrosConVentana = useMemo(() => {
    return programa
      .map((p: any) => {
        const fechaSiembra = p.fecha_real ?? p.fecha_planeada;
        if (!fechaSiembra) return null;
        const inicio = new Date(fechaSiembra + "T00:00:00");
        const fin = sumarDias(inicio, 60);
        return {
          id: p.id,
          campo: p.cuadros?.campos?.nombre ?? "",
          cuadro: p.cuadros?.nombre ?? "",
          cultivo: p.variedades?.cultivos?.nombre ?? "",
          hectareas: Number(p.hectareas ?? 0),
          jornales: Math.floor(Number(p.hectareas ?? 0)),
          inicio,
          fin,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c != null && c.jornales > 0);
  }, [programa]);

  const lunes = useMemo(() => lunesDeLaSemana(fechaReferencia), [fechaReferencia]);
  const diasDeLaSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)),
    [lunes]
  );

  // Plan: por cada dia de la semana, que cuadros necesitan deshierbe y con cuantos jornales
  const planPorDia = useMemo(() => {
    return diasDeLaSemana.map((dia) => {
      const items = cuadrosConVentana
        .filter((c) => dia >= c.inicio && dia <= c.fin)
        .map((c) => ({ campo: c.campo, cuadro: c.cuadro, cultivo: c.cultivo, jornales: c.jornales }));
      return { fecha: dia, items };
    });
  }, [diasDeLaSemana, cuadrosConVentana]);

  async function cargarRealDeshierbe() {
    const { data: actividadesDeshierbe } = await supabase
      .from("actividades")
      .select("id")
      .ilike("nombre", "%deshierbe%");
    const ids = (actividadesDeshierbe ?? []).map((a: any) => a.id);
    if (ids.length === 0) {
      setRegistrosReales([]);
      return;
    }
    const desde = formatoISO(lunes);
    const hasta = formatoISO(sumarDias(lunes, 6));
    const { data } = await supabase
      .from("apuntador_diario")
      .select("fecha, cuadro_id, cuadros(nombre, campos(nombre))")
      .in("actividad_id", ids)
      .gte("fecha", desde)
      .lte("fecha", hasta);
    setRegistrosReales(data ?? []);
  }

  useEffect(() => {
    cargarRealDeshierbe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lunes]);

  // Real: jornales (personas) registradas por dia+cuadro en deshierbe
  const realPorDiaCuadro = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of registrosReales) {
      const key = `${r.fecha}__${r.cuadro_id}`;
      mapa.set(key, (mapa.get(key) ?? 0) + 1);
    }
    return mapa;
  }, [registrosReales]);

  function jornalesReales(fechaISO: string, cuadroId: string): number {
    return realPorDiaCuadro.get(`${fechaISO}__${cuadroId}`) ?? 0;
  }

  function descargarPdf() {
    generarPdfPlanDeshierbe({
      semanaLabel: `${formatoISO(lunes)} a ${formatoISO(sumarDias(lunes, 6))}`,
      dias: planPorDia.map((d, i) => ({
        etiqueta: `${DIAS_SEMANA[i]} ${formatoISO(d.fecha).slice(8, 10)}/${formatoISO(d.fecha).slice(5, 7)}`,
        items: d.items,
      })),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Plan de deshierbe</h1>
      <p className="mb-6 text-sm text-campo-600">
        1 jornal fijo por hectárea (redondeado hacia abajo) desde el día de siembra hasta 60 días después,
        constante todos los días de esa ventana.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Ciclo</label>
          <select className="input" value={cicloId} onChange={(e) => setCicloId(e.target.value)}>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Semana (elige cualquier día de esa semana)
          </label>
          <input
            type="date"
            className="input"
            value={fechaReferencia}
            onChange={(e) => setFechaReferencia(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={descargarPdf}>
          Descargar plan de la semana (PDF)
        </button>
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando programa...</p>}

      <p className="mb-3 text-sm text-campo-600">
        Semana del <strong>{formatoISO(lunes)}</strong> al <strong>{formatoISO(sumarDias(lunes, 6))}</strong>
      </p>

      {planPorDia.map((dia, i) => (
        <div key={i} className="card mb-3 overflow-hidden">
          <div className="bg-campo-50 px-4 py-2">
            <h2 className="text-sm font-semibold text-campo-800">
              {DIAS_SEMANA[i]} — {formatoISO(dia.fecha)}
            </h2>
          </div>
          {dia.items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-campo-400">Sin deshierbe programado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-campo-600">
                <tr>
                  <th className="px-4 py-2">Campo</th>
                  <th className="px-4 py-2">Cuadro</th>
                  <th className="px-4 py-2">Cultivo</th>
                  <th className="px-4 py-2">Jornales plan</th>
                  <th className="px-4 py-2">Jornales reales</th>
                </tr>
              </thead>
              <tbody>
                {dia.items.map((item, j) => {
                  const cuadroCompleto = cuadrosConVentana.find(
                    (c) => c.campo === item.campo && c.cuadro === item.cuadro
                  );
                  const programaOriginal = programa.find(
                    (p) =>
                      p.cuadros?.campos?.nombre === item.campo && p.cuadros?.nombre === item.cuadro
                  );
                  const real = programaOriginal
                    ? jornalesReales(formatoISO(dia.fecha), programaOriginal.cuadros?.id ?? "")
                    : 0;
                  return (
                    <tr key={j} className="border-t border-campo-50">
                      <td className="px-4 py-2 text-campo-800">{item.campo}</td>
                      <td className="px-4 py-2 text-campo-800">{item.cuadro}</td>
                      <td className="px-4 py-2 text-campo-800">{item.cultivo}</td>
                      <td className="px-4 py-2 text-campo-800">{item.jornales}</td>
                      <td className="px-4 py-2 text-campo-800">
                        {real > 0 ? (
                          <span className={real === item.jornales ? "text-campo-700" : "text-tierra-600"}>
                            {real}
                          </span>
                        ) : (
                          <span className="text-campo-300">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
