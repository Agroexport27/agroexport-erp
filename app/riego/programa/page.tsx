"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MultiSelectCuadros from "@/components/MultiSelectCuadros";
import { generarPdfRiego } from "@/lib/pdf/riego";

type Opcion = { id: string; label: string; grupo?: string };
type Producto = { id: string; nombre: string; unidad: string };

type LineaProducto = {
  key: string;
  productoId: string;
  productoTexto: string;
  dosisHa: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function horasEntre(inicio: string, fin: string): number | null {
  if (!inicio || !fin) return null;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fin.split(":").map(Number);
  let minutos = h2 * 60 + m2 - (h1 * 60 + m1);
  if (minutos < 0) minutos += 24 * 60; // cruza medianoche
  return Math.round((minutos / 60) * 100) / 100;
}

export default function ProgramaRiegoPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [cuadrosTodos, setCuadrosTodos] = useState<(Opcion & { hectareas: number })[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ciclos, setCiclos] = useState<{ id: string; clave: string; fecha_inicio: string; fecha_fin: string }[]>([]);
  const [sesiones, setSesiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [cuadroIds, setCuadroIds] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [horas, setHoras] = useState("");
  const [horasEditadoManual, setHorasEditadoManual] = useState(false);

  const [lineas, setLineas] = useState<LineaProducto[]>([
    { key: uid(), productoId: "", productoTexto: "", dosisHa: "" },
  ]);

  // Calcula las horas totales solas en cuanto pones inicio y fin, a
  // menos que el usuario ya las haya tecleado el a mano.
  useEffect(() => {
    if (horasEditadoManual) return;
    const calc = horasEntre(horaInicio, horaFin);
    if (calc != null) setHoras(String(calc));
  }, [horaInicio, horaFin, horasEditadoManual]);

  async function cargarCatalogos() {
    const [{ data: camp }, { data: cua }, { data: prod }, { data: cic }] = await Promise.all([
      supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("cuadros").select("id, nombre, hectareas, campos(nombre)").order("nombre"),
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
    setProductos(prod ?? []);
    setCiclos(cic ?? []);
  }

  async function cargarRecientes() {
    setLoading(true);
    const [{ data, error }, { data: aplic }] = await Promise.all([
      supabase
        .from("riego_diario")
        .select("id, fecha, horas_riego, sesion_id, observaciones, cuadros(nombre, campos(nombre))")
        .order("fecha", { ascending: false })
        .limit(300),
      supabase
        .from("aplicaciones")
        .select("origen_id, cantidad, unidad, catalogo_productos(nombre)")
        .eq("tipo", "fertirriego")
        .eq("origen_tipo", "programa_riego"),
    ]);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Junta los productos de fertirriego por sesion (vienen repartidos
    // por cuadro, aqui se agrupan de vuelta por producto)
    const productosPorSesion = new Map<string, Map<string, any>>();
    for (const a of (aplic ?? []) as any[]) {
      if (!a.origen_id) continue;
      const mapaProductos = productosPorSesion.get(a.origen_id) ?? new Map();
      const nombre = a.catalogo_productos?.nombre ?? "";
      const item = mapaProductos.get(nombre) ?? { nombre, cantidad: 0, unidad: a.unidad };
      item.cantidad += Number(a.cantidad);
      mapaProductos.set(nombre, item);
      productosPorSesion.set(a.origen_id, mapaProductos);
    }

    // Agrupa por sesion_id (o por fecha+campo+horario para riegos viejos
    // que no tengan sesion_id)
    const grupos = new Map<string, any>();
    for (const r of (data ?? []) as any[]) {
      const key = r.sesion_id ?? `${r.fecha}__${r.cuadros?.campos?.nombre}__${r.observaciones}`;
      const g =
        grupos.get(key) ??
        {
          key,
          sesionId: r.sesion_id,
          fecha: r.fecha,
          campo: r.cuadros?.campos?.nombre ?? "",
          observaciones: r.observaciones,
          cuadros: [] as any[],
          productos: r.sesion_id
            ? Array.from((productosPorSesion.get(r.sesion_id) ?? new Map()).values())
            : [],
          totalHoras: 0,
        };
      g.cuadros.push({ nombre: r.cuadros?.nombre, horas: r.horas_riego });
      g.totalHoras += Number(r.horas_riego);
      grupos.set(key, g);
    }
    setSesiones(Array.from(grupos.values()));
    setLoading(false);
  }

  useEffect(() => {
    cargarCatalogos();
    cargarRecientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cuadrosDelCampo = useMemo(
    () =>
      campoId
        ? cuadrosTodos.filter((c) => campos.find((cp) => cp.id === campoId)?.label === c.grupo)
        : cuadrosTodos,
    [cuadrosTodos, campoId, campos]
  );

  const superficieTotal = useMemo(
    () => cuadroIds.reduce((s, id) => s + (cuadrosTodos.find((c) => c.id === id)?.hectareas ?? 0), 0),
    [cuadroIds, cuadrosTodos]
  );

  function agregarLinea() {
    setLineas((l) => [...l, { key: uid(), productoId: "", productoTexto: "", dosisHa: "" }]);
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
    if (!campoId || cuadroIds.length === 0 || !horas) {
      setError("Selecciona campo, al menos un cuadro, y las horas de riego.");
      return;
    }
    const ciclo = ciclos.find((c) => fecha >= c.fecha_inicio && fecha <= c.fecha_fin);
    const lineasValidas = lineas.filter((l) => l.productoId && l.dosisHa);
    if (lineasValidas.length > 0 && !ciclo) {
      setError(
        "No hay un ciclo definido para esa fecha. Agrégalo en Catálogos → Ciclos para poder registrar el fertirriego."
      );
      return;
    }

    setGuardando(true);
    setError(null);

    const sesionId = crypto.randomUUID();
    const observaciones =
      horaInicio || horaFin ? `Horario: ${horaInicio || "?"} - ${horaFin || "?"}` : null;

    // 1) Horas de riego, una fila por cuadro, todas con el mismo sesion_id
    const filasRiego = cuadroIds.map((cuadroId) => ({
      cuadro_id: cuadroId,
      fecha,
      horas_riego: parseFloat(horas),
      observaciones,
      sesion_id: sesionId,
    }));
    const { error: errRiego } = await supabase.from("riego_diario").insert(filasRiego);
    if (errRiego) {
      setError(errRiego.message);
      setGuardando(false);
      return;
    }

    if (lineasValidas.length > 0 && ciclo) {
      const filasAplicaciones: any[] = [];
      const totalesPorProducto: Record<string, number> = {};

      for (const l of lineasValidas) {
        const dosis = parseFloat(l.dosisHa);
        for (const cuadroId of cuadroIds) {
          const cuadro = cuadrosTodos.find((c) => c.id === cuadroId)!;
          const cantidad = dosis * cuadro.hectareas;
          filasAplicaciones.push({
            producto_id: l.productoId,
            cuadro_id: cuadroId,
            ciclo_id: ciclo.id,
            fecha,
            cantidad,
            unidad: productos.find((p) => p.id === l.productoId)?.unidad ?? "LT",
            tipo: "fertirriego",
            metodo: "Riego por goteo",
            origen_tipo: "programa_riego",
            origen_id: sesionId,
          });
          totalesPorProducto[l.productoId] = (totalesPorProducto[l.productoId] ?? 0) + cantidad;
        }
      }

      const { error: errAplic } = await supabase.from("aplicaciones").insert(filasAplicaciones);
      if (errAplic) {
        setError("Se guardaron las horas de riego, pero falló el registro de fertirriego: " + errAplic.message);
        setGuardando(false);
        cargarRecientes();
        return;
      }

      const filasMovimiento = Object.entries(totalesPorProducto).map(([productoId, cantidad]) => ({
        producto_id: productoId,
        campo_id: campoId,
        fecha,
        tipo: "salida",
        cantidad,
        observaciones: "Fertirriego",
        origen_tipo: "programa_riego",
        origen_id: sesionId,
      }));
      const { error: errMov } = await supabase
        .from("movimientos_inventario_agroquimicos")
        .insert(filasMovimiento);
      if (errMov) {
        setError(
          "Se guardó el riego y el fertirriego, pero falló el descuento de inventario: " + errMov.message
        );
        setGuardando(false);
        cargarRecientes();
        return;
      }
    }

    setGuardando(false);
    setMensajeExito(
      `Riego guardado en ${cuadroIds.length} cuadro(s)` +
        (lineasValidas.length > 0 ? `, con ${lineasValidas.length} producto(s) de fertirriego.` : ".") +
        " Puedes capturar otro riego más para el mismo día sin problema."
    );
    setCuadroIds([]);
    setHoras("");
    setHorasEditadoManual(false);
    setHoraInicio("");
    setHoraFin("");
    setLineas([{ key: uid(), productoId: "", productoTexto: "", dosisHa: "" }]);
    cargarRecientes();
    setTimeout(() => setMensajeExito(null), 5000);
  }

  function descargarPdfSesion(sesion: any) {
    const productosPdf = sesion.productos.map((p: any) => ({
      nombre: p.nombre,
      cantidad: p.cantidad,
      unidad: p.unidad,
      dosisHa: null,
    }));

    generarPdfRiego({
      fecha: sesion.fecha,
      campoNombre: sesion.campo,
      horaInicio: sesion.observaciones?.match(/Horario: (\S+)/)?.[1] ?? null,
      horaFin: sesion.observaciones?.match(/- (\S+)$/)?.[1] ?? null,
      cuadros: sesion.cuadros,
      productos: productosPdf,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Programa de riego</h1>
      <p className="mb-6 text-sm text-campo-600">
        Registra horas de riego y fertirriego para varios cuadros a la vez.
        Puedes guardar hasta 6 riegos distintos el mismo día sin problema —
        cada uno queda como un registro separado.
      </p>

      <datalist id="productos-datalist-riego">
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

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Fecha</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select
            className="input"
            value={campoId}
            onChange={(e) => {
              setCampoId(e.target.value);
              setCuadroIds([]);
            }}
          >
            <option value="">Selecciona...</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Cuadro(s) — {superficieTotal.toFixed(2)} ha
          </label>
          <MultiSelectCuadros opciones={cuadrosDelCampo} seleccionados={cuadroIds} onChange={setCuadroIds} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hora inicio</label>
          <input type="time" className="input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Hora fin</label>
          <input type="time" className="input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">
            Horas totales {!horasEditadoManual && horas && <span className="text-campo-400">(auto)</span>}
          </label>
          <input
            type="number"
            step="any"
            className="input"
            placeholder="ej. 6"
            value={horas}
            onChange={(e) => {
              setHoras(e.target.value);
              setHorasEditadoManual(true);
            }}
          />
          {horasEditadoManual && (
            <button
              type="button"
              className="mt-1 text-[11px] text-campo-500 underline"
              onClick={() => setHorasEditadoManual(false)}
            >
              Volver a calcular automático
            </button>
          )}
        </div>
      </div>

      <div className="card mb-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-3 py-2">Producto (fertirriego)</th>
              <th className="px-3 py-2">Dosis/ha</th>
              <th className="px-3 py-2">Total a aplicar</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const producto = productos.find((p) => p.id === l.productoId);
              const total = l.dosisHa ? parseFloat(l.dosisHa) * superficieTotal : 0;
              return (
                <tr key={l.key} className="border-t border-campo-50">
                  <td className="px-3 py-1">
                    <input
                      className="input w-48"
                      list="productos-datalist-riego"
                      placeholder="Buscar producto..."
                      value={l.productoTexto}
                      onChange={(e) => manejarTextoProducto(l.key, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="number"
                      step="any"
                      className="input w-24"
                      value={l.dosisHa}
                      onChange={(e) => actualizarLinea(l.key, { dosisHa: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-1 text-campo-600">
                    {l.dosisHa ? `${total.toFixed(2)} ${producto?.unidad ?? ""}` : "—"}
                  </td>
                  <td className="px-3 py-1">
                    <button className="text-red-500 hover:text-red-700" onClick={() => quitarLinea(l.key)}>
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-campo-50 px-4 py-2">
          <button className="btn-secondary text-xs" onClick={agregarLinea}>
            + Agregar producto
          </button>
        </div>
      </div>

      <button className="btn-primary mb-8" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar este riego"}
      </button>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Riegos recientes</h2>
      {loading && <p className="text-sm text-campo-400">Cargando...</p>}
      {!loading && sesiones.length === 0 && (
        <p className="text-sm text-campo-400">Todavía no hay riegos.</p>
      )}
      {sesiones.map((s) => (
        <details key={s.key} className="card mb-2 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
            <span className="text-sm font-medium text-campo-800">
              {s.fecha} — {s.campo}
              <span className="ml-2 font-normal text-campo-500">
                ({s.cuadros.length} cuadro(s) · {s.totalHoras.toFixed(1)} h)
              </span>
            </span>
            <span onClick={(e) => e.preventDefault()}>
              <button className="btn-secondary" onClick={() => descargarPdfSesion(s)}>
                Descargar PDF
              </button>
            </span>
          </summary>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-campo-600">
              <tr>
                <th className="px-4 py-1">Cuadro</th>
                <th className="px-4 py-1">Horas</th>
              </tr>
            </thead>
            <tbody>
              {s.cuadros.map((c: any, i: number) => (
                <tr key={i} className="border-t border-campo-50">
                  <td className="px-4 py-1 text-campo-800">{c.nombre}</td>
                  <td className="px-4 py-1 text-campo-800">{c.horas}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.productos.length > 0 && (
            <>
              <p className="border-t border-campo-100 bg-campo-50 px-4 py-1 text-xs font-medium text-campo-600">
                Fertirriego aplicado
              </p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-medium text-campo-600">
                  <tr>
                    <th className="px-4 py-1">Producto</th>
                    <th className="px-4 py-1">Total aplicado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.productos.map((p: any, i: number) => (
                    <tr key={i} className="border-t border-campo-50">
                      <td className="px-4 py-1 text-campo-800">{p.nombre}</td>
                      <td className="px-4 py-1 text-campo-800">
                        {p.cantidad.toFixed(2)} {p.unidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </details>
      ))}
    </div>
  );
}
