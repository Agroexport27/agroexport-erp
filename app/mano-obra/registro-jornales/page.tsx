"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { id: string; label: string };

type CuadroCol = {
  cuadroId: string;
  cuadroNombre: string;
  hectareas: number;
  variedad: string;
  orden: number;
};

function lunesDeLaSemana(fechaISO: string): string {
  const d = new Date(fechaISO + "T00:00:00");
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function RegistroJornalesPage() {
  const supabase = createClient();

  const [ciclos, setCiclos] = useState<{ id: string; clave: string }[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [campos, setCampos] = useState<Opcion[]>([]);
  const [campoId, setCampoId] = useState("");
  const [actividadesOpciones, setActividadesOpciones] = useState<Opcion[]>([]);
  const [actividadId, setActividadId] = useState("");
  const [semanaInicio, setSemanaInicio] = useState(lunesDeLaSemana(new Date().toISOString().slice(0, 10)));

  const [cuadros, setCuadros] = useState<CuadroCol[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({}); // key: cuadroId__fecha
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("ciclos")
      .select("id, clave")
      .order("clave", { ascending: false })
      .then(({ data }) => {
        setCiclos(data ?? []);
        if (data && data.length > 0) setCicloId(data[0].id);
      });
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }));
        setCampos(opciones);
        if (opciones.length > 0) setCampoId(opciones[0].id);
      });
    supabase
      .from("actividades")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? []).map((a: any) => ({ id: a.id, label: a.nombre }));
        setActividadesOpciones(opciones);
        const deshierbe = opciones.find((a: any) => a.label.toUpperCase().includes("DESHIERBE"));
        if (deshierbe) setActividadId(deshierbe.id);
      });
  }, []);

  const diasDeLaSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => sumarDias(semanaInicio, i)),
    [semanaInicio]
  );

  async function cargarCuadros() {
    if (!cicloId || !campoId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("cuadro_ciclo")
      .select("hectareas, cuadros(id, nombre, campo_id, orden), variedades(nombre)")
      .eq("ciclo_id", cicloId);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const filas = (data ?? [])
      .filter((r: any) => r.cuadros?.campo_id === campoId)
      .map((r: any) => ({
        cuadroId: r.cuadros?.id,
        cuadroNombre: r.cuadros?.nombre ?? "",
        hectareas: Number(r.hectareas ?? 0),
        variedad: r.variedades?.nombre ?? "",
        orden: r.cuadros?.orden ?? 9999,
      }))
      .sort((a: any, b: any) => a.orden - b.orden);
    setCuadros(filas);
    setLoading(false);
  }

  async function cargarValoresExistentes() {
    if (!actividadId || cuadros.length === 0) return;
    const semanaFin = sumarDias(semanaInicio, 6);
    const { data } = await supabase
      .from("mano_obra_jornales")
      .select("cuadro_id, fecha, jornales")
      .eq("actividad_id", actividadId)
      .gte("fecha", semanaInicio)
      .lte("fecha", semanaFin);
    const nuevos: Record<string, string> = {};
    for (const r of (data ?? []) as any[]) {
      nuevos[`${r.cuadro_id}__${r.fecha}`] = String(r.jornales);
    }
    setValores(nuevos);
  }

  useEffect(() => {
    cargarCuadros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId, campoId]);

  useEffect(() => {
    cargarValoresExistentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaInicio, actividadId, cuadros]);

  function actualizarCelda(cuadroId: string, fecha: string, valor: string) {
    setValores((prev) => ({ ...prev, [`${cuadroId}__${fecha}`]: valor }));
  }

  async function guardar() {
    if (!actividadId) {
      setError("Selecciona una actividad.");
      return;
    }
    setGuardando(true);
    setError(null);

    const filas: any[] = [];
    for (const cuadro of cuadros) {
      for (const fecha of diasDeLaSemana) {
        const key = `${cuadro.cuadroId}__${fecha}`;
        const valor = valores[key];
        if (valor === undefined || valor === "") continue;
        const jornales = parseInt(valor, 10);
        if (isNaN(jornales)) continue;
        filas.push({
          cuadro_id: cuadro.cuadroId,
          actividad_id: actividadId,
          fecha,
          jornales,
        });
      }
    }

    if (filas.length === 0) {
      setError("No hay ningún número capturado todavía.");
      setGuardando(false);
      return;
    }

    const { error } = await supabase
      .from("mano_obra_jornales")
      .upsert(filas, { onConflict: "cuadro_id,actividad_id,fecha" });

    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMensajeExito(`Guardado: ${filas.length} celda(s).`);
    setTimeout(() => setMensajeExito(null), 4000);
  }

  const totalPorDia = diasDeLaSemana.map((fecha) =>
    cuadros.reduce((s, c) => s + (parseInt(valores[`${c.cuadroId}__${fecha}`] || "0", 10) || 0), 0)
  );
  const totalPorCuadro = cuadros.map((c) =>
    diasDeLaSemana.reduce((s, fecha) => s + (parseInt(valores[`${c.cuadroId}__${fecha}`] || "0", 10) || 0), 0)
  );
  const totalSemana = totalPorDia.reduce((s, t) => s + t, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Registro real de jornales</h1>
      <p className="mb-6 text-sm text-campo-600">
        Cuántas personas entraron a cada cuadro cada día — solo el número, sin nombres ni dinero.
        Se compara contra el Plan semanal automáticamente.
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

      <div className="card mb-4 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Ciclo</label>
          <select className="input" value={cicloId} onChange={(e) => setCicloId(e.target.value)}>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.clave}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Campo</label>
          <select className="input" value={campoId} onChange={(e) => setCampoId(e.target.value)}>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Actividad</label>
          <select className="input" value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
            {actividadesOpciones.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Semana (lunes)</label>
          <input
            type="date"
            className="input"
            value={semanaInicio}
            onChange={(e) => setSemanaInicio(lunesDeLaSemana(e.target.value))}
          />
        </div>
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando cuadros...</p>}
      {!loading && cuadros.length === 0 && (
        <p className="text-sm text-campo-400">
          Este campo no tiene cuadros en el Programa de este ciclo. Cárgalo primero en Planeación → Programa.
        </p>
      )}

      {cuadros.length > 0 && (
        <div className="card mb-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-campo-50 text-xs font-medium text-campo-600">
              <tr>
                <th className="sticky left-0 bg-campo-50 px-3 py-2 text-left">Día</th>
                {cuadros.map((c) => (
                  <th key={c.cuadroId} className="px-2 py-1 text-center">
                    {c.cuadroNombre}
                  </th>
                ))}
                <th className="px-3 py-2 text-center">Total</th>
              </tr>
              <tr className="text-[10px] font-normal text-campo-400">
                <td className="sticky left-0 bg-campo-50 px-3 py-1">Has / Variedad</td>
                {cuadros.map((c) => (
                  <td key={c.cuadroId} className="px-2 py-1 text-center">
                    {c.hectareas} ha
                    <br />
                    {c.variedad}
                  </td>
                ))}
                <td />
              </tr>
            </thead>
            <tbody>
              {diasDeLaSemana.map((fecha, i) => (
                <tr key={fecha} className="border-t border-campo-50">
                  <td className="sticky left-0 bg-white px-3 py-1 text-xs text-campo-700">
                    {DIAS_SEMANA[i]}
                    <br />
                    <span className="text-[10px] text-campo-400">{fecha}</span>
                  </td>
                  {cuadros.map((c) => (
                    <td key={c.cuadroId} className="px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        className="input w-16 text-center"
                        value={valores[`${c.cuadroId}__${fecha}`] ?? ""}
                        onChange={(e) => actualizarCelda(c.cuadroId, fecha, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1 text-center font-medium text-campo-800">
                    {totalPorDia[i] || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-campo-100 bg-campo-50 font-medium">
                <td className="sticky left-0 bg-campo-50 px-3 py-2 text-xs text-campo-700">Total cuadro</td>
                {totalPorCuadro.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-center text-campo-800">{t || "—"}</td>
                ))}
                <td className="px-3 py-2 text-center text-campo-900">{totalSemana}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {cuadros.length > 0 && (
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar semana"}
        </button>
      )}
    </div>
  );
}
