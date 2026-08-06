"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarPdfRegistrosAgroquimicos } from "@/lib/pdf/registrosAgroquimicos";
import { generarPdfAplicacionFoliar } from "@/lib/pdf/aplicacionFoliar";

type Opcion = { id: string; label: string };

function inicioDeSemanaActual() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = (dia + 1) % 7;
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - diff);
  return inicio.toISOString().slice(0, 10);
}

export default function RegistrosAgroquimicosPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [productosOpciones, setProductosOpciones] = useState<Opcion[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState(inicioDeSemanaActual());
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [tipo, setTipo] = useState<"" | "foliar" | "fertirriego">("");
  const [productoId, setProductoId] = useState("");

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));

    supabase
      .from("catalogo_productos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setProductosOpciones((data ?? []).map((p: any) => ({ id: p.id, label: p.nombre }))));
  }, []);

  async function consultar() {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("aplicaciones")
      .select(
        "id, fecha, cantidad, unidad, tipo, metodo, origen_id, catalogo_productos(nombre), cuadros(nombre, campo_id, campos(nombre))"
      )
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .order("fecha", { ascending: false });

    if (tipo) query = query.eq("tipo", tipo);
    if (productoId) query = query.eq("producto_id", productoId);

    const { data, error } = await query.limit(2000);
    let filtrados = (data ?? []) as any[];
    if (campoId) filtrados = filtrados.filter((r) => r.cuadros?.campo_id === campoId);

    if (error) setError(error.message);
    else setRegistros(filtrados);
    setLoading(false);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gruposPorTipo = useMemo(() => {
    const grupos: Record<string, any[]> = { foliar: [], fertirriego: [] };
    for (const r of registros) {
      grupos[r.tipo]?.push(r);
    }
    return grupos;
  }, [registros]);

  async function descargarPdfFolio(aplicacionFoliarId: string) {
    const { data, error } = await supabase
      .from("aplicacion_foliar")
      .select(
        "folio, campos(nombre), cultivos(nombre), variedades(nombre), superficie_has, fecha_aplicacion, triple_lavado, operador, no_tractor, no_aspersora, lts_por_tanque, has_por_tanque, no_cargas, se_calibro_equipo, hora_inicio, hora_termino, gerente_campo, encargado_aplicaciones, aplicacion_foliar_cuadro(cuadros(nombre)), aplicacion_foliar_producto(dosis_ha, dosis_tanque, total_utilizado, catalogo_productos(nombre, unidad))"
      )
      .eq("id", aplicacionFoliarId)
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

  function TablaTipo({ titulo, filas, conPdfPorFolio }: { titulo: string; filas: any[]; conPdfPorFolio?: boolean }) {
    const foliosVistos = new Set<string>();
    return (
      <div className="card mb-6 overflow-x-auto">
        <div className="bg-campo-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-campo-800">
            {titulo} <span className="font-normal text-campo-500">({filas.length})</span>
          </h2>
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Cuadro</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Cantidad</th>
              <th className="px-4 py-2">Método</th>
              {conPdfPorFolio && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={conPdfPorFolio ? 7 : 6}>Sin registros.</td></tr>
            )}
            {filas.map((r) => {
              const yaVisto = r.origen_id && foliosVistos.has(r.origen_id);
              if (r.origen_id) foliosVistos.add(r.origen_id);
              return (
                <tr key={r.id} className="border-t border-campo-50">
                  <td className="px-4 py-2 text-campo-800">{r.fecha}</td>
                  <td className="px-4 py-2 text-campo-800">{r.cuadros?.campos?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">{r.cuadros?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">{r.catalogo_productos?.nombre}</td>
                  <td className="px-4 py-2 text-campo-800">{Number(r.cantidad).toFixed(2)} {r.unidad}</td>
                  <td className="px-4 py-2 text-campo-600">{r.metodo ?? "—"}</td>
                  {conPdfPorFolio && (
                    <td className="px-4 py-2 text-right">
                      {!yaVisto && r.origen_id && (
                        <button className="btn-secondary" onClick={() => descargarPdfFolio(r.origen_id)}>
                          PDF
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function descargarPdf() {
    function mapear(filas: any[]) {
      return filas.map((r) => ({
        fecha: r.fecha,
        campo: r.cuadros?.campos?.nombre ?? "",
        cuadro: r.cuadros?.nombre ?? "",
        producto: r.catalogo_productos?.nombre ?? "",
        cantidad: Number(r.cantidad ?? 0),
        unidad: r.unidad,
        metodo: r.metodo ?? "—",
      }));
    }
    generarPdfRegistrosAgroquimicos({
      rango: `${fechaInicio}_a_${fechaFin}`,
      foliar: mapear(gruposPorTipo.foliar),
      fertirriego: mapear(gruposPorTipo.fertirriego),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Registros — Agroquímicos</h1>
      <p className="mb-6 text-sm text-campo-600">
        Todas las aplicaciones (foliar con aspersora/dron, y vía riego) en un solo lugar.
      </p>

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
          <label className="mb-1 block text-xs font-medium text-campo-600">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="">Todos</option>
            <option value="foliar">Foliar</option>
            <option value="fertirriego">Vía riego</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Producto</label>
          <select className="input" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">Todos</option>
            {productosOpciones.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? "Consultando..." : "Consultar"}
        </button>
        <button className="btn-secondary" onClick={descargarPdf}>
          Descargar PDF
        </button>
      </div>

      <TablaTipo titulo="Foliar" filas={gruposPorTipo.foliar} conPdfPorFolio />
      <TablaTipo titulo="Vía riego" filas={gruposPorTipo.fertirriego} />
    </div>
  );
}
