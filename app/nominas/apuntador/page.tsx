"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcularPeriodo } from "@/lib/utils/periodo";
import { generarExcelApuntador, FilaApuntadorExport } from "@/lib/excel/apuntador";
import { generarPdfApuntador } from "@/lib/pdf/apuntador";
import BuscadorEmpleado from "@/components/BuscadorEmpleado";
import { obtenerCuadrosPermitidos } from "@/lib/utils/cuadrosPrograma";

type Empleado = { id: string; clave: string; nombre: string };
type Opcion = { id: string; label: string };

type Slot = {
  key: string;
  actividadId: string;
  actividadNombre: string;
  cuadroId: string | null;
  cuadroNombre: string;
  cuadrosPermitidos: { id: string; label: string }[]; // vacio = sin restriccion (espacio manual)
  cultivoId: string;
  empleadoTexto: string;
  empleadoId: string | null;
  tipoPago: "jornal" | "destajo";
  avance: string;
  tarifa: string;
  horaEntrada: string;
  horaSalida: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function ApuntadorPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [actividades, setActividades] = useState<Opcion[]>([]);
  const [cuadros, setCuadros] = useState<Opcion[]>([]);
  const [cultivoPorCuadro, setCultivoPorCuadro] = useState<Record<string, string>>({});
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [hectareasPorCampo, setHectareasPorCampo] = useState<Record<string, number>>({});
  const [registros, setRegistros] = useState<any[]>([]);
  const [loadingRegistros, setLoadingRegistros] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avisoCenso, setAvisoCenso] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoCenso, setCargandoCenso] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [tarifaMasiva, setTarifaMasiva] = useState("");
  const [cultivoMasivo, setCultivoMasivo] = useState("");
  const [horaEntradaMasiva, setHoraEntradaMasiva] = useState("");
  const [horaSalidaMasiva, setHoraSalidaMasiva] = useState("");

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);

  const periodo = useMemo(() => calcularPeriodo(fecha), [fecha]);

  const gruposRegistros = useMemo(() => {
    const mapa = new Map<
      string,
      { fecha: string; campo: string; filas: any[]; total: number }
    >();
    for (const r of registros) {
      const campo = r.campos?.nombre ?? "General";
      const key = `${r.fecha}__${campo}`;
      if (!mapa.has(key)) {
        mapa.set(key, { fecha: r.fecha, campo, filas: [], total: 0 });
      }
      const grupo = mapa.get(key)!;
      grupo.filas.push(r);
      grupo.total += Number(r.total ?? 0);
    }
    return Array.from(mapa.values()).sort((a, b) =>
      a.fecha === b.fecha
        ? a.campo.localeCompare(b.campo)
        : a.fecha < b.fecha
        ? 1
        : -1
    );
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

  function descargarExcelGrupo(grupo: { fecha: string; campo: string; filas: any[] }) {
    generarExcelApuntador(
      filasParaExport(grupo.filas),
      `apuntador_${grupo.campo.replace(/\s+/g, "_")}_${grupo.fecha}.xlsx`
    );
  }

  function descargarPdfGrupo(grupo: { fecha: string; campo: string; filas: any[] }) {
    generarPdfApuntador(
      filasParaExport(grupo.filas),
      `Apuntador — ${grupo.campo} — ${grupo.fecha}`,
      `apuntador_${grupo.campo.replace(/\s+/g, "_")}_${grupo.fecha}.pdf`
    );
  }

  async function fetchTodasLasFilas(
    construirQuery: (desde: number, hasta: number) => any
  ) {
    const TAMANO = 1000;
    let todas: any[] = [];
    let desde = 0;
    while (true) {
      const { data, error } = await construirQuery(desde, desde + TAMANO - 1);
      if (error) {
        setError(error.message);
        break;
      }
      todas = todas.concat(data ?? []);
      if (!data || data.length < TAMANO) break;
      desde += TAMANO;
    }
    return todas;
  }

  async function cargarCatalogos() {
    const [{ data: camp }, { data: act }, cua, { data: cult }] =
      await Promise.all([
        supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("actividades").select("id, nombre").eq("activo", true).order("nombre"),
        obtenerCuadrosPermitidos(supabase),
        supabase.from("cultivos").select("id, nombre").eq("activo", true).order("nombre"),
      ]);
    // Empleados puede superar el limite de filas por request (miles de
    // registros), asi que se trae en tandas hasta completarlos todos.
    const emp = await fetchTodasLasFilas((desde, hasta) =>
      supabase
        .from("empleados")
        .select("id, clave, nombre")
        .eq("activo", true)
        .order("clave")
        .range(desde, hasta)
    );
    emp.sort((a, b) => Number(a.clave) - Number(b.clave) || a.clave.localeCompare(b.clave));

    setCampos((camp ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
    setEmpleados(emp ?? []);
    setActividades((act ?? []).map((a: any) => ({ id: a.id, label: a.nombre })));
    setCuadros(cua.map((c) => ({ id: c.id, label: c.nombre })));
    setCultivos((cult ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
    const cultivoPorCuadro: Record<string, string> = {};
    for (const c of cua) {
      if (c.cultivoId) cultivoPorCuadro[c.id] = c.cultivoId;
    }
    setCultivoPorCuadro(cultivoPorCuadro);

    // Total de hectareas por campo, ahora ya basado en los cuadros del
    // Programa activo (2026-2 / 2027-1) cuando el campo lo tiene; si un
    // campo aun no tiene Programa, usa todos sus cuadros como respaldo.
    const totales: Record<string, number> = {};
    for (const c of cua) {
      totales[c.campoNombre] = (totales[c.campoNombre] ?? 0) + c.hectareas;
    }
    setHectareasPorCampo(totales);
  }

  async function cargarRegistros() {
    setLoadingRegistros(true);
    const { semana, anio } = calcularPeriodo(fecha);
    const { data, error } = await supabase
      .from("apuntador_diario")
      .select(
        "id, fecha, periodo, periodo_anio, avance, tarifa, total, tipo_pago, empleado_id, cuadro_id, actividad_id, empleados(clave, nombre), cuadros(nombre, hectareas), actividades(nombre), campos(nombre)"
      )
      .eq("periodo", semana)
      .eq("periodo_anio", anio)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRegistros(data ?? []);
    setLoadingRegistros(false);
  }

  useEffect(() => {
    cargarRegistros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  useEffect(() => {
    cargarCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarDesdeCenso() {
    if (!campoId) {
      setError("Selecciona el campo primero.");
      return;
    }
    if (
      slots.length > 0 &&
      !confirm("Ya hay espacios en pantalla, ¿reemplazarlos con los del censo?")
    ) {
      return;
    }
    setCargandoCenso(true);
    setError(null);
    setAvisoCenso(null);

    const { data: censo, error: errCenso } = await supabase
      .from("censo_diario")
      .select("id")
      .eq("fecha", fecha)
      .eq("campo_id", campoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errCenso) {
      setError(errCenso.message);
      setCargandoCenso(false);
      return;
    }
    if (!censo) {
      setAvisoCenso(
        "No hay censo capturado para esa fecha y campo. Puedes agregar espacios manualmente abajo."
      );
      setCargandoCenso(false);
      return;
    }

    const { data: detalle, error: errDetalle } = await supabase
      .from("censo_diario_detalle")
      .select(
        "cantidad_personas, actividad_id, actividades(nombre), catalogo_puestos(nombre, actividad_id, actividades(nombre)), censo_detalle_cuadro(cuadros(id, nombre))"
      )
      .eq("censo_id", censo.id);

    if (errDetalle) {
      setError(errDetalle.message);
      setCargandoCenso(false);
      return;
    }

    const nuevosSlots: Slot[] = [];
    let variables = 0;

    for (const d of (detalle ?? []) as any[]) {
      let actividadId: string;
      let actividadNombre: string;

      if (d.catalogo_puestos) {
        actividadId = d.catalogo_puestos.actividad_id ?? "";
        actividadNombre = d.catalogo_puestos.actividades?.nombre ?? "";
      } else if (d.actividad_id) {
        // Renglon de "actividad por temporada" (actividad directa, sin puesto)
        actividadId = d.actividad_id;
        actividadNombre = d.actividades?.nombre ?? "";
      } else {
        continue; // sin actividad de ningun tipo, no se puede cargar
      }
      if (!actividadId) variables++;

      const cuadrosPermitidos = ((d.censo_detalle_cuadro ?? []) as any[])
        .map((x) => x.cuadros)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, label: c.nombre }));

      for (let i = 0; i < d.cantidad_personas; i++) {
        const cuadroUnico = cuadrosPermitidos.length === 1 ? cuadrosPermitidos[0].id : null;
        nuevosSlots.push({
          key: uid(),
          actividadId,
          actividadNombre,
          // Si solo hay UN cuadro posible, lo preseleccionamos solo.
          // Si hay varios (o ninguno = general), lo deja para que la
          // apuntadora elija.
          cuadroId: cuadroUnico,
          cuadroNombre:
            cuadrosPermitidos.length === 0
              ? "General"
              : cuadrosPermitidos.length === 1
              ? cuadrosPermitidos[0].label
              : "",
          cuadrosPermitidos,
          cultivoId: cuadroUnico ? cultivoPorCuadro[cuadroUnico] ?? "GENERAL" : "GENERAL",
          empleadoTexto: "",
          empleadoId: null,
          tipoPago: "jornal",
          avance: "",
          tarifa: "",
          horaEntrada: "",
          horaSalida: "",
        });
      }
    }

    // Trae del dia anterior (mismo campo) quien probablemente va a estar
    // en cada actividad, para precargar nombre/tarifa/horario. El cuadro
    // y la actividad los manda el censo de HOY, no el dia anterior.
    const { data: ultimaFecha } = await supabase
      .from("apuntador_diario")
      .select("fecha")
      .eq("campo_id", campoId)
      .lt("fecha", fecha)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();

    const disponiblesPorActividad = new Map<string, any[]>();
    if (ultimaFecha) {
      const { data: previos } = await supabase
        .from("apuntador_diario")
        .select(
          "actividad_id, empleado_id, tarifa, avance, tipo_pago, hora_entrada, hora_salida, empleados(clave, nombre)"
        )
        .eq("campo_id", campoId)
        .eq("fecha", ultimaFecha.fecha);

      for (const p of (previos ?? []) as any[]) {
        const lista = disponiblesPorActividad.get(p.actividad_id ?? "") ?? [];
        lista.push(p);
        disponiblesPorActividad.set(p.actividad_id ?? "", lista);
      }
    }

    let emparejados = 0;
    for (const slot of nuevosSlots) {
      const lista = disponiblesPorActividad.get(slot.actividadId);
      const prev = lista?.shift(); // toma uno y ya no se vuelve a usar
      if (prev) {
        slot.empleadoId = prev.empleado_id;
        slot.empleadoTexto = prev.empleados
          ? `${prev.empleados.clave} — ${prev.empleados.nombre}`
          : "";
        slot.tarifa = prev.tarifa != null ? String(prev.tarifa) : "";
        slot.tipoPago = prev.tipo_pago;
        slot.avance = prev.avance != null ? String(prev.avance) : "";
        slot.horaEntrada = prev.hora_entrada ?? "";
        slot.horaSalida = prev.hora_salida ?? "";
        emparejados++;
      }
      // Si no hay coincidencia (actividad nueva o no habia suficiente
      // gente ayer), el espacio se queda en blanco para llenarlo a mano.
    }

    setSlots(nuevosSlots);
    setSeleccionados(new Set());
    const avisos: string[] = [];
    if (emparejados > 0) {
      avisos.push(
        `${emparejados} de ${nuevosSlots.length} espacios se precargaron con datos de ${
          ultimaFecha?.fecha ?? "el día anterior"
        }. Revisa y ajusta lo que haga falta.`
      );
    }
    if (variables > 0) {
      avisos.push(
        `${variables} espacio(s) no tienen una actividad fija (ej. operadores de tractor) — elige la actividad específica de ese día en cada uno.`
      );
    }
    const conVariosCuadros = nuevosSlots.filter((s) => s.cuadrosPermitidos.length > 1).length;
    if (conVariosCuadros > 0) {
      avisos.push(
        `${conVariosCuadros} espacio(s) abarcan más de un cuadro según el censo — elige a cuál cuadro corresponde cada trabajador.`
      );
    }
    if (avisos.length > 0) setAvisoCenso(avisos.join(" "));
    setCargandoCenso(false);
  }

  function toggleSeleccion(key: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSeleccionarTodos() {
    if (seleccionados.size === slots.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(slots.map((s) => s.key)));
    }
  }

  function aplicarValoresMasivos() {
    if (seleccionados.size === 0) {
      setError("Selecciona al menos un espacio (casilla a la izquierda) para aplicar los valores.");
      return;
    }
    setSlots((prev) =>
      prev.map((s) =>
        seleccionados.has(s.key)
          ? {
              ...s,
              tarifa: tarifaMasiva !== "" ? tarifaMasiva : s.tarifa,
              horaEntrada: horaEntradaMasiva !== "" ? horaEntradaMasiva : s.horaEntrada,
              horaSalida: horaSalidaMasiva !== "" ? horaSalidaMasiva : s.horaSalida,
              cultivoId: cultivoMasivo !== "" ? cultivoMasivo : s.cultivoId,
            }
          : s
      )
    );
  }

  function agregarSlotManual() {
    setSlots((s) => [
      ...s,
      {
        key: uid(),
        actividadId: "",
        actividadNombre: "",
        cuadroId: null,
        cuadroNombre: "",
        cuadrosPermitidos: [],
        cultivoId: "GENERAL",
        empleadoTexto: "",
        empleadoId: null,
        tipoPago: "jornal",
        avance: "",
        tarifa: "",
        horaEntrada: "",
        horaSalida: "",
      },
    ]);
  }

  function quitarSlot(key: string) {
    setSlots((s) => s.filter((slot) => slot.key !== key));
  }

  function actualizarSlot(key: string, cambios: Partial<Slot>) {
    setSlots((s) =>
      s.map((slot) => (slot.key === key ? { ...slot, ...cambios } : slot))
    );
  }


  async function guardarTodo() {
    const conDatosBasicos = slots.filter((s) => s.empleadoId && s.actividadId && s.tarifa);
    const sinCultivo = conDatosBasicos.filter((s) => !s.cultivoId);
    if (sinCultivo.length > 0) {
      setError(
        `${sinCultivo.length} espacio(s) no tienen cultivo elegido. Selecciona un cultivo, o "General" si aplica a todo el campo, antes de guardar.`
      );
      return;
    }
    const validos = conDatosBasicos;
    if (validos.length === 0) {
      setError(
        "No hay espacios completos para guardar (falta empleado, actividad, cultivo o tarifa)."
      );
      return;
    }
    setGuardando(true);
    setError(null);

    const filas = validos.map((s) => ({
      fecha,
      empleado_id: s.empleadoId,
      cuadro_id: s.cuadroId,
      campo_id: campoId,
      actividad_id: s.actividadId,
      cultivo_id: s.cultivoId === "GENERAL" ? null : s.cultivoId,
      tipo_pago: s.tipoPago,
      dias: s.tipoPago === "jornal" ? 1 : null,
      avance: s.tipoPago === "destajo" ? parseFloat(s.avance || "0") : null,
      tarifa: parseFloat(s.tarifa),
      periodo: periodo.semana,
      periodo_anio: periodo.anio,
      hora_entrada: s.horaEntrada || null,
      hora_salida: s.horaSalida || null,
    }));

    const { error } = await supabase.from("apuntador_diario").insert(filas);
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }

    const incompletos = slots.length - validos.length;
    setMensajeExito(
      `Se guardaron ${validos.length} registros.` +
        (incompletos > 0
          ? ` ${incompletos} espacio(s) quedaron sin guardar por faltarles datos.`
          : "")
    );
    setSlots(slots.filter((s) => !validos.includes(s)));
    cargarRegistros();
    setTimeout(() => setMensajeExito(null), 5000);
  }

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{
    empleadoId: string;
    cuadroId: string;
    actividadId: string;
    tipoPago: "jornal" | "destajo";
    avance: string;
    tarifa: string;
  } | null>(null);

  function empezarEdicion(r: any) {
    setEditandoId(r.id);
    setEdicion({
      empleadoId: r.empleado_id ?? "",
      cuadroId: r.cuadro_id ?? "",
      actividadId: r.actividad_id ?? "",
      tipoPago: r.tipo_pago,
      avance: r.avance != null ? String(r.avance) : "",
      tarifa: String(r.tarifa),
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEdicion(null);
  }

  async function guardarEdicion(id: string) {
    if (!edicion) return;
    const { error } = await supabase
      .from("apuntador_diario")
      .update({
        empleado_id: edicion.empleadoId,
        cuadro_id: edicion.cuadroId || null,
        actividad_id: edicion.actividadId,
        tipo_pago: edicion.tipoPago,
        dias: edicion.tipoPago === "jornal" ? 1 : null,
        avance: edicion.tipoPago === "destajo" ? parseFloat(edicion.avance || "0") : null,
        tarifa: parseFloat(edicion.tarifa),
      })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditandoId(null);
    setEdicion(null);
    cargarRegistros();
  }

  async function eliminarRegistro(id: string) {
    if (!confirm("¿Eliminar este registro del apuntador?")) return;
    const { error } = await supabase.from("apuntador_diario").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargarRegistros();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">
        Apuntador diario
      </h1>
      <p className="mb-6 text-sm text-campo-600">
        Carga los espacios del censo del día (cuadro y actividad), con
        nombre/tarifa/horario precargados de quien hizo lo mismo el día
        anterior — ajusta lo que haga falta.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {avisoCenso && (
        <div className="mb-4 rounded-md border border-tierra-100 bg-tierra-50 px-4 py-2 text-sm text-tierra-600">
          {avisoCenso}
        </div>
      )}
      {mensajeExito && (
        <div className="mb-4 rounded-md border border-campo-200 bg-campo-50 px-4 py-2 text-sm text-campo-700">
          {mensajeExito}
        </div>
      )}

      <div className="card mb-4 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Fecha
          </label>
          <input
            type="date"
            className="input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Campo
          </label>
          <select
            className="input"
            value={campoId}
            onChange={(e) => setCampoId(e.target.value)}
          >
            <option value="">Selecciona...</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Periodo
          </label>
          <div className="input bg-campo-50 text-campo-700">
            Semana {periodo.semana} — {periodo.anio}
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={cargarDesdeCenso}
          disabled={cargandoCenso}
        >
          {cargandoCenso ? "Cargando..." : "Cargar espacios del censo"}
        </button>
      </div>

      {slots.length > 0 && (
        <div className="card mb-3 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Tarifa</label>
            <input
              type="number"
              step="any"
              className="input w-28"
              placeholder="ej. 250"
              value={tarifaMasiva}
              onChange={(e) => setTarifaMasiva(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">H. entrada</label>
            <input
              type="time"
              className="input w-28"
              value={horaEntradaMasiva}
              onChange={(e) => setHoraEntradaMasiva(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">H. salida</label>
            <input
              type="time"
              className="input w-28"
              value={horaSalidaMasiva}
              onChange={(e) => setHoraSalidaMasiva(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Cultivo</label>
            <select
              className="input w-40"
              value={cultivoMasivo}
              onChange={(e) => setCultivoMasivo(e.target.value)}
            >
              <option value="">— sin cambio —</option>
              <option value="GENERAL">General (prorratear)</option>
              {cultivos.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" onClick={aplicarValoresMasivos}>
            Aplicar a {seleccionados.size} seleccionados
          </button>
          <span className="text-xs text-campo-500">
            Marca las casillas de la tabla de abajo y llena solo los campos que quieras aplicar.
          </span>
        </div>
      )}

      {slots.length > 0 && (
        <div className="card mb-4 hidden overflow-visible md:block">
          <table className="w-full text-sm">
            <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
              <tr>
                <th className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={seleccionados.size === slots.length && slots.length > 0}
                    onChange={toggleSeleccionarTodos}
                  />
                </th>
                <th className="px-2 py-2">Actividad</th>
                <th className="px-2 py-2">Cuadro</th>
                <th className="px-2 py-2">Cultivo</th>
                <th className="px-2 py-2">Trabajador</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Avance</th>
                <th className="px-2 py-2">Tarifa</th>
                <th className="px-2 py-2">H. entrada</th>
                <th className="px-2 py-2">H. salida</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr
                  key={s.key}
                  className={`border-t border-campo-50 ${
                    seleccionados.has(s.key) ? "bg-campo-50" : ""
                  }`}
                >
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(s.key)}
                      onChange={() => toggleSeleccion(s.key)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="input"
                      value={s.actividadId}
                      onChange={(e) => {
                        const act = actividades.find((a) => a.id === e.target.value);
                        actualizarSlot(s.key, {
                          actividadId: e.target.value,
                          actividadNombre: act?.label ?? "",
                        });
                      }}
                    >
                      <option value="">Actividad...</option>
                      {actividades.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    {s.cuadrosPermitidos.length === 1 ? (
                      <span className="text-campo-800">{s.cuadroNombre}</span>
                    ) : (
                      <select
                        className="input"
                        value={s.cuadroId ?? ""}
                        onChange={(e) => {
                          const opciones = s.cuadrosPermitidos.length > 0 ? s.cuadrosPermitidos : cuadros;
                          const cua = opciones.find((c) => c.id === e.target.value);
                          actualizarSlot(s.key, {
                            cuadroId: e.target.value || null,
                            cuadroNombre: cua?.label ?? "General",
                            cultivoId: e.target.value
                              ? cultivoPorCuadro[e.target.value] ?? s.cultivoId
                              : s.cultivoId,
                          });
                        }}
                      >
                        <option value="">General</option>
                        {(s.cuadrosPermitidos.length > 0 ? s.cuadrosPermitidos : cuadros).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="input"
                      value={s.cultivoId}
                      onChange={(e) => actualizarSlot(s.key, { cultivoId: e.target.value })}
                    >
                      <option value="">Selecciona...</option>
                      <option value="GENERAL">General (prorratear)</option>
                      {cultivos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <BuscadorEmpleado
                      empleados={empleados}
                      valorTexto={s.empleadoTexto}
                      onSeleccionar={(empleadoId, texto) =>
                        actualizarSlot(s.key, { empleadoTexto: texto, empleadoId })
                      }
                    />
                    {s.empleadoTexto && !s.empleadoId && (
                      <p className="text-[10px] text-red-500">Sin seleccionar de la lista</p>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="input"
                      value={s.tipoPago}
                      onChange={(e) =>
                        actualizarSlot(s.key, {
                          tipoPago: e.target.value as "jornal" | "destajo",
                        })
                      }
                    >
                      <option value="jornal">Jornal</option>
                      <option value="destajo">Destajo</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="any"
                      className="input w-20 disabled:opacity-30"
                      disabled={s.tipoPago !== "destajo"}
                      value={s.avance}
                      onChange={(e) =>
                        actualizarSlot(s.key, { avance: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="any"
                      className="input w-24"
                      value={s.tarifa}
                      onChange={(e) =>
                        actualizarSlot(s.key, { tarifa: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="time"
                      className="input w-24"
                      value={s.horaEntrada}
                      onChange={(e) =>
                        actualizarSlot(s.key, { horaEntrada: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="time"
                      className="input w-24"
                      value={s.horaSalida}
                      onChange={(e) =>
                        actualizarSlot(s.key, { horaSalida: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => quitarSlot(s.key)}
                      title="Quitar espacio"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista en tarjetas, solo en celular */}
      {slots.length > 0 && (
        <div className="mb-4 space-y-3 md:hidden">
          <label className="flex items-center gap-2 rounded-md bg-campo-50 px-3 py-2 text-sm text-campo-700">
            <input
              type="checkbox"
              checked={seleccionados.size === slots.length && slots.length > 0}
              onChange={toggleSeleccionarTodos}
            />
            Seleccionar todos ({seleccionados.size}/{slots.length})
          </label>
          {slots.map((s) => (
            <div
              key={s.key}
              className={`card p-3 ${seleccionados.has(s.key) ? "border-campo-300 bg-campo-50" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-campo-600">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(s.key)}
                    onChange={() => toggleSeleccion(s.key)}
                  />
                  Seleccionar
                </label>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => quitarSlot(s.key)}
                  title="Quitar espacio"
                >
                  × Quitar
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="">
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    Actividad
                  </label>
                  <select
                    className="input"
                    value={s.actividadId}
                    onChange={(e) => {
                      const act = actividades.find((a) => a.id === e.target.value);
                      actualizarSlot(s.key, {
                        actividadId: e.target.value,
                        actividadNombre: act?.label ?? "",
                      });
                    }}
                  >
                    <option value="">Actividad...</option>
                    {actividades.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    Cuadro
                  </label>
                  {s.cuadrosPermitidos.length === 1 ? (
                    <p className="input bg-campo-50 text-campo-800">{s.cuadroNombre}</p>
                  ) : (
                    <select
                      className="input"
                      value={s.cuadroId ?? ""}
                      onChange={(e) => {
                        const opciones = s.cuadrosPermitidos.length > 0 ? s.cuadrosPermitidos : cuadros;
                        const cua = opciones.find((c) => c.id === e.target.value);
                        actualizarSlot(s.key, {
                          cuadroId: e.target.value || null,
                          cuadroNombre: cua?.label ?? "General",
                          cultivoId: e.target.value
                            ? cultivoPorCuadro[e.target.value] ?? s.cultivoId
                            : s.cultivoId,
                        });
                      }}
                    >
                      <option value="">General</option>
                      {(s.cuadrosPermitidos.length > 0 ? s.cuadrosPermitidos : cuadros).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    Cultivo
                  </label>
                  <select
                    className="input"
                    value={s.cultivoId}
                    onChange={(e) => actualizarSlot(s.key, { cultivoId: e.target.value })}
                  >
                    <option value="">Selecciona...</option>
                    <option value="GENERAL">General (prorratear)</option>
                    {cultivos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="">
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    Trabajador
                  </label>
                  <BuscadorEmpleado
                    empleados={empleados}
                    valorTexto={s.empleadoTexto}
                    onSeleccionar={(empleadoId, texto) =>
                      actualizarSlot(s.key, { empleadoTexto: texto, empleadoId })
                    }
                  />
                  {s.empleadoTexto && !s.empleadoId && (
                    <p className="text-[10px] text-red-500">Sin seleccionar de la lista</p>
                  )}
                </div>

                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    Tipo
                  </label>
                  <select
                    className="input"
                    value={s.tipoPago}
                    onChange={(e) =>
                      actualizarSlot(s.key, {
                        tipoPago: e.target.value as "jornal" | "destajo",
                      })
                    }
                  >
                    <option value="jornal">Jornal</option>
                    <option value="destajo">Destajo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    Avance
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input disabled:opacity-30"
                    disabled={s.tipoPago !== "destajo"}
                    value={s.avance}
                    onChange={(e) => actualizarSlot(s.key, { avance: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    Tarifa
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={s.tarifa}
                    onChange={(e) => actualizarSlot(s.key, { tarifa: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    H. entrada
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={s.horaEntrada}
                    onChange={(e) => actualizarSlot(s.key, { horaEntrada: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-campo-500">
                    H. salida
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={s.horaSalida}
                    onChange={(e) => actualizarSlot(s.key, { horaSalida: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={agregarSlotManual}>
          + Agregar espacio manual
        </button>
        {slots.length > 0 && (
          <button className="btn-primary" onClick={guardarTodo} disabled={guardando}>
            {guardando ? "Guardando..." : `Guardar ${slots.length} espacios`}
          </button>
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">
        Registros del periodo actual (S{periodo.semana}-{periodo.anio})
      </h2>

      {loadingRegistros && (
        <p className="text-sm text-campo-400">Cargando...</p>
      )}
      {!loadingRegistros && gruposRegistros.length === 0 && (
        <p className="text-sm text-campo-400">Todavía no hay registros.</p>
      )}

      {gruposRegistros.map((grupo) => (
        <details
          key={`${grupo.fecha}__${grupo.campo}`}
          className="card mb-3 overflow-hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
            <span className="text-sm font-semibold text-campo-800">
              {grupo.fecha} — {grupo.campo}
              <span className="ml-2 font-normal text-campo-500">
                ({grupo.filas.length} registros · ${grupo.total.toFixed(2)})
              </span>
            </span>
            <span className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                className="btn-secondary text-xs"
                onClick={() => descargarExcelGrupo(grupo)}
              >
                Excel
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => descargarPdfGrupo(grupo)}
              >
                PDF
              </button>
            </span>
          </summary>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs font-medium text-campo-600">
              <tr>
                <th className="px-4 py-2">Periodo</th>
                <th className="px-4 py-2">Empleado</th>
                <th className="px-4 py-2">Cuadro</th>
                <th className="px-4 py-2">Actividad</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {grupo.filas.map((r: any) =>
                editandoId === r.id && edicion ? (
                  <tr key={r.id} className="border-t border-campo-50 bg-campo-50">
                    <td className="px-4 py-1 text-campo-600">
                      {r.periodo ? `S${r.periodo}-${r.periodo_anio}` : "—"}
                    </td>
                    <td className="px-4 py-1">
                      <select
                        className="input"
                        value={edicion.empleadoId}
                        onChange={(e) => setEdicion({ ...edicion, empleadoId: e.target.value })}
                      >
                        {empleados.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.clave} — {emp.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-1">
                      <select
                        className="input"
                        value={edicion.cuadroId}
                        onChange={(e) => setEdicion({ ...edicion, cuadroId: e.target.value })}
                      >
                        <option value="">General</option>
                        {cuadros.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-1">
                      <select
                        className="input"
                        value={edicion.actividadId}
                        onChange={(e) => setEdicion({ ...edicion, actividadId: e.target.value })}
                      >
                        {actividades.map((a) => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-1">
                      <div className="flex items-center gap-1">
                        <select
                          className="input w-24"
                          value={edicion.tipoPago}
                          onChange={(e) =>
                            setEdicion({ ...edicion, tipoPago: e.target.value as "jornal" | "destajo" })
                          }
                        >
                          <option value="jornal">Jornal</option>
                          <option value="destajo">Destajo</option>
                        </select>
                        {edicion.tipoPago === "destajo" && (
                          <input
                            type="number"
                            step="any"
                            className="input w-16"
                            placeholder="Avance"
                            value={edicion.avance}
                            onChange={(e) => setEdicion({ ...edicion, avance: e.target.value })}
                          />
                        )}
                        <input
                          type="number"
                          step="any"
                          className="input w-20"
                          placeholder="Tarifa"
                          value={edicion.tarifa}
                          onChange={(e) => setEdicion({ ...edicion, tarifa: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-1 text-right">
                      <button className="btn-secondary mr-2" onClick={() => guardarEdicion(r.id)}>
                        Guardar
                      </button>
                      <button className="btn-secondary" onClick={cancelarEdicion}>
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-t border-campo-50">
                    <td className="px-4 py-2 text-campo-800">
                      {r.periodo ? `S${r.periodo}-${r.periodo_anio}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-campo-800">
                      {r.empleados?.clave} — {r.empleados?.nombre}
                    </td>
                    <td className="px-4 py-2 text-campo-800">
                      {r.cuadros?.nombre ?? "General"}
                    </td>
                    <td className="px-4 py-2 text-campo-800">
                      {r.actividades?.nombre}
                    </td>
                    <td className="px-4 py-2 text-campo-800">
                      ${Number(r.total).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button className="btn-secondary mr-2" onClick={() => empezarEdicion(r)}>
                        Editar
                      </button>
                      <button className="btn-danger" onClick={() => eliminarRegistro(r.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          </div>
        </details>
      ))}
    </div>
  );
}
