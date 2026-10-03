"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelReporteNominas, FilaResumen } from "@/lib/excel/reporteNominas";
import { generarPdfReporteNominas } from "@/lib/pdf/reporteNominas";
import { fechaLocalHoy } from "@/lib/fechaLocal";

type Opcion = { id: string; label: string };

function inicioDeSemanaActual() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = (dia + 1) % 7; // dias desde el sabado pasado
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - diff);
  return inicio.toISOString().slice(0, 10);
}

export default function ReportesNominasPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [hectareasPorCampo, setHectareasPorCampo] = useState<Record<string, number>>({});
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(inicioDeSemanaActual());
  const [fechaFin, setFechaFin] = useState(fechaLocalHoy());
  const [campoId, setCampoId] = useState("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));

    supabase
      .from("cuadros")
      .select("hectareas, campos(nombre)")
      .then(({ data }) => {
        const totales: Record<string, number> = {};
        for (const c of (data ?? []) as any[]) {
          const nombreCampo = c.campos?.nombre;
          if (!nombreCampo) continue;
          totales[nombreCampo] = (totales[nombreCampo] ?? 0) + Number(c.hectareas ?? 0);
        }
        setHectareasPorCampo(totales);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("apuntador_diario")
      .select(
        "id, fecha, total, campos(nombre), cuadros(nombre, hectareas), actividades(nombre)"
      )
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);

    if (campoId) query = query.eq("campo_id", campoId);

    const { data, error } = await query;
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { porCampo, porCuadro, porActividad, porCuadroActividad, granTotal } = useMemo(() => {
    const campoMap = new Map<string, FilaResumen>();
    const cuadroMap = new Map<string, FilaResumen>();
    const actividadMap = new Map<string, FilaResumen>();
    const cruceMap = new Map<string, { cuadro: string; actividad: string; registros: number; total: number }>();
    let granTotal = 0;

    for (const r of registros) {
      const total = Number(r.total ?? 0);
      granTotal += total;

      const nombreCampo = r.campos?.nombre ?? "Sin campo";
      const c =
        campoMap.get(nombreCampo) ??
        { nombre: nombreCampo, registros: 0, total: 0, hectareas: hectareasPorCampo[nombreCampo] ?? null };
      c.registros++;
      c.total += total;
      campoMap.set(nombreCampo, c);

      const nombreCuadro = r.cuadros?.nombre ?? "General";
      const q =
        cuadroMap.get(nombreCuadro) ??
        { nombre: nombreCuadro, registros: 0, total: 0, hectareas: r.cuadros?.hectareas ?? null };
      q.registros++;
      q.total += total;
      cuadroMap.set(nombreCuadro, q);

      const nombreActividad = r.actividades?.nombre ?? "Sin actividad";
      const a = actividadMap.get(nombreActividad) ?? { nombre: nombreActividad, registros: 0, total: 0 };
      a.registros++;
      a.total += total;
      actividadMap.set(nombreActividad, a);

      const claveCruce = `${nombreCuadro}__${nombreActividad}`;
      const x =
        cruceMap.get(claveCruce) ??
        { cuadro: nombreCuadro, actividad: nombreActividad, registros: 0, total: 0 };
      x.registros++;
      x.total += total;
      cruceMap.set(claveCruce, x);
    }

    const orden = (a: FilaResumen, b: FilaResumen) => b.total - a.total;

    return {
      porCampo: Array.from(campoMap.values()).sort(orden),
      porCuadro: Array.from(cuadroMap.values()).sort(orden),
      porActividad: Array.from(actividadMap.values()).sort(orden),
      porCuadroActividad: Array.from(cruceMap.values()).sort((a, b) => b.total - a.total),
      granTotal,
    };
  }, [registros, hectareasPorCampo]);

  function descargarExcel() {
    generarExcelReporteNominas({
      porCampo,
      porCuadro,
      porActividad,
      porCuadroActividad,
      rango: `${fechaInicio}_a_${fechaFin}`,
    });
  }

  function descargarPdf() {
    generarPdfReporteNominas({
      porCampo,
      porCuadro,
      porActividad,
      porCuadroActividad,
      rango: `${fechaInicio}_a_${fechaFin}`,
      granTotal,
    });
  }

  function TablaResumen({
    titulo,
    filas,
    conHectareas,
  }: {
    titulo: string;
    filas: FilaResumen[];
    conHectareas?: boolean;
  }) {
    return (
      <div className="card mb-6 overflow-hidden">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">{titulo}</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Registros</th>
              {conHectareas && <th className="px-4 py-2">Hectáreas</th>}
              {conHectareas && <th className="px-4 py-2">Costo/ha</th>}
              <th className="px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={conHectareas ? 5 : 3}>
                  Sin datos en el rango seleccionado.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{f.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{f.registros}</td>
                {conHectareas && (
                  <td className="px-4 py-2 text-campo-800">
                    {f.hectareas ?? "—"}
                  </td>
                )}
                {conHectareas && (
                  <td className="px-4 py-2 text-campo-800">
                    {f.hectareas && f.hectareas > 0
                      ? `$${(f.total / f.hectareas).toFixed(2)}`
                      : "—"}
                  </td>
                )}
                <td className="px-4 py-2 text-campo-800">
                  ${f.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">
        Reportes de costo — Nóminas
      </h1>
      <p className="mb-6 text-sm text-campo-600">
        Costo de mano de obra por campo, cuadro y actividad, en el rango que
        elijas.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-4 items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Desde
          </label>
          <input
            type="date"
            className="input"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Hasta
          </label>
          <input
            type="date"
            className="input"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Campo (opcional)
          </label>
          <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
            <option value="">Todos</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </div>

      <div className="card mb-6 flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-campo-500">Total del periodo</p>
          <p className="text-2xl font-semibold text-campo-900">
            ${granTotal.toFixed(2)}
          </p>
          <p className="text-xs text-campo-500">{registros.length} registros</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={descargarExcel}>
            Descargar Excel
          </button>
          <button className="btn-secondary" onClick={descargarPdf}>
            Descargar PDF
          </button>
        </div>
      </div>

      <TablaResumen titulo="Costo por campo" filas={porCampo} conHectareas />
      <TablaResumen titulo="Costo por cuadro" filas={porCuadro} conHectareas />
      <TablaResumen titulo="Costo por actividad" filas={porActividad} />

      <h2 className="mb-2 mt-8 text-sm font-semibold text-campo-800">
        Desglose por cuadro (actividades dentro de cada cuadro)
      </h2>
      {porCuadro.map((q) => {
        const detalle = porCuadroActividad
          .filter((x) => x.cuadro === q.nombre)
          .sort((a, b) => b.total - a.total);
        return (
          <details key={q.nombre} className="card mb-2 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
              <span className="text-sm font-medium text-campo-800">
                {q.nombre}
              </span>
              <span className="text-sm text-campo-600">${q.total.toFixed(2)}</span>
            </summary>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-campo-600">
                <tr>
                  <th className="px-4 py-2">Actividad</th>
                  <th className="px-4 py-2">Registros</th>
                  <th className="px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((d) => (
                  <tr key={d.actividad} className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">{d.actividad}</td>
                    <td className="px-4 py-2 text-campo-800">{d.registros}</td>
                    <td className="px-4 py-2 text-campo-800">${d.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        );
      })}

      <h2 className="mb-2 mt-8 text-sm font-semibold text-campo-800">
        Desglose por actividad (cuadros dentro de cada actividad)
      </h2>
      {porActividad.map((a) => {
        const detalle = porCuadroActividad
          .filter((x) => x.actividad === a.nombre)
          .sort((x, y) => y.total - x.total);
        return (
          <details key={a.nombre} className="card mb-2 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
              <span className="text-sm font-medium text-campo-800">
                {a.nombre}
              </span>
              <span className="text-sm text-campo-600">${a.total.toFixed(2)}</span>
            </summary>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-campo-600">
                <tr>
                  <th className="px-4 py-2">Cuadro</th>
                  <th className="px-4 py-2">Registros</th>
                  <th className="px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((d) => (
                  <tr key={d.cuadro} className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">{d.cuadro}</td>
                    <td className="px-4 py-2 text-campo-800">{d.registros}</td>
                    <td className="px-4 py-2 text-campo-800">${d.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        );
      })}
    </div>
  );
}
