"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MultiSelectCuadros from "@/components/MultiSelectCuadros";
import { generarPdfAplicacionFoliar } from "@/lib/pdf/aplicacionFoliar";

type Opcion = { id: string; label: string; grupo?: string };
type Producto = { id: string; nombre: string; unidad: string };
type Ciclo = { id: string; clave: string; fecha_inicio: string; fecha_fin: string };

type LineaProducto = {
  key: string;
  productoId: string;
  productoTexto: string;
  dosisHa: string;
  dosisTanque: string;
  totalUsado: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function AplicacionesFoliaresPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [cuadrosTodos, setCuadrosTodos] = useState<(Opcion & { hectareas: number })[]>([]);
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [variedades, setVariedades] = useState<(Opcion & { cultivoId: string })[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [recientes, setRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Encabezado
  const [folio, setFolio] = useState("");
  const [campoId, setCampoId] = useState("");
  const [cultivoId, setCultivoId] = useState("");
  const [variedadId, setVariedadId] = useState("");
  const [cuadroIds, setCuadroIds] = useState<string[]>([]);
  const [fechaAplicacion, setFechaAplicacion] = useState(new Date().toISOString().slice(0, 10));
  const [tripleLavado, setTripleLavado] = useState(true);
  const [operador, setOperador] = useState("");
  const [noTractor, setNoTractor] = useState("");
  const [noAspersora, setNoAspersora] = useState("");
  const [ltsPorTanque, setLtsPorTanque] = useState("");
  const [hasPorTanque, setHasPorTanque] = useState("");
  const [noCargas, setNoCargas] = useState("");
  const [seCalibro, setSeCalibro] = useState(true);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaTermino, setHoraTermino] = useState("");
  const [gerenteCampo, setGerenteCampo] = useState("");
  const [encargadoAplicaciones, setEncargadoAplicaciones] = useState("");

  const [lineas, setLineas] = useState<LineaProducto[]>([
    {
      key: uid(),
      productoId: "",
      productoTexto: "",
      dosisHa: "",
      dosisTanque: "",
      totalUsado: "",
    },
  ]);

  async function cargarCatalogos() {
    const [{ data: camp }, { data: cua }, { data: cult }, { data: vars }, { data: prod }, { data: cic }] =
      await Promise.all([
        supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("cuadros").select("id, nombre, hectareas, campos(nombre)").order("nombre"),
        supabase.from("cultivos").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("variedades").select("id, nombre, cultivo_id").eq("activo", true).order("nombre"),
        supabase.from("catalogo_productos").select("id, nombre, unidad").eq("activo", true).order("nombre"),
        supabase.from("ciclos").select("id, clave, fecha_inicio, fecha_fin"),
      ]);
    setCampos((camp ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
    setCuadrosTodos(
      (cua ?? []).map((c: any) => ({
        id: c.id,
        label: c.nombre,
        grupo: c.campos?.nombre ?? "Sin campo",
        hectareas: Number(c.hectareas ?? 0),
      }))
    );
    setCultivos((cult ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
    setVariedades((vars ?? []).map((v: any) => ({ id: v.id, label: v.nombre, cultivoId: v.cultivo_id })));
    setProductos(prod ?? []);
    setCiclos(cic ?? []);
  }

  async function cargarRecientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("aplicacion_foliar")
      .select("id, folio, fecha_aplicacion, campos(nombre), aplicacion_foliar_cuadro(cuadros(nombre)), aplicacion_foliar_producto(total_utilizado, catalogo_productos(nombre))")
      .order("fecha_aplicacion", { ascending: false })
      .limit(30);
    if (error) setError(error.message);
    else setRecientes(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarCatalogos();
    cargarRecientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cuadrosDelCampo = useMemo(
    () => (campoId ? cuadrosTodos.filter((c) => campos.find((cp) => cp.id === campoId)?.label === c.grupo) : cuadrosTodos),
    [cuadrosTodos, campoId, campos]
  );

  const variedadesDelCultivo = useMemo(
    () => variedades.filter((v) => !cultivoId || v.cultivoId === cultivoId),
    [variedades, cultivoId]
  );

  const superficieTotal = useMemo(() => {
    return cuadroIds.reduce((sum, id) => {
      const c = cuadrosTodos.find((c) => c.id === id);
      return sum + (c?.hectareas ?? 0);
    }, 0);
  }, [cuadroIds, cuadrosTodos]);

  function agregarLinea() {
    setLineas((l) => [
      ...l,
      {
        key: uid(),
        productoId: "",
        productoTexto: "",
        dosisHa: "",
        dosisTanque: "",
        totalUsado: "",
      },
    ]);
  }

  function quitarLinea(key: string) {
    setLineas((l) => l.filter((x) => x.key !== key));
  }

  function actualizarLinea(key: string, cambios: Partial<LineaProducto>) {
    setLineas((l) => l.map((x) => (x.key === key ? { ...x, ...cambios } : x)));
  }

  function manejarTextoProducto(key: string, texto: string) {
    const match = productos.find((p) => p.nombre === texto);
    actualizarLinea(key, { productoTexto: texto, productoId: match ? match.id : "" });
  }

  async function guardar() {
    if (!campoId || cuadroIds.length === 0) {
      setError("Selecciona el campo y al menos un cuadro.");
      return;
    }
    const lineasValidas = lineas.filter((l) => l.productoId && l.totalUsado);
    if (lineasValidas.length === 0) {
      setError("Agrega al menos un producto con total utilizado.");
      return;
    }

    // Busca el ciclo que corresponde a la fecha de aplicacion
    const ciclo = ciclos.find(
      (c) => fechaAplicacion >= c.fecha_inicio && fechaAplicacion <= c.fecha_fin
    );
    if (!ciclo) {
      setError(
        "No hay un ciclo definido para esa fecha. Agrégalo en Catálogos → Ciclos antes de guardar."
      );
      return;
    }

    setGuardando(true);
    setError(null);

    const { data: encabezado, error: errEnc } = await supabase
      .from("aplicacion_foliar")
      .insert({
        folio: folio || null,
        campo_id: campoId,
        cultivo_id: cultivoId || null,
        variedad_id: variedadId || null,
        superficie_has: superficieTotal,
        fecha_aplicacion: fechaAplicacion,
        triple_lavado: tripleLavado,
        operador: operador || null,
        no_tractor: noTractor || null,
        no_aspersora: noAspersora || null,
        lts_por_tanque: ltsPorTanque ? parseFloat(ltsPorTanque) : null,
        has_por_tanque: hasPorTanque ? parseFloat(hasPorTanque) : null,
        no_cargas: noCargas ? parseInt(noCargas) : null,
        se_calibro_equipo: seCalibro,
        hora_inicio: horaInicio || null,
        hora_termino: horaTermino || null,
        gerente_campo: gerenteCampo || null,
        encargado_aplicaciones: encargadoAplicaciones || null,
      })
      .select("id")
      .single();

    if (errEnc || !encabezado) {
      setError(errEnc?.message ?? "No se pudo crear el encabezado.");
      setGuardando(false);
      return;
    }

    const aplicacionFoliarId = encabezado.id;

    // Cuadros del folio (con sus hectareas, para el prorrateo)
    const filasCuadro = cuadroIds.map((id) => {
      const c = cuadrosTodos.find((c) => c.id === id)!;
      return { aplicacion_foliar_id: aplicacionFoliarId, cuadro_id: id, hectareas: c.hectareas };
    });
    await supabase.from("aplicacion_foliar_cuadro").insert(filasCuadro);

    // Productos del folio
    const filasProducto = lineasValidas.map((l) => ({
      aplicacion_foliar_id: aplicacionFoliarId,
      producto_id: l.productoId,
      dosis_ha: l.dosisHa ? parseFloat(l.dosisHa) : null,
      dosis_tanque: l.dosisTanque ? parseFloat(l.dosisTanque) : null,
      total_utilizado: parseFloat(l.totalUsado),
    }));
    await supabase.from("aplicacion_foliar_producto").insert(filasProducto);

    // Prorratea cada producto entre los cuadros (proporcional a hectareas)
    // y llena la tabla unificada `aplicaciones` para acumulados.
    const filasAplicaciones: any[] = [];
    for (const l of lineasValidas) {
      const total = parseFloat(l.totalUsado);
      for (const cuadroId of cuadroIds) {
        const c = cuadrosTodos.find((c) => c.id === cuadroId)!;
        const proporcion = superficieTotal > 0 ? c.hectareas / superficieTotal : 1 / cuadroIds.length;
        filasAplicaciones.push({
          producto_id: l.productoId,
          cuadro_id: cuadroId,
          ciclo_id: ciclo.id,
          fecha: fechaAplicacion,
          cantidad: total * proporcion,
          unidad: productos.find((p) => p.id === l.productoId)?.unidad ?? "LT",
          tipo: "foliar",
          metodo: noAspersora ? `Aspersora ${noAspersora}` : "Aspersión",
          origen_tipo: "aplicacion_foliar_producto",
          origen_id: aplicacionFoliarId,
        });
      }
    }
    await supabase.from("aplicaciones").insert(filasAplicaciones);

    // Descuenta el inventario: una salida por producto (a nivel campo)
    const filasMovimiento = lineasValidas.map((l) => ({
      folio: folio || null,
      producto_id: l.productoId,
      campo_id: campoId,
      fecha: fechaAplicacion,
      tipo: "salida",
      cantidad: parseFloat(l.totalUsado),
      observaciones: "Aplicación foliar",
      origen_tipo: "aplicacion_foliar",
      origen_id: aplicacionFoliarId,
    }));
    const { error: errMov } = await supabase
      .from("movimientos_inventario_agroquimicos")
      .insert(filasMovimiento);

    setGuardando(false);
    if (errMov) {
      setError(
        "La aplicación se guardó, pero hubo un problema al descontar el inventario: " + errMov.message
      );
    } else {
      setMensajeExito("Aplicación guardada y descontada del inventario correctamente. Se descargó el PDF.");
    }

    generarPdfAplicacionFoliar({
      folio,
      campo: campos.find((c) => c.id === campoId)?.label ?? "",
      cultivo: cultivos.find((c) => c.id === cultivoId)?.label ?? "",
      variedad: variedades.find((v) => v.id === variedadId)?.label ?? "",
      cuadros: cuadroIds.map((id) => cuadrosTodos.find((c) => c.id === id)?.label ?? "").join(", "),
      superficieHas: superficieTotal,
      fechaAplicacion,
      tripleLavado,
      operador,
      noTractor,
      noAspersora,
      ltsPorTanque,
      hasPorTanque,
      noCargas,
      seCalibroEquipo: seCalibro,
      horaInicio,
      horaTermino,
      gerenteCampo,
      encargadoAplicaciones,
      productos: lineasValidas.map((l) => ({
        producto: productos.find((p) => p.id === l.productoId)?.nombre ?? "",
        dosisHa: l.dosisHa ? parseFloat(l.dosisHa) : null,
        dosisTanque: l.dosisTanque ? parseFloat(l.dosisTanque) : null,
        totalUsado: parseFloat(l.totalUsado),
        unidad: productos.find((p) => p.id === l.productoId)?.unidad ?? "",
      })),
    });

    // Reset
    setFolio("");
    setCuadroIds([]);
    setLineas([
      {
        key: uid(),
        productoId: "",
        productoTexto: "",
        dosisHa: "",
        dosisTanque: "",
        totalUsado: "",
      },
    ]);
    cargarRecientes();
    setTimeout(() => setMensajeExito(null), 5000);
  }

  async function descargarPdfExistente(id: string) {
    const { data, error } = await supabase
      .from("aplicacion_foliar")
      .select(
        "folio, campos(nombre), cultivos(nombre), variedades(nombre), superficie_has, fecha_aplicacion, triple_lavado, operador, no_tractor, no_aspersora, lts_por_tanque, has_por_tanque, no_cargas, se_calibro_equipo, hora_inicio, hora_termino, gerente_campo, encargado_aplicaciones, aplicacion_foliar_cuadro(cuadros(nombre)), aplicacion_foliar_producto(dosis_ha, dosis_tanque, total_utilizado, catalogo_productos(nombre, unidad))"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      setError(error?.message ?? "No se pudo cargar la aplicación.");
      return;
    }
    const d = data as any;

    generarPdfAplicacionFoliar({
      folio: d.folio ?? "",
      campo: d.campos?.nombre ?? "",
      cultivo: d.cultivos?.nombre ?? "",
      variedad: d.variedades?.nombre ?? "",
      cuadros: (d.aplicacion_foliar_cuadro ?? []).map((x: any) => x.cuadros?.nombre).join(", "),
      superficieHas: Number(d.superficie_has ?? 0),
      fechaAplicacion: d.fecha_aplicacion,
      tripleLavado: !!d.triple_lavado,
      operador: d.operador ?? "",
      noTractor: d.no_tractor ?? "",
      noAspersora: d.no_aspersora ?? "",
      ltsPorTanque: d.lts_por_tanque ? String(d.lts_por_tanque) : "",
      hasPorTanque: d.has_por_tanque ? String(d.has_por_tanque) : "",
      noCargas: d.no_cargas ? String(d.no_cargas) : "",
      seCalibroEquipo: !!d.se_calibro_equipo,
      horaInicio: d.hora_inicio ?? "",
      horaTermino: d.hora_termino ?? "",
      gerenteCampo: d.gerente_campo ?? "",
      encargadoAplicaciones: d.encargado_aplicaciones ?? "",
      productos: (d.aplicacion_foliar_producto ?? []).map((p: any) => ({
        producto: p.catalogo_productos?.nombre ?? "",
        dosisHa: p.dosis_ha,
        dosisTanque: p.dosis_tanque,
        totalUsado: Number(p.total_utilizado),
        unidad: p.catalogo_productos?.unidad ?? "",
      })),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">
        Control de aplicaciones de agroquímicos vía foliar
      </h1>
      <p className="mb-6 text-sm text-campo-600">
        Al guardar, se prorratea entre los cuadros elegidos y se descuenta
        automático del inventario.
      </p>

      <datalist id="productos-datalist-aplic">
        {productos.map((p) => (
          <option key={p.id} value={p.nombre} />
        ))}
      </datalist>

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

      <div className="card mb-4 grid grid-cols-4 gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Folio</label>
          <input className="input" value={folio} onChange={(e) => setFolio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select className="input" value={campoId} onChange={(e) => { setCampoId(e.target.value); setCuadroIds([]); }}>
            <option value="">Selecciona...</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Cultivo</label>
          <select className="input" value={cultivoId} onChange={(e) => { setCultivoId(e.target.value); setVariedadId(""); }}>
            <option value="">Selecciona...</option>
            {cultivos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Variedad</label>
          <select className="input" value={variedadId} onChange={(e) => setVariedadId(e.target.value)}>
            <option value="">Selecciona...</option>
            {variedadesDelCultivo.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Cuadro(s) — Superficie: {superficieTotal.toFixed(2)} ha
          </label>
          <MultiSelectCuadros opciones={cuadrosDelCampo} seleccionados={cuadroIds} onChange={setCuadroIds} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Fecha de aplicación</label>
          <input type="date" className="input" value={fechaAplicacion} onChange={(e) => setFechaAplicacion(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 pt-4">
          <input type="checkbox" checked={tripleLavado} onChange={(e) => setTripleLavado(e.target.checked)} />
          <label className="text-sm text-campo-700">Triple lavado</label>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Operador</label>
          <input className="input" value={operador} onChange={(e) => setOperador(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">No. tractor</label>
          <input className="input" value={noTractor} onChange={(e) => setNoTractor(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">No. aspersora</label>
          <input className="input" value={noAspersora} onChange={(e) => setNoAspersora(e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Lts/tanque</label>
          <input type="number" step="any" className="input" value={ltsPorTanque} onChange={(e) => setLtsPorTanque(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Has/tanque</label>
          <input type="number" step="any" className="input" value={hasPorTanque} onChange={(e) => setHasPorTanque(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">No. cargas</label>
          <input type="number" className="input" value={noCargas} onChange={(e) => setNoCargas(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input type="checkbox" checked={seCalibro} onChange={(e) => setSeCalibro(e.target.checked)} />
          <label className="text-sm text-campo-700">Se calibró el equipo</label>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hora inicio</label>
          <input type="time" className="input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hora término</label>
          <input type="time" className="input" value={horaTermino} onChange={(e) => setHoraTermino(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Gerente de campo</label>
          <input className="input" value={gerenteCampo} onChange={(e) => setGerenteCampo(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Encargado de aplicaciones</label>
          <input className="input" value={encargadoAplicaciones} onChange={(e) => setEncargadoAplicaciones(e.target.value)} />
        </div>
      </div>

      <div className="card mb-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Dosis/ha</th>
              <th className="px-3 py-2">Dosis/tanque</th>
              <th className="px-3 py-2">Total usado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.key} className="border-t border-campo-50">
                <td className="px-3 py-1">
                  <input
                    className="input w-48"
                    list="productos-datalist-aplic"
                    placeholder="Buscar..."
                    value={l.productoTexto}
                    onChange={(e) => manejarTextoProducto(l.key, e.target.value)}
                  />
                </td>
                <td className="px-3 py-1">
                  <input type="number" step="any" className="input w-24" value={l.dosisHa} onChange={(e) => actualizarLinea(l.key, { dosisHa: e.target.value })} />
                </td>
                <td className="px-3 py-1">
                  <input type="number" step="any" className="input w-24" value={l.dosisTanque} onChange={(e) => actualizarLinea(l.key, { dosisTanque: e.target.value })} />
                </td>
                <td className="px-3 py-1">
                  <input type="number" step="any" className="input w-28" value={l.totalUsado} onChange={(e) => actualizarLinea(l.key, { totalUsado: e.target.value })} />
                </td>
                <td className="px-3 py-1">
                  <button className="text-red-500 hover:text-red-700" onClick={() => quitarLinea(l.key)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-campo-50 px-4 py-2">
          <button className="btn-secondary text-xs" onClick={agregarLinea}>+ Agregar producto</button>
        </div>
      </div>

      <button className="btn-primary mb-8" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar aplicación"}
      </button>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Aplicaciones recientes</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Folio</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadros</th>
              <th className="px-4 py-2">Productos</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={6}>Cargando...</td></tr>}
            {!loading && recientes.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={6}>Todavía no hay aplicaciones.</td></tr>
            )}
            {recientes.map((r: any) => (
              <tr key={r.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{r.fecha_aplicacion}</td>
                <td className="px-4 py-2 text-campo-800">{r.folio ?? "—"}</td>
                <td className="px-4 py-2 text-campo-800">{r.campos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">
                  {(r.aplicacion_foliar_cuadro ?? []).map((x: any) => x.cuadros?.nombre).join(", ")}
                </td>
                <td className="px-4 py-2 text-campo-800">
                  {(r.aplicacion_foliar_producto ?? [])
                    .map((p: any) => `${p.catalogo_productos?.nombre} (${p.total_utilizado})`)
                    .join(", ")}
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-secondary" onClick={() => descargarPdfExistente(r.id)}>
                    Descargar PDF
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
