"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MultiSelectCuadros from "@/components/MultiSelectCuadros";
import { generarPdfCenso, FilaCensoPdf } from "@/lib/pdf/censo";
import { obtenerCuadrosPermitidos } from "@/lib/utils/cuadrosPrograma";

type Puesto = { id: string; nombre: string; categoria: string };
type Opcion = { id: string; label: string; grupo?: string };
type FilaTemporada = { actividadId: string; actividadNombre: string; cantidad: string; cuadroIds: string[] };

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  maquinaria_taller_almacen: "Maquinaria / Taller / Almacén",
  tractor: "Tractor",
  riego: "Riego",
  jornal: "Jornal",
  operativo: "Operativo",
};

export default function CensoPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [cuadros, setCuadros] = useState<Opcion[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [actividades, setActividades] = useState<Opcion[]>([]);
  const [censosRecientes, setCensosRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [folio, setFolio] = useState("");

  // valores[puestoId] = { cantidad, cuadroIds }
  const [valores, setValores] = useState<
    Record<string, { cantidad: string; cuadroIds: string[] }>
  >({});
  const [filasTemporada, setFilasTemporada] = useState<FilaTemporada[]>([
    { actividadId: "", actividadNombre: "", cantidad: "", cuadroIds: [] },
  ]);

  async function cargarCatalogos() {
    const [{ data: camp }, cua, { data: pue }, { data: act }] = await Promise.all([
      supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre"),
      obtenerCuadrosPermitidos(supabase),
      supabase.from("catalogo_puestos").select("id, nombre, categoria").eq("activo", true),
      supabase.from("actividades").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    setCampos((camp ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
    setCuadros(
      cua.map((c) => ({
        id: c.id,
        label: c.nombre,
        grupo: c.campoNombre,
      }))
    );
    setPuestos(pue ?? []);
    setActividades((act ?? []).map((a: any) => ({ id: a.id, label: a.nombre })));
  }

  async function cargarCensosRecientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("censo_diario")
      .select(
        "id, folio, fecha, campos(nombre), censo_diario_detalle(cantidad_personas, puesto_id, actividad_id)"
      )
      .order("fecha", { ascending: false })
      .limit(15);
    if (error) setError(error.message);
    else setCensosRecientes(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarCatalogos();
    cargarCensosRecientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function actualizarValor(
    puestoId: string,
    campo: "cantidad" | "cuadroIds",
    val: string | string[]
  ) {
    setValores((v) => ({
      ...v,
      [puestoId]: {
        ...(v[puestoId] ?? { cantidad: "", cuadroIds: [] }),
        [campo]: val,
      },
    }));
  }

  function actualizarFilaTemporada(
    idx: number,
    campo: keyof FilaTemporada,
    val: string | string[]
  ) {
    setFilasTemporada((filas) =>
      filas.map((f, i) => (i === idx ? { ...f, [campo]: val } : f))
    );
  }

  function agregarFilaTemporada() {
    setFilasTemporada((f) => [...f, { actividadId: "", actividadNombre: "", cantidad: "", cuadroIds: [] }]);
  }

  async function descargarPdfExistente(censoId: string) {
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

    const filas: FilaCensoPdf[] = ((data as any).censo_diario_detalle ?? []).map((d: any) => {
      const categoria = d.catalogo_puestos
        ? ETIQUETAS_CATEGORIA[d.catalogo_puestos.categoria] ?? d.catalogo_puestos.categoria
        : "Actividad por temporada";
      const descripcion = d.catalogo_puestos?.nombre ?? d.actividades?.nombre ?? "—";
      const nombresCuadros = (d.censo_detalle_cuadro ?? []).map((x: any) => x.cuadros?.nombre).filter(Boolean);
      return {
        categoria,
        descripcion,
        cuadro: nombresCuadros.length > 0 ? nombresCuadros.join(", ") : "General",
        cantidad: d.cantidad_personas,
      };
    });

    generarPdfCenso({
      campoNombre: (data as any).campos?.nombre ?? "",
      fecha: (data as any).fecha,
      folio: (data as any).folio,
      filas,
    });
  }

  async function eliminarCenso(id: string) {
    if (
      !confirm(
        "¿Eliminar este censo? Se borra junto con todo su detalle. No se puede deshacer."
      )
    )
      return;
    const { error } = await supabase.from("censo_diario").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargarCensosRecientes();
  }

  async function guardar() {
    if (!campoId) {
      setError("Selecciona el campo.");
      return;
    }
    setGuardando(true);
    setError(null);

    const { data: censo, error: errCenso } = await supabase
      .from("censo_diario")
      .insert({ fecha, campo_id: campoId, folio: folio || null })
      .select("id")
      .single();

    if (errCenso || !censo) {
      setError(
        errCenso?.code === "23505"
          ? "Ya existe un censo para ese día y campo. Elimínalo en Nóminas → Registros → Censos si quieres capturarlo de nuevo."
          : errCenso?.message ?? "No se pudo crear el censo."
      );
      setGuardando(false);
      return;
    }

    // Una fila por puesto/actividad, con la cantidad REAL (no duplicada
    // por cuadro). Los cuadros elegidos son solo "opciones válidas" para
    // que la apuntadora reparta despues, no cantidad por cuadro.
    type LineaParaGuardar = {
      puestoId?: string;
      actividadId?: string;
      cantidad: number;
      cuadroIds: string[];
      categoria: string;
      descripcion: string;
    };
    const lineasParaGuardar: LineaParaGuardar[] = [];

    for (const puesto of puestos) {
      const v = valores[puesto.id];
      const cantidad = v?.cantidad ? parseInt(v.cantidad) : 0;
      if (cantidad > 0) {
        lineasParaGuardar.push({
          puestoId: puesto.id,
          cantidad,
          cuadroIds: v?.cuadroIds ?? [],
          categoria: ETIQUETAS_CATEGORIA[puesto.categoria] ?? puesto.categoria,
          descripcion: puesto.nombre,
        });
      }
    }

    for (const fila of filasTemporada) {
      const cantidad = fila.cantidad ? parseInt(fila.cantidad) : 0;
      if (fila.actividadId && cantidad > 0) {
        lineasParaGuardar.push({
          actividadId: fila.actividadId,
          cantidad,
          cuadroIds: fila.cuadroIds,
          categoria: "Actividad por temporada",
          descripcion: fila.actividadNombre,
        });
      }
    }

    const filasPdf: FilaCensoPdf[] = lineasParaGuardar.map((l) => ({
      categoria: l.categoria,
      descripcion: l.descripcion,
      cuadro:
        l.cuadroIds.length === 0
          ? "General"
          : l.cuadroIds.map((id) => cuadros.find((c) => c.id === id)?.label ?? id).join(", "),
      cantidad: l.cantidad,
    }));

    let totalRenglones = 0;
    if (lineasParaGuardar.length > 0) {
      const { data: detalleInsertado, error: errDetalle } = await supabase
        .from("censo_diario_detalle")
        .insert(
          lineasParaGuardar.map((l) => ({
            censo_id: censo.id,
            puesto_id: l.puestoId ?? null,
            actividad_id: l.actividadId ?? null,
            cuadro_id: null,
            cantidad_personas: l.cantidad,
          }))
        )
        .select("id");

      if (errDetalle || !detalleInsertado) {
        setError(errDetalle?.message ?? "No se pudo guardar el detalle.");
        setGuardando(false);
        return;
      }

      // Inserta los cuadros permitidos de cada linea (el orden del
      // resultado corresponde al orden de insercion).
      const filasCuadro: any[] = [];
      detalleInsertado.forEach((fila: any, idx: number) => {
        for (const cuadroId of lineasParaGuardar[idx].cuadroIds) {
          filasCuadro.push({ detalle_id: fila.id, cuadro_id: cuadroId });
        }
      });
      if (filasCuadro.length > 0) {
        await supabase.from("censo_detalle_cuadro").insert(filasCuadro);
      }
      totalRenglones = detalleInsertado.length;
    }

    const campoNombre = campos.find((c) => c.id === campoId)?.label ?? "";
    if (filasPdf.length > 0) {
      generarPdfCenso({ campoNombre, fecha, folio, filas: filasPdf });
    }

    setGuardando(false);
    setMensajeExito(`Censo guardado con ${totalRenglones} renglones. Se descargó el PDF.`);
    setFolio("");
    setValores({});
    setFilasTemporada([{ actividadId: "", actividadNombre: "", cantidad: "", cuadroIds: [] }]);
    cargarCensosRecientes();
    setTimeout(() => setMensajeExito(null), 4000);
  }

  const categorias = ["maquinaria_taller_almacen", "tractor", "riego", "jornal", "operativo"];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Censo diario</h1>
      <p className="mb-6 text-sm text-campo-600">
        Pase de lista que manda el ingeniero de campo a oficina.
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

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Fecha
          </label>
          <input
            type="date"
            className="input min-w-0"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Campo
          </label>
          <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
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
            Folio (opcional)
          </label>
          <input
            className="input"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="ej. 01294"
          />
        </div>
      </div>

      {categorias.map((cat) => {
        const puestosCat = puestos.filter((p) => p.categoria === cat);
        if (puestosCat.length === 0) return null;
        return (
          <div key={cat} className="card mb-4 overflow-visible">
            <div className="bg-campo-50 px-4 py-2">
              <h2 className="text-sm font-semibold text-campo-800">
                {ETIQUETAS_CATEGORIA[cat]}
              </h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {puestosCat.map((p) => (
                  <tr key={p.id} className="border-t border-campo-50">
                    <td className="w-1/2 px-4 py-2 text-campo-800">{p.nombre}</td>
                    <td className="w-28 px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        className="input"
                        placeholder="0"
                        value={valores[p.id]?.cantidad ?? ""}
                        onChange={(e) =>
                          actualizarValor(p.id, "cantidad", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <MultiSelectCuadros
                        opciones={cuadros}
                        seleccionados={valores[p.id]?.cuadroIds ?? []}
                        onChange={(v) => actualizarValor(p.id, "cuadroIds", v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="card mb-6 overflow-visible">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">
            Actividad por temporada
          </h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {filasTemporada.map((fila, idx) => (
              <tr key={idx} className="border-t border-campo-50">
                <td className="w-1/2 px-4 py-2">
                  <select
                    className="input"
                    value={fila.actividadId}
                    onChange={(e) => {
                      const act = actividades.find((a) => a.id === e.target.value);
                      actualizarFilaTemporada(idx, "actividadId", e.target.value);
                      actualizarFilaTemporada(idx, "actividadNombre", act?.label ?? "");
                    }}
                  >
                    <option value="">Selecciona actividad...</option>
                    {actividades.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="w-28 px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    className="input"
                    placeholder="0"
                    value={fila.cantidad}
                    onChange={(e) =>
                      actualizarFilaTemporada(idx, "cantidad", e.target.value)
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <MultiSelectCuadros
                    opciones={cuadros}
                    seleccionados={fila.cuadroIds}
                    onChange={(v) => actualizarFilaTemporada(idx, "cuadroIds", v)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-campo-50 px-4 py-2">
          <button className="btn-secondary text-xs" onClick={agregarFilaTemporada}>
            + Agregar renglón
          </button>
        </div>
      </div>

      <button className="btn-primary" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar censo del día"}
      </button>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-campo-800">
        Censos recientes
      </h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
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
            {loading && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={5}>
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && censosRecientes.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-campo-400" colSpan={5}>
                  Todavía no hay censos capturados.
                </td>
              </tr>
            )}
            {censosRecientes.map((c: any) => {
              // Cuenta cada actividad una sola vez (no una vez por cada
              // cuadro que abarcó), igual que en el PDF.
              const vistos = new Set<string>();
              let total = 0;
              for (const d of c.censo_diario_detalle ?? []) {
                const key = `${d.puesto_id ?? ""}__${d.actividad_id ?? ""}`;
                if (!vistos.has(key)) {
                  vistos.add(key);
                  total += d.cantidad_personas ?? 0;
                }
              }
              return (
                <tr key={c.id} className="border-t border-campo-50">
                  <td className="px-4 py-2 text-campo-800">{c.fecha}</td>
                  <td className="px-4 py-2 text-campo-800">{c.campos?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">{c.folio ?? "—"}</td>
                  <td className="px-4 py-2 text-campo-800">{total}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="btn-secondary"
                      onClick={() => descargarPdfExistente(c.id)}
                    >
                      Descargar PDF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
