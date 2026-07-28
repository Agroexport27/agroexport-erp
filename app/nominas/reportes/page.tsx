"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelReporteNominas, FilaResumen, FilaJerarquia } from "@/lib/excel/reporteNominas";
import { generarPdfReporteNominas } from "@/lib/pdf/reporteNominas";

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
  const [actividadesOpciones, setActividadesOpciones] = useState<Opcion[]>([]);
  const [cultivosOpciones, setCultivosOpciones] = useState<Opcion[]>([]);
  const [ciclos, setCiclos] = useState<{ id: string; clave: string; fecha_inicio: string; fecha_fin: string }[]>([]);
  const [hectareasPorCampo, setHectareasPorCampo] = useState<Record<string, number>>({});
  const [hectareasPorCampoCultivo, setHectareasPorCampoCultivo] = useState<Record<string, Record<string, number>>>({});
  const [ordenPorCuadro, setOrdenPorCuadro] = useState<Record<string, number>>({});
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(inicioDeSemanaActual());
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [actividadId, setActividadId] = useState("");
  const [cultivoId, setCultivoId] = useState("");
  const [periodoSemana, setPeriodoSemana] = useState("");
  const [periodoAnio, setPeriodoAnio] = useState("");
  const [cicloId, setCicloId] = useState("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));

    supabase
      .from("cuadros")
      .select("id, nombre, hectareas, cultivo_id, orden, campos(nombre)")
      .then(({ data }) => {
        const totales: Record<string, number> = {};
        const porCampoCultivo: Record<string, Record<string, number>> = {};
        const orden: Record<string, number> = {};
        for (const c of (data ?? []) as any[]) {
          const nombreCampo = c.campos?.nombre;
          if (!nombreCampo) continue;
          totales[nombreCampo] = (totales[nombreCampo] ?? 0) + Number(c.hectareas ?? 0);
          if (c.cultivo_id) {
            porCampoCultivo[nombreCampo] = porCampoCultivo[nombreCampo] ?? {};
            porCampoCultivo[nombreCampo][c.cultivo_id] =
              (porCampoCultivo[nombreCampo][c.cultivo_id] ?? 0) + Number(c.hectareas ?? 0);
          }
          if (c.orden != null && orden[c.nombre] === undefined) {
            orden[c.nombre] = c.orden;
          }
        }
        setHectareasPorCampo(totales);
        setHectareasPorCampoCultivo(porCampoCultivo);
        setOrdenPorCuadro(orden);
      });

    supabase
      .from("actividades")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setActividadesOpciones((data ?? []).map((a: any) => ({ id: a.id, label: a.nombre }))));

    supabase
      .from("ciclos")
      .select("id, clave, fecha_inicio, fecha_fin")
      .order("clave", { ascending: false })
      .then(({ data }) => setCiclos(data ?? []));

    supabase
      .from("cultivos")
      .select("id, nombre, clave_contable")
      .order("nombre")
      .then(({ data }) =>
        setCultivosOpciones(
          (data ?? []).map((c: any) => ({ id: c.id, label: `${c.clave_contable ?? c.nombre} — ${c.nombre}` }))
        )
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicarCiclo(id: string) {
    setCicloId(id);
    const c = ciclos.find((c) => c.id === id);
    if (c) {
      setFechaInicio(c.fecha_inicio);
      setFechaFin(c.fecha_fin);
    }
  }

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("apuntador_diario")
      .select(
        "id, fecha, total, periodo, periodo_anio, cultivo_id, campos(nombre), cuadros(nombre, hectareas), actividades(nombre)"
      )
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);

    if (campoId) query = query.eq("campo_id", campoId);
    if (actividadId) query = query.eq("actividad_id", actividadId);
    if (periodoSemana) query = query.eq("periodo", parseInt(periodoSemana));
    if (periodoAnio) query = query.eq("periodo_anio", parseInt(periodoAnio));

    const { data, error } = await query;
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calcula cuanto de un registro le corresponde al cultivo filtrado.
  // Sin filtro: el total completo. Con filtro: si el registro ya tiene
  // cultivo, todo o nada; si es "General", su parte prorrateada segun
  // hectareas de ese cultivo en el campo.
  function montoEfectivo(r: any): number {
    const total = Number(r.total ?? 0);
    if (!cultivoId) return total;
    if (r.cultivo_id) return r.cultivo_id === cultivoId ? total : 0;
    const nombreCampo = r.campos?.nombre ?? "Sin campo";
    const pesos = hectareasPorCampoCultivo[nombreCampo];
    const denom = pesos ? Object.values(pesos).reduce((s, h) => s + h, 0) : 0;
    const hasCultivo = pesos?.[cultivoId] ?? 0;
    if (!denom || !hasCultivo) return 0;
    return total * (hasCultivo / denom);
  }

  const jerarquia = useMemo(() => {
    type NodoActividad = { nombre: string; registros: number; total: number };
    type NodoCuadro = {
      nombre: string;
      hectareas: number | null;
      total: number;
      actividades: Map<string, NodoActividad>;
    };
    type NodoCampo = {
      nombre: string;
      hectareas: number | null;
      total: number;
      cuadros: Map<string, NodoCuadro>;
    };

    const campoMap = new Map<string, NodoCampo>();

    for (const r of registros) {
      const total = montoEfectivo(r);
      if (total === 0 && cultivoId) continue;
      const nombreCampo = r.campos?.nombre ?? "Sin campo";
      const nombreCuadro = r.cuadros?.nombre ?? "General";
      const nombreActividad = r.actividades?.nombre ?? "Sin actividad";

      const campo =
        campoMap.get(nombreCampo) ??
        { nombre: nombreCampo, hectareas: hectareasPorCampo[nombreCampo] ?? null, total: 0, cuadros: new Map() };
      campo.total += total;

      const cuadro =
        campo.cuadros.get(nombreCuadro) ??
        {
          nombre: nombreCuadro,
          hectareas:
            nombreCuadro === "General"
              ? hectareasPorCampo[nombreCampo] ?? null
              : r.cuadros?.hectareas ?? null,
          total: 0,
          actividades: new Map(),
        };
      cuadro.total += total;

      const actividad =
        cuadro.actividades.get(nombreActividad) ??
        { nombre: nombreActividad, registros: 0, total: 0 };
      actividad.registros += 1;
      actividad.total += total;

      cuadro.actividades.set(nombreActividad, actividad);
      campo.cuadros.set(nombreCuadro, cuadro);
      campoMap.set(nombreCampo, campo);
    }

    return Array.from(campoMap.values())
      .map((c) => ({
        ...c,
        cuadros: Array.from(c.cuadros.values())
          .map((q) => ({
            ...q,
            actividades: Array.from(q.actividades.values()).sort((a, b) => b.total - a.total),
          }))
          .sort((a, b) => (ordenPorCuadro[a.nombre] ?? 9999) - (ordenPorCuadro[b.nombre] ?? 9999)),
      }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, hectareasPorCampo, hectareasPorCampoCultivo, ordenPorCuadro, cultivoId]);

  const jerarquiaPorActividad = useMemo(() => {
    type NodoCuadro = { nombre: string; registros: number; total: number; hectareas: number | null };
    type NodoActividad = {
      nombre: string;
      total: number;
      cuadros: Map<string, NodoCuadro>;
    };
    type NodoCampo = {
      nombre: string;
      hectareas: number | null;
      total: number;
      actividades: Map<string, NodoActividad>;
    };

    const campoMap = new Map<string, NodoCampo>();

    for (const r of registros) {
      const total = montoEfectivo(r);
      if (total === 0 && cultivoId) continue;
      const nombreCampo = r.campos?.nombre ?? "Sin campo";
      const nombreCuadro = r.cuadros?.nombre ?? "General";
      const nombreActividad = r.actividades?.nombre ?? "Sin actividad";

      const campo =
        campoMap.get(nombreCampo) ??
        { nombre: nombreCampo, hectareas: hectareasPorCampo[nombreCampo] ?? null, total: 0, actividades: new Map() };
      campo.total += total;

      const actividad =
        campo.actividades.get(nombreActividad) ??
        { nombre: nombreActividad, total: 0, cuadros: new Map() };
      actividad.total += total;

      const cuadro =
        actividad.cuadros.get(nombreCuadro) ??
        {
          nombre: nombreCuadro,
          registros: 0,
          total: 0,
          hectareas:
            nombreCuadro === "General"
              ? hectareasPorCampo[nombreCampo] ?? null
              : r.cuadros?.hectareas ?? null,
        };
      cuadro.registros += 1;
      cuadro.total += total;

      actividad.cuadros.set(nombreCuadro, cuadro);
      campo.actividades.set(nombreActividad, actividad);
      campoMap.set(nombreCampo, campo);
    }

    return Array.from(campoMap.values())
      .map((c) => ({
        ...c,
        actividades: Array.from(c.actividades.values())
          .map((a) => ({
            ...a,
            cuadros: Array.from(a.cuadros.values()).sort(
              (x, y) => (ordenPorCuadro[x.nombre] ?? 9999) - (ordenPorCuadro[y.nombre] ?? 9999)
            ),
          }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, hectareasPorCampo, hectareasPorCampoCultivo, ordenPorCuadro, cultivoId]);

  const { porCampo, porCuadro, porActividad, porCuadroActividad, granTotal } = useMemo(() => {
    const nombreCampoFiltrado = campos.find((c) => c.id === campoId)?.label;
    // Hectareas a usar para "General": las del campo filtrado, o la suma
    // de TODOS los campos si no filtraste ninguno (hasta tener Programa).
    const hectareasGeneral = nombreCampoFiltrado
      ? hectareasPorCampo[nombreCampoFiltrado] ?? null
      : Object.values(hectareasPorCampo).reduce((s, h) => s + h, 0) || null;

    const campoMap = new Map<string, FilaResumen>();
    const cuadroMap = new Map<string, FilaResumen>();
    const actividadMap = new Map<string, FilaResumen>();
    const cruceMap = new Map<string, { cuadro: string; actividad: string; registros: number; total: number }>();
    let granTotal = 0;

    for (const r of registros) {
      const total = montoEfectivo(r);
      if (total === 0 && cultivoId) continue;
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
        {
          nombre: nombreCuadro,
          registros: 0,
          total: 0,
          hectareas: nombreCuadro === "General" ? hectareasGeneral : r.cuadros?.hectareas ?? null,
        };
      q.registros++;
      q.total += total;
      cuadroMap.set(nombreCuadro, q);

      const nombreActividad = r.actividades?.nombre ?? "Sin actividad";
      const a =
        actividadMap.get(nombreActividad) ??
        { nombre: nombreActividad, registros: 0, total: 0, hectareas: hectareasGeneral };
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

    const ordenTotal = (a: FilaResumen, b: FilaResumen) => b.total - a.total;
    const ordenCuadro = (a: FilaResumen, b: FilaResumen) =>
      (ordenPorCuadro[a.nombre] ?? 9999) - (ordenPorCuadro[b.nombre] ?? 9999);

    return {
      porCampo: Array.from(campoMap.values()).sort(ordenTotal),
      porCuadro: Array.from(cuadroMap.values()).sort(ordenCuadro),
      porActividad: Array.from(actividadMap.values()).sort(ordenTotal),
      porCuadroActividad: Array.from(cruceMap.values()).sort((a, b) => b.total - a.total),
      granTotal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, hectareasPorCampo, ordenPorCuadro, campos, campoId, cultivoId, hectareasPorCampoCultivo]);

  const jerarquiaPlana: FilaJerarquia[] = useMemo(() => {
    const filas: FilaJerarquia[] = [];
    for (const campo of jerarquia) {
      for (const cuadro of campo.cuadros) {
        for (const act of cuadro.actividades) {
          filas.push({
            campo: campo.nombre,
            hectareasCampo: campo.hectareas,
            cuadro: cuadro.nombre,
            hectareasCuadro: cuadro.hectareas,
            actividad: act.nombre,
            registros: act.registros,
            gasto: act.total,
          });
        }
      }
    }
    return filas;
  }, [jerarquia]);

  function descargarExcel() {
    generarExcelReporteNominas({
      porCampo,
      porCuadro,
      porActividad,
      porCuadroActividad,
      jerarquia: jerarquiaPlana,
      rango: `${fechaInicio}_a_${fechaFin}`,
    });
  }

  function descargarPdf() {
    generarPdfReporteNominas({
      porCampo,
      porCuadro,
      porActividad,
      jerarquia,
      jerarquiaPorActividad,
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
              <th className="px-4 py-2">Total</th>
              {conHectareas && <th className="px-4 py-2">Hectáreas</th>}
              {conHectareas && <th className="px-4 py-2">Costo/ha</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={conHectareas ? 4 : 2}>
                  Sin datos en el rango seleccionado.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.nombre} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{f.nombre}</td>
                <td className="px-4 py-2 text-campo-800">${f.total.toFixed(2)}</td>
                {conHectareas && (
                  <td className="px-4 py-2 text-campo-800">{f.hectareas ?? "—"}</td>
                )}
                {conHectareas && (
                  <td className="px-4 py-2 text-campo-800">
                    {f.hectareas && f.hectareas > 0
                      ? `$${(f.total / f.hectareas).toFixed(2)}`
                      : "—"}
                  </td>
                )}
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
        Costo de mano de obra por campo, cuadro, actividad y cultivo, en el
        rango que elijas.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-4 items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Ciclo (opcional, llena fechas)
          </label>
          <select className="input" value={cicloId} onChange={(e) => aplicarCiclo(e.target.value)}>
            <option value="">— Manual —</option>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Desde</label>
          <input type="date" className="input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hasta</label>
          <input type="date" className="input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
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
          <label className="mb-1 block text-xs font-medium text-campo-600">Cultivo</label>
          <select className="input" value={cultivoId} onChange={(e) => setCultivoId(e.target.value)}>
            <option value="">Todos</option>
            {cultivosOpciones.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Actividad</label>
          <select className="input" value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
            <option value="">Todas</option>
            {actividadesOpciones.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Semana (periodo)</label>
          <input type="number" className="input" placeholder="ej. 3" value={periodoSemana} onChange={(e) => setPeriodoSemana(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Año del periodo</label>
          <input type="number" className="input" placeholder="ej. 2026" value={periodoAnio} onChange={(e) => setPeriodoAnio(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </div>

      <div className="card mb-6 flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-campo-500">Total del periodo</p>
          <p className="text-2xl font-semibold text-campo-900">${granTotal.toFixed(2)}</p>
          {cultivoId && (
            <p className="text-xs text-campo-500">
              Filtrado por cultivo — los registros "General" se prorratearon por hectárea.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={descargarExcel}>Descargar Excel</button>
          <button className="btn-secondary" onClick={descargarPdf}>Descargar PDF</button>
        </div>
      </div>

      <TablaResumen titulo="Costo por campo" filas={porCampo} conHectareas />
      <TablaResumen titulo="Costo por cuadro" filas={porCuadro} conHectareas />
      <p className="mb-2 text-xs text-tierra-600">
        {campoId
          ? "\"Costo por actividad\" usa las hectáreas del campo filtrado."
          : "\"Costo por actividad\" usa la suma de hectáreas de todos los campos (no filtraste ninguno)."}{" "}
        Cuando tengamos el Programa real, se ajusta a los cuadros realmente activos.
      </p>
      <TablaResumen titulo="Costo por actividad" filas={porActividad} conHectareas />

      <h2 className="mb-2 mt-8 text-sm font-semibold text-campo-800">
        Desglose por campo: Cuadros
      </h2>
      {jerarquia.map((campo) => {
        const costoHaCampo =
          campo.hectareas && campo.hectareas > 0 ? campo.total / campo.hectareas : null;
        return (
          <details key={campo.nombre} className="card mb-2 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-100 px-4 py-2">
              <span className="text-sm font-semibold text-campo-900">{campo.nombre}</span>
              <span className="flex gap-4 text-sm text-campo-700">
                <span className="font-semibold">${campo.total.toFixed(2)}</span>
                <span>{campo.hectareas ? `${campo.hectareas} ha` : "—"}</span>
                <span>{costoHaCampo != null ? `$${costoHaCampo.toFixed(2)}/ha` : "—"}</span>
              </span>
            </summary>

            <div className="px-3 py-2">
              {campo.cuadros.map((cuadro) => {
                const costoHaCuadro =
                  cuadro.hectareas && cuadro.hectareas > 0 ? cuadro.total / cuadro.hectareas : null;
                return (
                  <details key={cuadro.nombre} className="mb-1 rounded border border-campo-100">
                    <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-3 py-1.5">
                      <span className="text-sm text-campo-800">{cuadro.nombre}</span>
                      <span className="flex gap-4 text-xs text-campo-600">
                        <span className="font-medium">${cuadro.total.toFixed(2)}</span>
                        <span>{cuadro.hectareas ? `${cuadro.hectareas} ha` : "—"}</span>
                        <span>{costoHaCuadro != null ? `$${costoHaCuadro.toFixed(2)}/ha` : "—"}</span>
                      </span>
                    </summary>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs font-medium text-campo-500">
                        <tr>
                          <th className="px-4 py-1">Actividad</th>
                          <th className="px-4 py-1">Gasto total</th>
                          <th className="px-4 py-1">Gasto/ha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuadro.actividades.map((act) => (
                          <tr key={act.nombre} className="border-t border-campo-50">
                            <td className="px-4 py-1 text-campo-800">{act.nombre}</td>
                            <td className="px-4 py-1 text-campo-800">${act.total.toFixed(2)}</td>
                            <td className="px-4 py-1 text-campo-800">
                              {cuadro.hectareas && cuadro.hectareas > 0
                                ? `$${(act.total / cuadro.hectareas).toFixed(2)}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                );
              })}
            </div>
          </details>
        );
      })}

      <h2 className="mb-2 mt-8 text-sm font-semibold text-campo-800">
        Desglose por campo: Actividades
      </h2>
      {jerarquiaPorActividad.map((campo) => {
        const costoHaCampo =
          campo.hectareas && campo.hectareas > 0 ? campo.total / campo.hectareas : null;
        return (
          <details key={campo.nombre} className="card mb-2 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-100 px-4 py-2">
              <span className="text-sm font-semibold text-campo-900">{campo.nombre}</span>
              <span className="flex gap-4 text-sm text-campo-700">
                <span className="font-semibold">${campo.total.toFixed(2)}</span>
                <span>{campo.hectareas ? `${campo.hectareas} ha` : "—"}</span>
                <span>{costoHaCampo != null ? `$${costoHaCampo.toFixed(2)}/ha` : "—"}</span>
              </span>
            </summary>

            <div className="px-3 py-2">
              {campo.actividades.map((actividad) => (
                <details key={actividad.nombre} className="mb-1 rounded border border-campo-100">
                  <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-3 py-1.5">
                    <span className="text-sm text-campo-800">{actividad.nombre}</span>
                    <span className="font-medium text-xs text-campo-600">
                      ${actividad.total.toFixed(2)}
                    </span>
                  </summary>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs font-medium text-campo-500">
                      <tr>
                        <th className="px-4 py-1">Cuadro</th>
                        <th className="px-4 py-1">Gasto total</th>
                        <th className="px-4 py-1">Gasto/ha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actividad.cuadros.map((cuadro) => (
                        <tr key={cuadro.nombre} className="border-t border-campo-50">
                          <td className="px-4 py-1 text-campo-800">{cuadro.nombre}</td>
                          <td className="px-4 py-1 text-campo-800">${cuadro.total.toFixed(2)}</td>
                          <td className="px-4 py-1 text-campo-800">
                            {cuadro.hectareas && cuadro.hectareas > 0
                              ? `$${(cuadro.total / cuadro.hectareas).toFixed(2)}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
