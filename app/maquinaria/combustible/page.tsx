"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BuscadorEmpleado from "@/components/BuscadorEmpleado";

type Opcion = { id: string; label: string; tipo?: string };
type Empleado = { id: string; clave: string; nombre: string };

export default function CombustiblePage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [unidades, setUnidades] = useState<Opcion[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [recientes, setRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [tipoCombustible, setTipoCombustible] = useState<"diesel" | "gasolina">("diesel");
  const [tipoMovimiento, setTipoMovimiento] = useState<"entrada" | "salida">("salida");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [campoId, setCampoId] = useState("");
  const [litros, setLitros] = useState("");
  const [unidadId, setUnidadId] = useState("");
  const [choferTexto, setChoferTexto] = useState("");
  const [choferEmpleadoId, setChoferEmpleadoId] = useState<string | null>(null);
  const [folio, setFolio] = useState("");
  const [observaciones, setObservaciones] = useState("");

  async function fetchTodasLasFilas(construirQuery: (desde: number, hasta: number) => any) {
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
    const [{ data: camp }, { data: uni }] = await Promise.all([
      supabase.from("campos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("catalogo_unidades").select("id, nombre, tipo_combustible").eq("activo", true).order("nombre"),
    ]);
    setCampos((camp ?? []).map((c: any) => ({ id: c.id, label: c.nombre })));
    setUnidades((uni ?? []).map((u: any) => ({ id: u.id, label: u.nombre, tipo: u.tipo_combustible })));

    const emp = await fetchTodasLasFilas((desde, hasta) =>
      supabase.from("empleados").select("id, clave, nombre").eq("activo", true).order("clave").range(desde, hasta)
    );
    emp.sort((a: any, b: any) => Number(a.clave) - Number(b.clave) || a.clave.localeCompare(b.clave));
    setEmpleados(emp);
  }

  async function cargarStock() {
    const { data } = await supabase
      .from("combustible_stock")
      .select("tipo_combustible, stock_actual, campos(nombre)")
      .order("tipo_combustible");
    setStock(data ?? []);
  }

  async function cargarRecientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("combustible_movimientos")
      .select(
        "id, tipo_combustible, tipo, fecha, litros, folio, observaciones, campos(nombre), catalogo_unidades(nombre), empleados(clave, nombre)"
      )
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) setError(error.message);
    else setRecientes(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarCatalogos();
    cargarStock();
    cargarRecientes();
  }, []);

  const unidadesFiltradas = useMemo(
    () => unidades.filter((u) => u.tipo === tipoCombustible),
    [unidades, tipoCombustible]
  );

  async function guardar() {
    if (!campoId || !litros) {
      setError("Selecciona campo y litros.");
      return;
    }
    if (tipoMovimiento === "salida" && !unidadId) {
      setError("Selecciona la unidad que recibió el combustible.");
      return;
    }
    if (tipoMovimiento === "salida" && choferTexto && !choferEmpleadoId) {
      setError("El chofer debe seleccionarse de la lista de empleados.");
      return;
    }
    setGuardando(true);
    setError(null);

    const { error } = await supabase.from("combustible_movimientos").insert({
      tipo_combustible: tipoCombustible,
      campo_id: campoId,
      fecha,
      tipo: tipoMovimiento,
      litros: parseFloat(litros),
      unidad_id: tipoMovimiento === "salida" ? unidadId : null,
      chofer_empleado_id: tipoMovimiento === "salida" ? choferEmpleadoId : null,
      folio: folio || null,
      observaciones: observaciones || null,
    });

    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }

    setMensajeExito(
      `${tipoMovimiento === "entrada" ? "Entrada" : "Salida"} de ${litros} L de ${tipoCombustible} guardada.`
    );
    setLitros("");
    setUnidadId("");
    setChoferTexto("");
    setChoferEmpleadoId(null);
    setFolio("");
    setObservaciones("");
    cargarStock();
    cargarRecientes();
    setTimeout(() => setMensajeExito(null), 4000);
  }

  async function eliminarMovimiento(id: string) {
    if (!confirm("¿Eliminar este movimiento? Se revierte del inventario. No se puede deshacer.")) return;
    const { error } = await supabase.from("combustible_movimientos").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargarStock();
    cargarRecientes();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Combustible</h1>
      <p className="mb-6 text-sm text-campo-600">
        Entradas al tanque y salidas a cada unidad, para diésel y gasolina.
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stock.map((s: any, i: number) => (
          <div key={i} className="card p-4">
            <p className="text-xs text-campo-500 capitalize">
              {s.tipo_combustible} — {s.campos?.nombre ?? "Sin campo"}
            </p>
            <p className="text-2xl font-semibold text-campo-900">{Number(s.stock_actual).toLocaleString()} L</p>
          </div>
        ))}
      </div>

      <div className="card mb-6 p-4">
        <div className="mb-4 flex gap-2">
          <button
            className={tipoMovimiento === "salida" ? "btn-primary" : "btn-secondary"}
            onClick={() => setTipoMovimiento("salida")}
          >
            Salida (a una unidad)
          </button>
          <button
            className={tipoMovimiento === "entrada" ? "btn-primary" : "btn-secondary"}
            onClick={() => setTipoMovimiento("entrada")}
          >
            Entrada (compra al tanque)
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Combustible</label>
            <select
              className="input"
              value={tipoCombustible}
              onChange={(e) => {
                setTipoCombustible(e.target.value as any);
                setUnidadId("");
              }}
            >
              <option value="diesel">Diésel</option>
              <option value="gasolina">Gasolina</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Fecha</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
            <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
              <option value="">Selecciona...</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">Litros</label>
            <input
              type="number"
              step="any"
              className="input"
              value={litros}
              onChange={(e) => setLitros(e.target.value)}
            />
          </div>

          {tipoMovimiento === "salida" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-campo-600">Unidad</label>
                <select className="input" value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {unidadesFiltradas.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-campo-600">Chofer / Operador</label>
                <BuscadorEmpleado
                  empleados={empleados}
                  valorTexto={choferTexto}
                  onSeleccionar={(empleadoId, texto) => {
                    setChoferTexto(texto);
                    setChoferEmpleadoId(empleadoId);
                  }}
                />
                {choferTexto && !choferEmpleadoId && (
                  <p className="text-[10px] text-red-500">Sin seleccionar de la lista</p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-campo-600">No. Folio</label>
            <input className="input" value={folio} onChange={(e) => setFolio(e.target.value)} />
          </div>
          <div className="sm:col-span-2 md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-campo-600">Observaciones</label>
            <input className="input" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </div>

        <button className="btn-primary mt-4" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-campo-800">Movimientos recientes</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-campo-50 text-left text-xs font-medium text-campo-600">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Combustible</th>
              <th className="px-4 py-2">Campo</th>
              <th className="px-4 py-2">Unidad</th>
              <th className="px-4 py-2">Chofer</th>
              <th className="px-4 py-2">Litros</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-4 text-campo-400" colSpan={8}>Cargando...</td></tr>}
            {!loading && recientes.length === 0 && (
              <tr><td className="px-4 py-4 text-campo-400" colSpan={8}>Todavía no hay movimientos.</td></tr>
            )}
            {recientes.map((m: any) => (
              <tr key={m.id} className="border-t border-campo-50">
                <td className="px-4 py-2 text-campo-800">{m.fecha}</td>
                <td className="px-4 py-2 text-campo-800">
                  <span className={m.tipo === "entrada" ? "text-campo-700" : "text-tierra-600"}>{m.tipo}</span>
                </td>
                <td className="px-4 py-2 text-campo-800 capitalize">{m.tipo_combustible}</td>
                <td className="px-4 py-2 text-campo-800">{m.campos?.nombre}</td>
                <td className="px-4 py-2 text-campo-800">{m.catalogo_unidades?.nombre ?? "—"}</td>
                <td className="px-4 py-2 text-campo-800">
                  {m.empleados ? `${m.empleados.clave} — ${m.empleados.nombre}` : "—"}
                </td>
                <td className="px-4 py-2 text-campo-800">{m.litros} L</td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-danger" onClick={() => eliminarMovimiento(m.id)}>
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
