"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarPdfCenso, FilaCensoPdf } from "@/lib/pdf/censo";
import { generarExcelCensos, FilaCensoResumen } from "@/lib/excel/censoResumen";
import { generarExcelApuntador, FilaApuntadorExport } from "@/lib/excel/apuntador";
import { generarPdfApuntador } from "@/lib/pdf/apuntador";
import { generarPdfRecibosNomina, ReciboEmpleado } from "@/lib/pdf/reciboNomina";
import { fechasDePeriodo, diaAnclaPorTipo } from "@/lib/utils/periodo";

type Opcion = { id: string; label: string };

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  maquinaria_taller_almacen: "Maquinaria / Taller / Almacén",
  riego: "Riego",
  jornal: "Jornal",
  operativo: "Operativo",
  "Actividad por temporada": "Actividad por temporada",
};

export default function RegistrosPage() {
  const supabase = createClient();
  const [vista, setVista] = useState<"censos" | "apuntador">("censos");
  const [campos, setCampos] = useState<Opcion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Registros</h1>
      <p className="mb-4 text-sm text-campo-600">
        Historial de censos y del apuntador — busca, revisa y descarga en lote.
      </p>

      <div className="mb-6 flex gap-2 border-b border-campo-100">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            vista === "censos"
              ? "border-b-2 border-campo-600 text-campo-800"
              : "text-campo-400 hover:text-campo-600"
          }`}
          onClick={() => setVista("censos")}
        >
          Censos
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            vista === "apuntador"
              ? "border-b-2 border-campo-600 text-campo-800"
              : "text-campo-400 hover:text-campo-600"
          }`}
          onClick={() => setVista("apuntador")}
        >
          Apuntador
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {vista === "censos" ? (
        <VistaCensos campos={campos} setError={setError} />
      ) : (
        <VistaApuntador campos={campos} setError={setError} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Vista: Censos
// ---------------------------------------------------------------------
function VistaCensos({
  campos,
  setError,
}: {
  campos: Opcion[];
  setError: (e: string | null) => void;
}) {
  const supabase = createClient();
  const [campoId, setCampoId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [censos, setCensos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("censo_diario")
      .select(
        "id, folio, fecha, campos(nombre), censo_diario_detalle(cantidad_personas, puesto_id, actividad_id)"
      )
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .order("fecha", { ascending: false });
    if (campoId) query = query.eq("campo_id", campoId);

    const { data, error } = await query;
    if (error) setError(error.message);
    else setCensos(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filasResumen: FilaCensoResumen[] = useMemo(
    () =>
      censos.map((c: any) => {
        const vistos = new Set<string>();
        let total = 0;
        for (const d of c.censo_diario_detalle ?? []) {
          const key = `${d.puesto_id ?? ""}__${d.actividad_id ?? ""}`;
          if (!vistos.has(key)) {
            vistos.add(key);
            total += d.cantidad_personas ?? 0;
          }
        }
        return {
          fecha: c.fecha,
          campo: c.campos?.nombre ?? "",
          folio: c.folio ?? "—",
          totalPersonas: total,
        };
      }),
    [censos]
  );

  async function eliminarCenso(censoId: string) {
    if (
      !confirm("¿Eliminar este censo? Se borra junto con todo su detalle. No se puede deshacer.")
    )
      return;
    const { error } = await supabase.from("censo_diario").delete().eq("id", censoId);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  async function descargarPdfCenso(censoId: string) {
    const { data, error } = await supabase
      .from("censo_diario")
      .select(
        "fecha, folio, campos(nombre), censo_diario_detalle(cantidad_personas, catalogo_puestos(nombre, categoria), actividades(nombre), censo_detalle_cuadro(cuadros(nombre)))"
      )
      .eq("id", censoId)
      .single();

    if (error || !data) {
      setError(error?.message ?? "No se pudo cargar el censo.");
      return;
    }
    const d = data as any;
    const filas: FilaCensoPdf[] = (d.censo_diario_detalle ?? []).map((det: any) => {
      const categoria = det.catalogo_puestos
        ? ETIQUETAS_CATEGORIA[det.catalogo_puestos.categoria] ?? det.catalogo_puestos.categoria
        : "Actividad por temporada";
      const descripcion = det.catalogo_puestos?.nombre ?? det.actividades?.nombre ?? "—";
      const nombresCuadros = (det.censo_detalle_cuadro ?? [])
        .map((x: any) => x.cuadros?.nombre)
        .filter(Boolean);
      return {
        categoria,
        descripcion,
        cuadro: nombresCuadros.length > 0 ? nombresCuadros.join(", ") : "General",
        cantidad: det.cantidad_personas,
      };
    });

    generarPdfCenso({
      campoNombre: d.campos?.nombre ?? "",
      fecha: d.fecha,
      folio: d.folio,
      filas,
    });
  }

  function descargarExcelTodos() {
    generarExcelCensos(filasResumen, `${fechaInicio}_a_${fechaFin}`);
  }

  return (
    <div>
      <div className="card mb-4 grid grid-cols-4 items-end gap-3 p-4">
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
          <label className="mb-1 block text-xs font-medium text-campo-600">Desde</label>
          <input type="date" className="input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hasta</label>
          <input type="date" className="input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-campo-600">{censos.length} censos encontrados</p>
        <button className="btn-secondary" onClick={descargarExcelTodos} disabled={censos.length === 0}>
          Descargar Excel de todos
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Folio</th>
              <th className="px-4 py-2">Total personas</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={5}>Cargando...</td></tr>}
            {!loading && censos.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={5}>No hay censos con esos filtros.</td></tr>
            )}
            {censos.map((c: any, i: number) => (
              <tr key={c.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{c.fecha}</td>
                <td className="px-4 py-2 text-campo-800">{c.campos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{c.folio ?? "—"}</td>
                <td className="px-4 py-2 text-campo-800">{filasResumen[i]?.totalPersonas}</td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-secondary mr-2" onClick={() => descargarPdfCenso(c.id)}>
                    Descargar PDF
                  </button>
                  <button className="btn-danger" onClick={() => eliminarCenso(c.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Vista: Apuntador
// ---------------------------------------------------------------------
function VistaApuntador({
  campos,
  setError,
}: {
  campos: Opcion[];
  setError: (e: string | null) => void;
}) {
  const supabase = createClient();
  const [campoId, setCampoId] = useState("");
  const [tipoNomina, setTipoNomina] = useState<"eventual" | "planta" | "temporal">("eventual");
  const [periodoSemana, setPeriodoSemana] = useState("");
  const [periodoAnio, setPeriodoAnio] = useState("");
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("apuntador_diario")
      .select(
        "id, fecha, periodo, periodo_anio, tipo_nomina, tipo_pago, avance, tarifa, total, hora_entrada, hora_salida, empleados(clave, nombre), cuadros(nombre), actividades(nombre), campos(nombre)"
      )
      .order("periodo_anio", { ascending: false })
      .order("periodo", { ascending: false })
      .order("fecha", { ascending: false });

    if (campoId) query = query.eq("campo_id", campoId);
    if (tipoNomina) query = query.eq("tipo_nomina", tipoNomina);
    if (periodoSemana) query = query.eq("periodo", parseInt(periodoSemana));
    if (periodoAnio) query = query.eq("periodo_anio", parseInt(periodoAnio));

    const { data, error } = await query.limit(1000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoNomina]);

  const gruposPorCampoPeriodo = useMemo(() => {
    return registros.reduce<Record<string, any[]>>((acc, r) => {
      const campo = r.campos?.nombre ?? "Sin campo";
      const periodo = r.periodo ? `Semana ${r.periodo} - ${r.periodo_anio}` : "Sin periodo";
      const key = `${campo} — ${periodo}`;
      acc[key] = acc[key] ?? [];
      acc[key].push(r);
      return acc;
    }, {});
  }, [registros]);

  function filasParaExport(filas: any[]): FilaApuntadorExport[] {
    return filas.map((r: any) => ({
      fecha: r.fecha,
      campo: r.campos?.nombre ?? "General",
      empleadoClave: r.empleados?.clave ?? "",
      empleadoNombre: r.empleados?.nombre ?? "",
      cuadro: r.cuadros?.nombre ?? "General",
      actividad: r.actividades?.nombre ?? "",
      tipoPago: r.tipo_pago,
      avance: r.avance,
      tarifa: Number(r.tarifa),
      total: Number(r.total),
      periodo: r.periodo ? `S${r.periodo}-${r.periodo_anio}` : "",
    }));
  }

  function descargarExcelTodos() {
    generarExcelApuntador(filasParaExport(registros), `apuntador_registros.xlsx`);
  }

  function descargarPdfTodos() {
    generarPdfApuntador(filasParaExport(registros), "Apuntador — todos los registros filtrados", `apuntador_registros.pdf`);
  }

  function descargarExcelGrupo(filas: any[], nombreGrupo: string) {
    generarExcelApuntador(filasParaExport(filas), `apuntador_${nombreGrupo.replace(/\s+/g, "_")}.xlsx`);
  }

  function descargarPdfGrupo(filas: any[], nombreGrupo: string) {
    generarPdfApuntador(filasParaExport(filas), `Apuntador — ${nombreGrupo}`, `apuntador_${nombreGrupo.replace(/\s+/g, "_")}.pdf`);
  }

  function descargarRecibosGrupo(filas: any[], nombreGrupo: string) {
    const porEmpleado = new Map<string, ReciboEmpleado>();
    for (const r of filas) {
      const clave = r.empleados?.clave ?? "";
      const nombre = r.empleados?.nombre ?? "";
      const key = clave || nombre;
      const recibo =
        porEmpleado.get(key) ?? ({ clave, nombre, filas: [] } as ReciboEmpleado);
      recibo.filas.push({
        fecha: r.fecha,
        actividad: r.actividades?.nombre ?? "",
        cuadro: r.cuadros?.nombre ?? "General",
        horaEntrada: r.hora_entrada,
        horaSalida: r.hora_salida,
        total: Number(r.total ?? 0),
      });
      porEmpleado.set(key, recibo);
    }
    const recibos = Array.from(porEmpleado.values()).map((r) => ({
      ...r,
      filas: r.filas.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    }));
    recibos.sort((a, b) => a.clave.localeCompare(b.clave));

    const campoNombre = filas[0]?.campos?.nombre ?? "";
    const semana = filas[0]?.periodo;
    const anio = filas[0]?.periodo_anio;
    const tipoDelGrupo = filas[0]?.tipo_nomina ?? "eventual";
    const dias = semana && anio ? fechasDePeriodo(semana, anio, diaAnclaPorTipo(tipoDelGrupo)) : [];
    generarPdfRecibosNomina({ campoNombre, periodoLabel: `${nombreGrupo} (${tipoDelGrupo})`, dias, recibos });
  }

  async function eliminarRegistro(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    const { error } = await supabase.from("apuntador_diario").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  async function eliminarGrupo(filas: any[]) {
    if (!confirm(`¿Eliminar los ${filas.length} registros de este grupo?`)) return;
    const ids = filas.map((f) => f.id);
    const { error } = await supabase.from("apuntador_diario").delete().in("id", ids);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  return (
    <div>
      <div className="card mb-6 grid grid-cols-5 items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Tipo de nómina</label>
          <select className="input" value={tipoNomina} onChange={(e) => setTipoNomina(e.target.value as any)}>
            <option value="eventual">Eventual (semana sábado-viernes)</option>
            <option value="planta">Planta (semana miércoles-martes)</option>
            <option value="temporal">Temporal (semana miércoles-martes)</option>
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

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-campo-600">{registros.length} registros encontrados</p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={descargarExcelTodos} disabled={registros.length === 0}>
            Descargar Excel de todos
          </button>
          <button className="btn-secondary" onClick={descargarPdfTodos} disabled={registros.length === 0}>
            Descargar PDF de todos
          </button>
        </div>
      </div>

      {Object.entries(gruposPorCampoPeriodo).map(([grupo, filas]) => {
        const total = filas.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
        return (
          <details key={grupo} className="card mb-3 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
              <span className="text-sm font-semibold text-campo-800">{grupo}</span>
              <span className="flex items-center gap-2 text-sm text-campo-600" onClick={(e) => e.preventDefault()}>
                {filas.length} registros · ${total.toFixed(2)}
                <button className="btn-secondary" onClick={() => descargarExcelGrupo(filas, grupo)}>Excel</button>
                <button className="btn-secondary" onClick={() => descargarPdfGrupo(filas, grupo)}>PDF</button>
                <button className="btn-secondary" onClick={() => descargarRecibosGrupo(filas, grupo)}>Recibos por trabajador</button>
                <button className="btn-danger" onClick={() => eliminarGrupo(filas)}>Eliminar grupo</button>
              </span>
            </summary>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-campo-600">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Empleado</th>
                  <th className="px-4 py-2">Cuadro</th>
                  <th className="px-4 py-2">Actividad</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r: any) => (
                  <tr key={r.id} className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">{r.fecha}</td>
                    <td className="px-4 py-2 text-campo-800">
                      {r.empleados?.clave} — {r.empleados?.nombre}
                    </td>
                    <td className="px-4 py-2 text-campo-800">{r.cuadros?.nombre ?? "General"}</td>
                    <td className="px-4 py-2 text-campo-800">{r.actividades?.nombre}</td>
                    <td className="px-4 py-2 text-campo-800">{r.tipo_pago}</td>
                    <td className="px-4 py-2 text-campo-800">${Number(r.total).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <button className="btn-danger" onClick={() => eliminarRegistro(r.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        );
      })}

      {!loading && registros.length === 0 && (
        <p className="text-sm text-campo-400">No hay registros con esos filtros.</p>
      )}
    </div>
  );
}
