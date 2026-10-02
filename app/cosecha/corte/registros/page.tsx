"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarExcelCorte } from "@/lib/excel/corte";
import { generarPdfCorte } from "@/lib/pdf/corte";
import { generarExcelResumenCorte } from "@/lib/excel/resumenCorte";
import { generarPdfResumenCorte, generarPdfResumenCorteUnDistribuidor } from "@/lib/pdf/resumenCorte";

type Opcion = { id: string; label: string };

export default function RegistrosCortePage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [calibres, setCalibres] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [distribuidorId, setDistribuidorId] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicionCantidad, setEdicionCantidad] = useState("");

  const [grupoEditando, setGrupoEditando] = useState<string | null>(null);
  const [edicionesGrupo, setEdicionesGrupo] = useState<Record<string, string>>({});
  const [guardandoGrupo, setGuardandoGrupo] = useState(false);

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
    supabase
      .from("distribuidores")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setDistribuidores((data ?? []).map((d: any) => ({ id: d.id, label: d.nombre }))));
    supabase
      .from("cultivos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setCultivos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
    supabase
      .from("calibres")
      .select("id, nombre, cultivo_id, cajas_por_pallet, cajas_por_bin, orden")
      .order("orden")
      .then(({ data }) => setCalibres(data ?? []));
    supabase
      .from("calibre_distribuidor_override")
      .select("calibre_id, distribuidor_id, cajas_por_pallet")
      .then(({ data }) => {
        const mapa: Record<string, Record<string, number>> = {};
        for (const o of (data ?? []) as any[]) {
          mapa[o.distribuidor_id] = mapa[o.distribuidor_id] ?? {};
          mapa[o.distribuidor_id][o.calibre_id] = Number(o.cajas_por_pallet);
        }
        setOverrides(mapa);
      });
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("corte_diario")
      .select(
        "id, fecha, campo_id, distribuidor_id, calibre_id, cultivo_id, clasificacion, tipo_unidad, cantidad_unidades, cajas, campos(nombre), cuadros(nombre), cultivos(nombre), distribuidores(nombre), calibres(nombre)"
      )
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .order("fecha", { ascending: false });

    if (campoId) query = query.eq("campo_id", campoId);
    if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

    const { data, error } = await query.limit(5000);
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tasaEfectiva(distribuidorId: string, calibreId: string, tipoUnidad: string): number {
    const cal = calibres.find((c) => c.id === calibreId);
    if (tipoUnidad === "bins") return Number(cal?.cajas_por_bin ?? 0);
    return overrides[distribuidorId]?.[calibreId] ?? Number(cal?.cajas_por_pallet ?? 0);
  }

  // El material de empaque que se descuenta automático por Corte diario no
  // queda ligado por id a cada renglón (así se armó desde el principio),
  // así que para revertirlo o recalcularlo al editar/eliminar hay que
  // reconstruirlo con la misma receta (tipo_empaque + receta_empaque) que
  // se usó al capturar -- nunca se edita/borra el movimiento original, se
  // agregan movimientos de ajuste (mismo patrón que ya usamos en Embarques).
  async function materialPorFilas(filas: any[]): Promise<Record<string, number>> {
    const clasificaciones = Array.from(new Set(filas.map((f) => f.clasificacion ?? "Convencional")));
    const { data: tiposEmpaque } = await supabase
      .from("tipo_empaque")
      .select("id, distribuidor_id, calibre_id, clasificacion, receta_empaque(material_id, cantidad_por_caja)")
      .in("clasificacion", clasificaciones);

    const consumo: Record<string, number> = {};
    for (const f of filas) {
      const clasif = f.clasificacion ?? "Convencional";
      const tipo = (tiposEmpaque ?? []).find(
        (t: any) => t.distribuidor_id === f.distribuidor_id && t.calibre_id === f.calibre_id && t.clasificacion === clasif
      );
      if (!tipo) continue;
      for (const rr of (tipo as any).receta_empaque ?? []) {
        consumo[rr.material_id] = (consumo[rr.material_id] ?? 0) + rr.cantidad_por_caja * Number(f.cajas);
      }
    }
    return consumo;
  }

  async function recalcularStock(materialId: string, campoId: string) {
    const { data } = await supabase
      .from("movimiento_material_empaque")
      .select("tipo, cantidad")
      .eq("material_id", materialId)
      .eq("campo_id", campoId);
    const stock = (data ?? []).reduce(
      (acc: number, m: any) => acc + (m.tipo === "entrada" ? Number(m.cantidad) : -Number(m.cantidad)),
      0
    );
    await supabase
      .from("inventario_materiales_empaque")
      .upsert({ material_id: materialId, campo_id: campoId, stock_actual: stock }, { onConflict: "material_id,campo_id" });
  }

  async function ajustarMaterialPorFilas(filas: any[], tipo: "entrada" | "salida", observaciones: string) {
    if (filas.length === 0) return;
    const consumo = await materialPorFilas(filas);
    const entradas = Object.entries(consumo).filter(([, cantidad]) => cantidad > 0);
    if (entradas.length === 0) return;
    const campoId = filas[0].campo_id;
    const fecha = filas[0].fecha;
    const movimientos = entradas.map(([materialId, cantidad]) => ({
      material_id: materialId,
      campo_id: campoId,
      fecha,
      tipo,
      cantidad,
      observaciones,
      origen_tipo: "corte_diario",
    }));
    await supabase.from("movimiento_material_empaque").insert(movimientos);
    for (const [materialId] of entradas) {
      await recalcularStock(materialId, campoId);
    }
  }

  function empezarEdicion(r: any) {
    cancelarEdicionGrupo();
    setEditandoId(r.id);
    setEdicionCantidad(String(r.cantidad_unidades));
  }

  async function guardarEdicion(r: any) {
    const cantidad = parseFloat(edicionCantidad);
    if (isNaN(cantidad) || cantidad < 0) {
      setError("Cantidad inválida.");
      return;
    }
    const tasa = tasaEfectiva(r.distribuidor_id, r.calibre_id, r.tipo_unidad);
    const cajasNuevas = cantidad * tasa;
    const { error } = await supabase
      .from("corte_diario")
      .update({ cantidad_unidades: cantidad, cajas: cajasNuevas })
      .eq("id", r.id);
    if (error) {
      setError(error.message);
      return;
    }
    if (cajasNuevas !== Number(r.cajas)) {
      await ajustarMaterialPorFilas(
        [r],
        "entrada",
        `Reversión por editar corte (${r.calibres?.nombre ?? ""}, ${r.fecha})`
      );
      await ajustarMaterialPorFilas(
        [{ ...r, cajas: cajasNuevas }],
        "salida",
        `Consumo actualizado por editar corte (${r.calibres?.nombre ?? ""}, ${r.fecha})`
      );
    }
    setEditandoId(null);
    consultar();
  }

  async function eliminar(r: any) {
    if (!confirm("¿Eliminar este renglón de corte? No se puede deshacer.")) return;
    await ajustarMaterialPorFilas(
      [r],
      "entrada",
      `Reversión por eliminar renglón de corte (${r.calibres?.nombre ?? ""}, ${r.fecha})`
    );
    const { error } = await supabase.from("corte_diario").delete().eq("id", r.id);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  async function eliminarGrupoCompleto(g: any) {
    if (
      !confirm(
        `¿Eliminar TODO el corte de ${g.fecha} — ${g.campo} — ${g.cultivo}? Se borrarán los ${g.filas.length} renglón(es) de este día/campo/cultivo. No se puede deshacer.`
      )
    )
      return;
    await ajustarMaterialPorFilas(
      g.filas,
      "entrada",
      `Reversión por eliminar corte completo (${g.fecha} — ${g.campo} — ${g.cultivo})`
    );
    const ids = g.filas.map((r: any) => r.id);
    const { error } = await supabase.from("corte_diario").delete().in("id", ids);
    if (error) {
      setError(error.message);
      return;
    }
    consultar();
  }

  function empezarEdicionGrupo(g: any) {
    setEditandoId(null);
    setError(null);
    const inicial: Record<string, string> = {};
    for (const r of g.filas) inicial[r.id] = String(r.cantidad_unidades);
    setEdicionesGrupo(inicial);
    setGrupoEditando(`${g.fecha}__${g.campo}__${g.cultivo}`);
  }

  function cancelarEdicionGrupo() {
    setGrupoEditando(null);
    setEdicionesGrupo({});
  }

  function actualizarEdicionGrupo(id: string, valor: string) {
    setEdicionesGrupo((prev) => ({ ...prev, [id]: valor }));
  }

  async function guardarEdicionGrupo(g: any) {
    setError(null);
    const actualizaciones: { id: string; cantidad: number; cajasNuevas: number; filaOriginal: any }[] = [];
    for (const r of g.filas) {
      const valor = edicionesGrupo[r.id];
      if (valor === undefined) continue;
      const cantidad = parseFloat(valor);
      if (isNaN(cantidad) || cantidad < 0) {
        setError(`Cantidad inválida en ${r.cuadros?.nombre ?? "un renglón"}.`);
        return;
      }
      if (cantidad !== Number(r.cantidad_unidades)) {
        const tasa = tasaEfectiva(r.distribuidor_id, r.calibre_id, r.tipo_unidad);
        actualizaciones.push({ id: r.id, cantidad, cajasNuevas: cantidad * tasa, filaOriginal: r });
      }
    }

    if (actualizaciones.length === 0) {
      cancelarEdicionGrupo();
      return;
    }

    setGuardandoGrupo(true);
    const resultados = await Promise.all(
      actualizaciones.map(({ id, cantidad, cajasNuevas }) =>
        supabase
          .from("corte_diario")
          .update({ cantidad_unidades: cantidad, cajas: cajasNuevas })
          .eq("id", id)
      )
    );
    const errUpd = resultados.find((res) => res.error)?.error;
    if (errUpd) {
      setGuardandoGrupo(false);
      setError(errUpd.message);
      return;
    }
    await ajustarMaterialPorFilas(
      actualizaciones.map((a) => a.filaOriginal),
      "entrada",
      `Reversión por editar corte completo (${g.fecha} — ${g.campo} — ${g.cultivo})`
    );
    await ajustarMaterialPorFilas(
      actualizaciones.map((a) => ({ ...a.filaOriginal, cajas: a.cajasNuevas })),
      "salida",
      `Consumo actualizado por editar corte completo (${g.fecha} — ${g.campo} — ${g.cultivo})`
    );
    setGuardandoGrupo(false);
    cancelarEdicionGrupo();
    consultar();
  }

  const totalCajas = registros.reduce((s, r) => s + Number(r.cajas ?? 0), 0);
  const rango = `${fechaInicio}_a_${fechaFin}`;

  function filasParaExport() {
    return registros.map((r: any) => ({
      fecha: r.fecha,
      campo: r.campos?.nombre ?? "",
      cuadro: r.cuadros?.nombre ?? "",
      cultivo: r.cultivos?.nombre ?? "",
      distribuidor: r.distribuidores?.nombre ?? "",
      calibre: r.calibres?.nombre ?? "",
      tipoUnidad: r.tipo_unidad,
      unidades: Number(r.cantidad_unidades),
      cajas: Number(r.cajas),
    }));
  }

  // Sandia Mini Amarilla (y cualquier otra variante) comparte el catalogo
  // de calibres de "Sandía Mini" -- para filtrar las columnas del resumen
  // hay que resolver a ese cultivo base, igual que en Corte diario.
  function idCultivoParaCalibres(cultivoId: string | null, cultivoNombre: string): string | null {
    const nombre = (cultivoNombre || "").toLowerCase();
    const esVarianteSandiaMini = nombre.includes("sandía mini") || nombre.includes("sandia mini");
    if (esVarianteSandiaMini) {
      const base = cultivos.find((c) => c.label === "Sandía Mini");
      if (base) return base.id;
    }
    return cultivoId;
  }

  // Un corte puede traer varios cultivos el mismo día/campo (ej. Sandía
  // Mini y Pepino) -- hay que separarlos en grupos distintos para que el
  // resumen (columnas por calibre) no mezcle calibres de cultivos
  // diferentes.
  const grupos = useMemo(() => {
    const mapa = new Map<string, any>();
    for (const r of registros) {
      const cultivoNombre = r.cultivos?.nombre ?? "Sin cultivo";
      const key = `${r.fecha}__${r.campos?.nombre ?? ""}__${cultivoNombre}`;
      const g =
        mapa.get(key) ??
        {
          fecha: r.fecha,
          campo: r.campos?.nombre ?? "",
          cultivo: cultivoNombre,
          cultivoId: r.cultivo_id ?? null,
          filas: [] as any[],
          totalCajas: 0,
        };
      g.filas.push(r);
      g.totalCajas += Number(r.cajas ?? 0);
      mapa.set(key, g);
    }
    return Array.from(mapa.values()).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [registros]);

  function calibresDelGrupo(g: any) {
    const idBase = idCultivoParaCalibres(g.cultivoId, g.cultivo);
    const delCultivo = idBase ? calibres.filter((c) => c.cultivo_id === idBase) : calibres;
    const calibresCaja = delCultivo
      .filter((c) => c.cajas_por_pallet != null)
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden }));
    const calibresBin = delCultivo
      .filter((c) => c.cajas_por_bin != null)
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden }));
    return { calibresCaja, calibresBin };
  }

  function detalleDeGrupo(g: any) {
    return g.filas.map((r: any) => ({
      cuadro: r.cuadros?.nombre ?? "",
      distribuidor: r.distribuidores?.nombre ?? "",
      calibreId: r.calibre_id,
      calibreNombre: r.calibres?.nombre ?? "",
      tipoUnidad: r.tipo_unidad,
      unidades: Number(r.cantidad_unidades),
      cajas: Number(r.cajas),
    }));
  }

  function descargarResumenExcel(g: any) {
    const { calibresCaja, calibresBin } = calibresDelGrupo(g);
    generarExcelResumenCorte({
      fecha: g.fecha,
      campo: `${g.campo} - ${g.cultivo}`,
      filas: detalleDeGrupo(g),
      calibresCaja,
      calibresBin,
    });
  }
  function descargarResumenPdf(g: any) {
    const { calibresCaja, calibresBin } = calibresDelGrupo(g);
    generarPdfResumenCorte({
      fecha: g.fecha,
      campo: `${g.campo} - ${g.cultivo}`,
      filas: detalleDeGrupo(g),
      calibresCaja,
      calibresBin,
    });
  }
  function descargarPdfDistribuidor(g: any, distribuidor: string) {
    const { calibresCaja, calibresBin } = calibresDelGrupo(g);
    const filasDist = detalleDeGrupo(g).filter((f: any) => f.distribuidor === distribuidor);
    generarPdfResumenCorteUnDistribuidor({
      fecha: g.fecha,
      campo: `${g.campo} - ${g.cultivo}`,
      distribuidor,
      filas: filasDist,
      calibresCaja,
      calibresBin,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Registros de corte</h1>
      <p className="mb-6 text-sm text-campo-600">Historial de todo lo capturado en Corte diario, agrupado por día y campo.</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-5">
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
          <label className="mb-1 block text-xs font-medium text-campo-600">Distribuidor</label>
          <select className="input" value={distribuidorId} onChange={(e) => setDistribuidorId(e.target.value)}>
            <option value="">Todos</option>
            {distribuidores.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={consultar} disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
          <button className="btn-secondary" onClick={() => generarExcelCorte(filasParaExport(), rango)}>
            Excel
          </button>
          <button className="btn-secondary" onClick={() => generarPdfCorte(filasParaExport(), rango)}>
            PDF
          </button>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <p className="text-xs text-campo-500">Total cajas en el rango</p>
        <p className="text-2xl font-semibold text-campo-900">{totalCajas.toLocaleString()}</p>
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando...</p>}
      {!loading && grupos.length === 0 && (
        <p className="text-sm text-campo-400">Sin registros en el rango seleccionado.</p>
      )}

      {grupos.map((g) => {
        const claveGrupo = `${g.fecha}__${g.campo}__${g.cultivo}`;
        const enEdicionGrupo = grupoEditando === claveGrupo;
        return (
          <details key={claveGrupo} className="card mb-2 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
              <span className="text-sm font-medium text-campo-800">
                {g.fecha} — {g.campo} — {g.cultivo}
                <span className="ml-2 font-normal text-campo-500">
                  ({g.filas.length} renglón(es) · {g.totalCajas.toFixed(0)} cajas)
                </span>
              </span>
            </summary>
            <div className="flex flex-wrap items-center gap-2 border-b border-campo-100 bg-white px-4 py-2">
              <button className="btn-secondary text-xs" onClick={() => descargarResumenExcel(g)}>
                Resumen del día (Excel)
              </button>
              <button className="btn-secondary text-xs" onClick={() => descargarResumenPdf(g)}>
                Resumen del día (PDF, todos)
              </button>
              {Array.from(new Set(g.filas.map((r: any) => r.distribuidores?.nombre))).map((dist: any) => (
                <button
                  key={dist}
                  className="btn-secondary text-xs"
                  onClick={() => descargarPdfDistribuidor(g, dist)}
                >
                  PDF — {dist}
                </button>
              ))}
              <span className="mx-1 h-4 border-l border-campo-200" />
              {enEdicionGrupo ? (
                <>
                  <button
                    className="btn-primary text-xs"
                    onClick={() => guardarEdicionGrupo(g)}
                    disabled={guardandoGrupo}
                  >
                    {guardandoGrupo ? "Guardando..." : "Guardar corte completo"}
                  </button>
                  <button className="btn-secondary text-xs" onClick={cancelarEdicionGrupo} disabled={guardandoGrupo}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-secondary text-xs" onClick={() => empezarEdicionGrupo(g)}>
                    Editar corte completo
                  </button>
                  <button className="btn-danger text-xs" onClick={() => eliminarGrupoCompleto(g)}>
                    Eliminar corte completo
                  </button>
                </>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-campo-500">
                <tr>
                  <th className="px-4 py-1">Cuadro</th>
                  <th className="px-4 py-1">Distribuidor</th>
                  <th className="px-4 py-1">Calibre</th>
                  <th className="px-4 py-1">Tipo</th>
                  <th className="px-4 py-1">Unidades</th>
                  <th className="px-4 py-1">Cajas</th>
                  <th className="px-4 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {g.filas.map((r: any) => {
                  if (enEdicionGrupo) {
                    const valor = edicionesGrupo[r.id] ?? "";
                    return (
                      <tr key={r.id} className="border-t border-campo-50 bg-campo-50">
                        <td className="px-4 py-1 text-campo-800">{r.cuadros?.nombre}</td>
                        <td className="px-4 py-1 text-campo-800">{r.distribuidores?.nombre}</td>
                        <td className="px-4 py-1 text-campo-800">{r.calibres?.nombre}</td>
                        <td className="px-4 py-1 text-campo-600 capitalize">{r.tipo_unidad}</td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="any"
                            className="input w-20"
                            value={valor}
                            onChange={(e) => actualizarEdicionGrupo(r.id, e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-1 text-campo-600">
                          {(
                            (parseFloat(valor || "0")) *
                            tasaEfectiva(r.distribuidor_id, r.calibre_id, r.tipo_unidad)
                          ).toFixed(0)}
                        </td>
                        <td className="px-4 py-1"></td>
                      </tr>
                    );
                  }
                  return editandoId === r.id ? (
                    <tr key={r.id} className="border-t border-campo-50 bg-campo-50">
                      <td className="px-4 py-1 text-campo-800">{r.cuadros?.nombre}</td>
                      <td className="px-4 py-1 text-campo-800">{r.distribuidores?.nombre}</td>
                      <td className="px-4 py-1 text-campo-800">{r.calibres?.nombre}</td>
                      <td className="px-4 py-1 text-campo-600 capitalize">{r.tipo_unidad}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="any"
                          className="input w-20"
                          value={edicionCantidad}
                          onChange={(e) => setEdicionCantidad(e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-1 text-campo-600">
                        {(parseFloat(edicionCantidad || "0") * tasaEfectiva(r.distribuidor_id, r.calibre_id, r.tipo_unidad)).toFixed(0)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">
                        <button className="btn-secondary mr-1" onClick={() => guardarEdicion(r)}>
                          Guardar
                        </button>
                        <button className="btn-secondary" onClick={() => setEditandoId(null)}>
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-t border-campo-50">
                      <td className="px-4 py-1 text-campo-800">{r.cuadros?.nombre}</td>
                      <td className="px-4 py-1 text-campo-800">{r.distribuidores?.nombre}</td>
                      <td className="px-4 py-1 text-campo-800">{r.calibres?.nombre}</td>
                      <td className="px-4 py-1 text-campo-600 capitalize">{r.tipo_unidad}</td>
                      <td className="px-4 py-1 text-campo-800">{r.cantidad_unidades}</td>
                      <td className="px-4 py-1 text-campo-800">{Number(r.cajas).toFixed(0)}</td>
                      <td className="whitespace-nowrap px-4 py-1 text-right">
                        <button className="btn-secondary mr-1" onClick={() => empezarEdicion(r)}>
                          Editar
                        </button>
                        <button className="btn-danger" onClick={() => eliminar(r)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        );
      })}
    </div>
  );
}
