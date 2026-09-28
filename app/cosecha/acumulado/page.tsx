"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelAcumulado } from "@/lib/excel/acumulado";
import { generarPdfAcumulado } from "@/lib/pdf/acumulado";

type Opcion = { id: string; label: string };

const TAMANOS_BASE = ["6", "8", "9", "11"];
function tamanoDeCalibre(nombreCalibre: string): string | null {
  const n = (nombreCalibre ?? "").trim().toUpperCase();
  if (n === "M 9" || n === "M9") return "9";
  if (n === "8 COS" || n === "FT 8C") return "8";
  if (n === "6 J" || n === "6 JXL" || n === "4D COS" || n === "4 D") return "6";
  if (TAMANOS_BASE.includes(n)) return n;
  return null;
}

function esCultivoConTamano(nombre: string) {
  const n = (nombre || "").toLowerCase();
  return n.includes("sandía mini") || n.includes("sandia mini");
}

function esCultivoPepino(nombre: string) {
  return (nombre || "").toLowerCase().includes("pepino");
}

// Piezas (pepinos) por caja de cada empaque, para convertir a su
// equivalente en cajas de "36" (36 piezas). Factor = piezas / 36.
// TODO: completar con la tabla completa que Dionisio compartió en PDF —
// por ahora solo estan los 2 ejemplos que dio (RPC 62 y RPC 72).
const PIEZAS_POR_CAJA_PEPINO: Record<string, number> = {
  "RPC 62": 62,
  "RPC 72": 72,
};
function factor36sDe(nombreCalibre: string): number | null {
  const n = (nombreCalibre ?? "").trim().toUpperCase();
  const piezas = PIEZAS_POR_CAJA_PEPINO[n];
  if (!piezas) return null;
  return piezas / 36;
}

export default function AcumuladoCosechaPage() {
  const supabase = createClient();

  const [ciclos, setCiclos] = useState<{ id: string; clave: string; fecha_inicio: string; fecha_fin: string }[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [cultivoId, setCultivoId] = useState("");
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [distribuidorFiltroId, setDistribuidorFiltroId] = useState("");
  const [campos, setCampos] = useState<Opcion[]>([]);
  const [campoDetalleId, setCampoDetalleId] = useState("");
  const [cajasManualPorCorte, setCajasManualPorCorte] = useState<Record<string, string>>({});

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [registros, setRegistros] = useState<any[]>([]);
  const [variedadPorCuadro, setVariedadPorCuadro] = useState<Record<string, { variedad: string; hectareas: number }>>({});
  const [cuadrosPlantados, setCuadrosPlantados] = useState<
    { cuadroId: string; nombre: string; campoId: string; variedad: string; hectareas: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("ciclos")
      .select("id, clave, fecha_inicio, fecha_fin")
      .order("clave", { ascending: false })
      .then(({ data }) => {
        setCiclos(data ?? []);
        if (data && data.length > 0) {
          setCicloId(data[0].id);
          setFechaInicio(data[0].fecha_inicio);
          setFechaFin(data[0].fecha_fin);
        }
      });
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }));
        setCampos(opciones);
        if (opciones.length > 0) setCampoDetalleId(opciones[0].id);
      });
    supabase
      .from("cultivos")
      .select("id, nombre")
      .neq("nombre", "Solarizado")
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }));
        setCultivos(opciones);
        const mini = opciones.find((c: any) => c.label === "Sandía Mini");
        setCultivoId(mini ? mini.id : opciones[0]?.id ?? "");
      });
    supabase
      .from("distribuidores")
      .select("id, nombre")
      .order("orden", { ascending: true, nullsFirst: false })
      .then(({ data }) => setDistribuidores((data ?? []).map((d: any) => ({ id: d.id, label: d.nombre }))));
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
    if (!cicloId || !fechaInicio || !fechaFin || !cultivoId) return;
    setLoading(true);
    setError(null);

    let query = supabase
      .from("corte_diario")
      .select(
        "fecha, cajas, tipo_unidad, numero_corte, cuadro_id, cuadros(nombre, campo_id, campos(nombre)), distribuidores(nombre), calibres(nombre)"
      )
      .eq("cultivo_id", cultivoId)
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);

    if (distribuidorFiltroId) {
      // Un distribuidor especifico elegido (incluyendo Nacional si asi se quiere ver aparte)
      query = query.eq("distribuidor_id", distribuidorFiltroId);
    } else {
      // Por default: todo MENOS Nacional (Nacional se ve aparte, eligiendolo arriba)
      const nacional = distribuidores.find((d) => d.label === "Nacional");
      if (nacional) query = query.neq("distribuidor_id", nacional.id);
    }

    const [{ data: corte, error: errCorte }, { data: prog }, { data: cajasCorte }] = await Promise.all([
      query,
      supabase
        .from("cuadro_ciclo")
        .select("cuadro_id, hectareas, variedades(nombre), cuadros(nombre, campo_id, cultivo_id, cultivos(nombre))")
        .eq("ciclo_id", cicloId),
      supabase
        .from("acumulado_cajas_corte")
        .select("cuadro_id, numero_corte, cajas")
        .eq("ciclo_id", cicloId),
    ]);

    if (errCorte) {
      setError(errCorte.message);
      setLoading(false);
      return;
    }

    const mapaCajasCorte: Record<string, string> = {};
    for (const r of (cajasCorte ?? []) as any[]) {
      mapaCajasCorte[`${r.cuadro_id}__${r.numero_corte}`] = r.cajas != null ? String(r.cajas) : "";
    }
    setCajasManualPorCorte(mapaCajasCorte);

    const mapaVariedad: Record<string, { variedad: string; hectareas: number }> = {};
    const nombreCultivoSel = (cultivos.find((c) => c.id === cultivoId)?.label ?? "").toLowerCase();
    const esVarianteSandiaMini = nombreCultivoSel.includes("sandía mini") || nombreCultivoSel.includes("sandia mini");
    const plantados: { cuadroId: string; nombre: string; campoId: string; variedad: string; hectareas: number }[] = [];

    for (const p of (prog ?? []) as any[]) {
      mapaVariedad[p.cuadro_id] = {
        variedad: p.variedades?.nombre ?? "Sin variedad",
        hectareas: Number(p.hectareas ?? 0),
      };
      const nombreCultivoCuadro = (p.cuadros?.cultivos?.nombre ?? "").toLowerCase();
      const esMismoCultivo = esVarianteSandiaMini
        ? nombreCultivoCuadro.includes("sandía mini") || nombreCultivoCuadro.includes("sandia mini")
        : nombreCultivoCuadro === nombreCultivoSel;
      if (esMismoCultivo) {
        plantados.push({
          cuadroId: p.cuadro_id,
          nombre: p.cuadros?.nombre ?? "",
          campoId: p.cuadros?.campo_id ?? "",
          variedad: p.variedades?.nombre ?? "Sin variedad",
          hectareas: Number(p.hectareas ?? 0),
        });
      }
    }
    setVariedadPorCuadro(mapaVariedad);
    setCuadrosPlantados(plantados);
    setRegistros(corte ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId, cultivoId, distribuidorFiltroId]);

  // ---- Consolidado diario: por campo y por distribuidor ----
  const consolidadoDiario = useMemo(() => {
    const nombresCampo = Array.from(new Set(registros.map((r) => r.cuadros?.campos?.nombre).filter(Boolean))).sort();
    const nombresDist = Array.from(new Set(registros.map((r) => r.distribuidores?.nombre).filter(Boolean))).sort();
    const porFecha = new Map<string, any>();

    for (const r of registros) {
      const fecha = r.fecha;
      const fila =
        porFecha.get(fecha) ??
        {
          fecha,
          porCampo: Object.fromEntries(nombresCampo.map((c) => [c, 0])),
          porDist: Object.fromEntries(nombresDist.map((d) => [d, 0])),
          bins: 0,
          total: 0,
        };
      const campo = r.cuadros?.campos?.nombre;
      const dist = r.distribuidores?.nombre;
      const cajas = Number(r.cajas ?? 0);
      if (campo) fila.porCampo[campo] = (fila.porCampo[campo] ?? 0) + cajas;
      if (dist) fila.porDist[dist] = (fila.porDist[dist] ?? 0) + cajas;
      if (r.tipo_unidad === "bins") fila.bins += cajas;
      fila.total += cajas;
      porFecha.set(fecha, fila);
    }

    return {
      nombresCampo,
      nombresDist,
      filas: Array.from(porFecha.values()).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    };
  }, [registros]);

  const totalGeneral = consolidadoDiario.filas.reduce((s, f) => s + f.total, 0);

  // ---- Detalle por cuadro, para el campo elegido ----
  const detallePorCuadro = useMemo(() => {
    const filasDelCampo = registros.filter((r) => r.cuadros?.campo_id === campoDetalleId);
    const cuadrosInfo = cuadrosPlantados
      .filter((c) => c.campoId === campoDetalleId)
      .map((c) => ({ id: c.cuadroId, nombre: c.nombre, variedad: c.variedad, hectareas: c.hectareas }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }));

    const porFecha = new Map<string, Record<string, number>>();
    for (const r of filasDelCampo) {
      const fecha = r.fecha;
      const fila = porFecha.get(fecha) ?? {};
      fila[r.cuadro_id] = (fila[r.cuadro_id] ?? 0) + Number(r.cajas ?? 0);
      porFecha.set(fecha, fila);
    }
    const fechas = Array.from(porFecha.keys()).sort();

    const totalPorCuadro: Record<string, number> = {};
    for (const c of cuadrosInfo) {
      totalPorCuadro[c.id] = fechas.reduce((s, f) => s + (porFecha.get(f)?.[c.id] ?? 0), 0);
    }

    return { cuadrosInfo, fechas, porFecha, totalPorCuadro };
  }, [registros, campoDetalleId, cuadrosPlantados]);

  // ---- % Resumen: por variedad x calibre, consolidado todos los campos ----
  const resumenVariedad = useMemo(() => {
    const calibresVistos = new Map<string, number>(); // nombre -> orden de aparicion
    const porVariedad = new Map<string, Record<string, number>>();

    for (const r of registros) {
      if (r.tipo_unidad !== "pallet") continue;
      const variedad = variedadPorCuadro[r.cuadro_id]?.variedad ?? "Sin variedad";
      const calibre = r.calibres?.nombre ?? "Otras";
      if (!calibresVistos.has(calibre)) calibresVistos.set(calibre, calibresVistos.size);
      const fila = porVariedad.get(variedad) ?? {};
      fila[calibre] = (fila[calibre] ?? 0) + Number(r.cajas ?? 0);
      porVariedad.set(variedad, fila);
    }

    const calibresOrden = Array.from(calibresVistos.keys());
    const variedades = Array.from(porVariedad.entries()).map(([variedad, cantidades]) => ({
      variedad,
      cantidades,
      total: Object.values(cantidades).reduce((s, v) => s + v, 0),
    }));

    // % por tamaño de CADA variedad (no solo el general)
    for (const v of variedades) {
      const cajasPorTamanoV: Record<string, number> = {};
      for (const c of calibresOrden) {
        const t = tamanoDeCalibre(c);
        if (!t) continue;
        cajasPorTamanoV[t] = (cajasPorTamanoV[t] ?? 0) + (v.cantidades[c] ?? 0);
      }
      (v as any).porcentajesTamano = TAMANOS_BASE.map((t) => ({
        tamano: t,
        porcentaje: v.total > 0 ? ((cajasPorTamanoV[t] ?? 0) / v.total) * 100 : 0,
      }));
    }

    // Cajas equivalentes en "36s" (para Pepino) + % de empaque de CADA variedad
    for (const v of variedades) {
      let cajas36s = 0;
      for (const c of calibresOrden) {
        const f = factor36sDe(c);
        if (f) cajas36s += (v.cantidades[c] ?? 0) * f;
      }
      (v as any).cajas36s = cajas36s;
      (v as any).porcentajesEmpaque = calibresOrden.map((c) => ({
        calibre: c,
        porcentaje: v.total > 0 ? ((v.cantidades[c] ?? 0) / v.total) * 100 : 0,
      }));
    }

    const totalesPorCalibre: Record<string, number> = {};
    for (const v of variedades) {
      for (const c of calibresOrden) {
        totalesPorCalibre[c] = (totalesPorCalibre[c] ?? 0) + (v.cantidades[c] ?? 0);
      }
    }
    const granTotal = Object.values(totalesPorCalibre).reduce((s, v) => s + v, 0);

    // % por tamaño (agrupado), sobre el total general
    const cajasPorTamano: Record<string, number> = {};
    for (const c of calibresOrden) {
      const t = tamanoDeCalibre(c);
      if (!t) continue;
      cajasPorTamano[t] = (cajasPorTamano[t] ?? 0) + (totalesPorCalibre[c] ?? 0);
    }
    const porcentajesTamano = TAMANOS_BASE.map((t) => ({
      tamano: t,
      cajas: cajasPorTamano[t] ?? 0,
      porcentaje: granTotal > 0 ? ((cajasPorTamano[t] ?? 0) / granTotal) * 100 : 0,
    }));

    // % de empaque general (sobre el total, sin agrupar por tamaño) — util para Pepino
    const porcentajesEmpaque = calibresOrden.map((c) => ({
      calibre: c,
      cajas: totalesPorCalibre[c] ?? 0,
      porcentaje: granTotal > 0 ? ((totalesPorCalibre[c] ?? 0) / granTotal) * 100 : 0,
    }));

    const granTotal36s = variedades.reduce((s, v: any) => s + (v.cajas36s ?? 0), 0);

    return {
      calibresOrden,
      variedades,
      totalesPorCalibre,
      granTotal,
      porcentajesTamano,
      porcentajesEmpaque,
      granTotal36s,
    };
  }, [registros, variedadPorCuadro]);

  // ---- Cortes por número (1er, 2do, 3er...) — captura MANUAL, guardada en acumulado_cajas_corte ----
  const CORTES_FIJOS = [1, 2, 3, 4, 5];

  function actualizarCajaManualLocal(cuadroId: string, numero: number, valor: string) {
    setCajasManualPorCorte((prev) => ({ ...prev, [`${cuadroId}__${numero}`]: valor }));
  }

  async function guardarCajaManual(cuadroId: string, numero: number, valor: string) {
    if (!cicloId) return;
    const cajas = valor.trim() === "" ? null : Number(valor);
    const { error } = await supabase
      .from("acumulado_cajas_corte")
      .upsert(
        { ciclo_id: cicloId, cuadro_id: cuadroId, numero_corte: numero, cajas },
        { onConflict: "ciclo_id,cuadro_id,numero_corte" }
      );
    if (error) setError(error.message);
  }

  const cultivoNombreSel = cultivos.find((c) => c.id === cultivoId)?.label ?? "";
  const esPepino = esCultivoPepino(cultivoNombreSel);

  function descargarExcel() {
    generarExcelAcumulado({ consolidadoDiario, detallePorCuadro, resumenVariedad, campoDetalleNombre: campos.find((c) => c.id === campoDetalleId)?.label ?? "", esPepino });
  }
  function descargarPdf() {
    generarPdfAcumulado({ consolidadoDiario, resumenVariedad, cicloLabel: ciclos.find((c) => c.id === cicloId)?.clave ?? "", esPepino });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Acumulado</h1>
      <p className="mb-6 text-sm text-campo-600">
        Total de cajas por día, por campo y por distribuidor — más el % de tamaño por variedad.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-7">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Ciclo</label>
          <select className="input" value={cicloId} onChange={(e) => aplicarCiclo(e.target.value)}>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Cultivo</label>
          <select className="input" value={cultivoId} onChange={(e) => setCultivoId(e.target.value)}>
            {cultivos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Distribuidor</label>
          <select className="input" value={distribuidorFiltroId} onChange={(e) => setDistribuidorFiltroId(e.target.value)}>
            <option value="">Todos (sin Nacional)</option>
            {distribuidores.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
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
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
          <button className="btn-secondary" onClick={descargarExcel}>Excel</button>
          <button className="btn-secondary" onClick={descargarPdf}>PDF</button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <div className="card p-4">
          <p className="text-xs text-campo-500">Total general</p>
          <p className="text-2xl font-semibold text-campo-900">{totalGeneral.toLocaleString()}</p>
        </div>
        {consolidadoDiario.nombresDist.map((d) => {
          const totalDist = consolidadoDiario.filas.reduce((s, f) => s + (f.porDist[d] || 0), 0);
          return (
            <div key={d} className="card p-4">
              <p className="text-xs text-campo-500">{d}</p>
              <p className="text-2xl font-semibold text-campo-900">{totalDist.toLocaleString()}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Consolidado diario</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              {consolidadoDiario.nombresCampo.map((c) => (
                <th key={c} className="px-3 py-2 text-center">{c}</th>
              ))}
              <th className="px-3 py-2 text-center">Total</th>
              {consolidadoDiario.nombresDist.map((d) => (
                <th key={d} className="px-3 py-2 text-center">{d}</th>
              ))}
              <th className="px-3 py-2 text-center">Bins</th>
            </tr>
          </thead>
          <tbody>
            {consolidadoDiario.filas.length === 0 && (
              <tr><td className="px-3 py-4 text-campo-400" colSpan={20}>Sin datos en el rango.</td></tr>
            )}
            {consolidadoDiario.filas.map((f) => (
              <tr key={f.fecha} className="border-t border-campo-50">
                <td className="px-3 py-1 text-campo-800">{f.fecha}</td>
                {consolidadoDiario.nombresCampo.map((c) => (
                  <td key={c} className="px-3 py-1 text-center text-campo-800">{f.porCampo[c] || "—"}</td>
                ))}
                <td className="px-3 py-1 text-center font-medium text-campo-800">{f.total.toFixed(0)}</td>
                {consolidadoDiario.nombresDist.map((d) => (
                  <td key={d} className="px-3 py-1 text-center text-campo-800">{f.porDist[d] || "—"}</td>
                ))}
                <td className="px-3 py-1 text-center text-campo-600">{f.bins > 0 ? f.bins.toFixed(0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Detalle por cuadro</h2>
      <div className="mb-2">
        <select className="input max-w-xs" value={campoDetalleId} onChange={(e) => setCampoDetalleId(e.target.value)}>
          {campos.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              {detallePorCuadro.cuadrosInfo.map((c) => (
                <th key={c.id} className="px-2 py-2 text-center">
                  {c.nombre}
                  <div className="text-[9px] font-normal text-campo-400">{c.variedad} · {c.hectareas} ha</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detallePorCuadro.fechas.length === 0 && (
              <tr><td className="px-3 py-4 text-campo-400" colSpan={10}>Sin cortes en este campo, en el rango.</td></tr>
            )}
            {detallePorCuadro.fechas.map((fecha) => (
              <tr key={fecha} className="border-t border-campo-50">
                <td className="px-3 py-1 text-campo-800">{fecha}</td>
                {detallePorCuadro.cuadrosInfo.map((c) => (
                  <td key={c.id} className="px-2 py-1 text-center text-campo-800">
                    {detallePorCuadro.porFecha.get(fecha)?.[c.id] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-campo-100 bg-campo-50 text-xs font-medium">
              <td className="px-3 py-1 text-campo-700">Total</td>
              {detallePorCuadro.cuadrosInfo.map((c) => (
                <td key={c.id} className="px-2 py-1 text-center text-campo-700">
                  {detallePorCuadro.totalPorCuadro[c.id]?.toFixed(0) || "—"}
                </td>
              ))}
            </tr>
            <tr className="border-t border-campo-50 text-xs">
              <td className="px-3 py-1 text-campo-600">Cajas/ha</td>
              {detallePorCuadro.cuadrosInfo.map((c) => {
                const total = detallePorCuadro.totalPorCuadro[c.id] ?? 0;
                return (
                  <td key={c.id} className="px-2 py-1 text-center text-campo-600">
                    {c.hectareas > 0 ? (total / c.hectareas).toFixed(1) : "—"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {!esPepino && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-campo-800">Cortes por número (manual)</h2>
          <div className="card mb-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
                <tr>
                  <th className="px-3 py-2">Campo</th>
                  <th className="px-3 py-2">Cuadro</th>
                  {["1er", "2do", "3er", "4to", "5to"].map((et) => (
                    <th key={et} className="px-2 py-2 text-center">{et} corte</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuadrosPlantados.length === 0 && (
                  <tr><td className="px-3 py-4 text-campo-400" colSpan={7}>Sin cuadros plantados en este ciclo.</td></tr>
                )}
                {[...cuadrosPlantados]
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }))
                  .map((c) => (
                    <tr key={c.cuadroId} className="border-t border-campo-50">
                      <td className="px-3 py-1 text-campo-600">{campos.find((cc) => cc.id === c.campoId)?.label ?? ""}</td>
                      <td className="px-3 py-1 text-campo-800">{c.nombre}</td>
                      {CORTES_FIJOS.map((n) => {
                        const key = `${c.cuadroId}__${n}`;
                        return (
                          <td key={n} className="px-2 py-1 text-center">
                            <input
                              type="number"
                              className="input w-16 px-1 py-0.5 text-center text-xs"
                              value={cajasManualPorCorte[key] ?? ""}
                              onChange={(e) => actualizarCajaManualLocal(c.cuadroId, n, e.target.value)}
                              onBlur={(e) => guardarCajaManual(c.cuadroId, n, e.target.value)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mb-2 text-sm font-semibold text-campo-800">% Resumen — por variedad</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-3 py-2">Variedad</th>
              {resumenVariedad.calibresOrden.map((c) => (
                <th key={c} className="px-2 py-2 text-center">{c}</th>
              ))}
              <th className="px-3 py-2 text-center">Total</th>
              {esCultivoConTamano(cultivoNombreSel) &&
                TAMANOS_BASE.map((t) => (
                  <th key={t} className="px-2 py-2 text-center">%{t}</th>
                ))}
              {esPepino &&
                resumenVariedad.calibresOrden.map((c) => (
                  <th key={`pct-${c}`} className="px-2 py-2 text-center">%{c}</th>
                ))}
              {esPepino && <th className="px-2 py-2 text-center">Cajas 36s equiv.</th>}
            </tr>
          </thead>
          <tbody>
            {resumenVariedad.variedades.length === 0 && (
              <tr><td className="px-3 py-4 text-campo-400" colSpan={15}>Sin datos.</td></tr>
            )}
            {resumenVariedad.variedades.map((v: any) => (
              <tr key={v.variedad} className="border-t border-campo-50">
                <td className="px-3 py-1 text-campo-800">{v.variedad}</td>
                {resumenVariedad.calibresOrden.map((c) => (
                  <td key={c} className="px-2 py-1 text-center text-campo-800">{v.cantidades[c] || "—"}</td>
                ))}
                <td className="px-3 py-1 text-center font-medium text-campo-800">{v.total.toFixed(0)}</td>
                {esCultivoConTamano(cultivoNombreSel) &&
                  v.porcentajesTamano?.map((pt: any) => (
                    <td key={pt.tamano} className="px-2 py-1 text-center text-campo-600">
                      {pt.porcentaje.toFixed(1)}%
                    </td>
                  ))}
                {esPepino &&
                  v.porcentajesEmpaque?.map((pe: any) => (
                    <td key={`pct-${pe.calibre}`} className="px-2 py-1 text-center text-campo-600">
                      {pe.porcentaje.toFixed(1)}%
                    </td>
                  ))}
                {esPepino && (
                  <td className="px-2 py-1 text-center font-medium text-campo-700">
                    {v.cajas36s > 0 ? v.cajas36s.toFixed(1) : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-campo-100 bg-campo-50 font-medium">
              <td className="px-3 py-1 text-campo-700">Total</td>
              {resumenVariedad.calibresOrden.map((c) => (
                <td key={c} className="px-2 py-1 text-center text-campo-700">
                  {resumenVariedad.totalesPorCalibre[c]?.toFixed(0) || "—"}
                </td>
              ))}
              <td className="px-3 py-1 text-center text-campo-900">{resumenVariedad.granTotal.toFixed(0)}</td>
              {esCultivoConTamano(cultivoNombreSel) && TAMANOS_BASE.map((t) => <td key={t} />)}
              {esPepino &&
                resumenVariedad.porcentajesEmpaque.map((pe: any) => (
                  <td key={`tot-pct-${pe.calibre}`} className="px-2 py-1 text-center text-campo-700">
                    {pe.porcentaje.toFixed(1)}%
                  </td>
                ))}
              {esPepino && (
                <td className="px-2 py-1 text-center text-campo-900">
                  {resumenVariedad.granTotal36s > 0 ? resumenVariedad.granTotal36s.toFixed(1) : "—"}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
        {esCultivoConTamano(cultivoNombreSel) && (
          <div className="flex flex-wrap gap-4 border-t border-campo-100 px-4 py-3 text-xs text-campo-700">
            <span className="font-medium text-campo-600">% por tamaño (general):</span>
            {resumenVariedad.porcentajesTamano.map((t) => (
              <span key={t.tamano}>
                <strong>{t.tamano}:</strong> {t.porcentaje.toFixed(1)}%
              </span>
            ))}
          </div>
        )}
        {esPepino && (
          <div className="flex flex-wrap gap-4 border-t border-campo-100 px-4 py-3 text-xs text-campo-700">
            <span className="font-medium text-campo-600">% por empaque (general):</span>
            {resumenVariedad.porcentajesEmpaque.map((pe: any) => (
              <span key={pe.calibre}>
                <strong>{pe.calibre}:</strong> {pe.porcentaje.toFixed(1)}%
              </span>
            ))}
            <span className="ml-4">
              <strong>Total en cajas 36s:</strong> {resumenVariedad.granTotal36s.toFixed(1)}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
