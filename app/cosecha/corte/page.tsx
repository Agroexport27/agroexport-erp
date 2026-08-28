"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Opcion = { id: string; label: string };
type Calibre = {
  id: string;
  nombre: string;
  cajasPorPallet: number | null;
  cajasPorBin: number | null;
  orden: number;
};

type Renglon = {
  key: string;
  cuadroId: string;
  pallets: Record<string, string>; // calibreId -> texto
  bins: Record<string, string>; // calibreId -> texto
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function nuevoRenglon(): Renglon {
  return { key: uid(), cuadroId: "", pallets: {}, bins: {} };
}

export default function CorteDiarioPage() {
  const supabase = createClient();

  const [campos, setCampos] = useState<Opcion[]>([]);
  const [campoId, setCampoId] = useState("");
  const [cultivos, setCultivos] = useState<Opcion[]>([]);
  const [cultivoId, setCultivoId] = useState("");
  const [cuadros, setCuadros] = useState<Opcion[]>([]);
  const [distribuidores, setDistribuidores] = useState<Opcion[]>([]);
  const [calibres, setCalibres] = useState<Calibre[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({}); // distribuidorId -> calibreId -> cajasPorPallet

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [clasificacion, setClasificacion] = useState<"Convencional" | "Orgánico">("Convencional");
  const [renglonesPorDist, setRenglonesPorDist] = useState<Record<string, Renglon[]>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("campos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setCampos((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));

    supabase
      .from("cultivos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => {
        const opciones = (data ?? [])
          .filter((c: any) => c.nombre !== "Solarizado")
          .map((c: any) => ({ id: c.id, label: c.nombre }));
        setCultivos(opciones);
        const mini = opciones.find((c: any) => c.label.toLowerCase().includes("sandía mini") || c.label.toLowerCase().includes("sandia mini"));
        if (mini) setCultivoId(mini.id);
      });

    supabase
      .from("distribuidores")
      .select("id, nombre")
      .eq("activo", true)
      .order("orden", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        const opciones = (data ?? []).map((d: any) => ({ id: d.id, label: d.nombre }));
        // Nacional siempre al final, sin importar su numero de orden
        const sinNacional = opciones.filter((o: any) => o.label !== "Nacional");
        const nacional = opciones.filter((o: any) => o.label === "Nacional");
        setDistribuidores([...sinNacional, ...nacional]);
      });

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

  useEffect(() => {
    if (!campoId) return;
    supabase
      .from("cuadros")
      .select("id, nombre, orden")
      .eq("campo_id", campoId)
      .order("orden")
      .then(({ data }) => setCuadros((data ?? []).map((c: any) => ({ id: c.id, label: c.nombre }))));
  }, [campoId]);

  useEffect(() => {
    if (!cultivoId) return;
    const nombreCultivoActual = cultivos.find((c) => c.id === cultivoId)?.label?.toLowerCase() ?? "";
    const esVarianteSandiaMini =
      nombreCultivoActual.includes("sandía mini") || nombreCultivoActual.includes("sandia mini");

    // Sandia Mini Amarilla usa exactamente el mismo catalogo de
    // calibres que Sandia Mini -- si es cualquier variante, jala los
    // calibres de "Sandía Mini" (la base), no los de su propio cultivo.
    const cargarCalibresDe = async () => {
      let cultivoIdParaCalibres = cultivoId;
      if (esVarianteSandiaMini) {
        const { data: base } = await supabase
          .from("cultivos")
          .select("id")
          .eq("nombre", "Sandía Mini")
          .maybeSingle();
        if (base) cultivoIdParaCalibres = base.id;
      }
      const { data } = await supabase
        .from("calibres")
        .select("id, nombre, cajas_por_pallet, cajas_por_bin, orden")
        .eq("cultivo_id", cultivoIdParaCalibres)
        .order("orden");
      setCalibres(
        (data ?? []).map((c: any) => ({
          id: c.id,
          nombre: c.nombre,
          cajasPorPallet: c.cajas_por_pallet != null ? Number(c.cajas_por_pallet) : null,
          cajasPorBin: c.cajas_por_bin != null ? Number(c.cajas_por_bin) : null,
          orden: c.orden ?? 999,
        }))
      );
    };
    cargarCalibresDe();
  }, [cultivoId]);

  useEffect(() => {
    // arranca cada distribuidor con un renglon vacio
    const inicial: Record<string, Renglon[]> = {};
    for (const d of distribuidores) inicial[d.id] = [nuevoRenglon()];
    setRenglonesPorDist(inicial);
  }, [distribuidores]);

  const calibresCaja = useMemo(() => calibres.filter((c) => c.cajasPorPallet != null), [calibres]);
  const calibresBin = useMemo(() => calibres.filter((c) => c.cajasPorBin != null), [calibres]);

  function cajasPorPalletEfectivo(distribuidorId: string, calibreId: string): number {
    return overrides[distribuidorId]?.[calibreId] ?? calibres.find((c) => c.id === calibreId)?.cajasPorPallet ?? 0;
  }

  function agregarRenglon(distId: string) {
    setRenglonesPorDist((prev) => ({ ...prev, [distId]: [...(prev[distId] ?? []), nuevoRenglon()] }));
  }

  function quitarRenglon(distId: string, key: string) {
    setRenglonesPorDist((prev) => ({
      ...prev,
      [distId]: (prev[distId] ?? []).filter((r) => r.key !== key),
    }));
  }

  function actualizarRenglon(distId: string, key: string, cambios: Partial<Renglon>) {
    setRenglonesPorDist((prev) => ({
      ...prev,
      [distId]: (prev[distId] ?? []).map((r) => (r.key === key ? { ...r, ...cambios } : r)),
    }));
  }

  // Totales por calibre (cajas), sumando todos los distribuidores/renglones
  const totalesPorCalibre = useMemo(() => {
    const totalesPallet: Record<string, number> = {};
    const totalesBin: Record<string, number> = {};
    for (const distId of Object.keys(renglonesPorDist)) {
      for (const r of renglonesPorDist[distId]) {
        for (const c of calibresCaja) {
          const pallets = parseFloat(r.pallets[c.id] || "0") || 0;
          if (pallets > 0) {
            const cajas = pallets * cajasPorPalletEfectivo(distId, c.id);
            totalesPallet[c.id] = (totalesPallet[c.id] ?? 0) + cajas;
          }
        }
        for (const c of calibresBin) {
          const bins = parseFloat(r.bins[c.id] || "0") || 0;
          if (bins > 0) {
            const cajas = bins * (c.cajasPorBin ?? 0);
            totalesBin[c.id] = (totalesBin[c.id] ?? 0) + cajas;
          }
        }
      }
    }
    return { totalesPallet, totalesBin };
  }, [renglonesPorDist, calibresCaja, calibresBin, overrides, calibres]);

  const granTotalCajas =
    Object.values(totalesPorCalibre.totalesPallet).reduce((s, v) => s + v, 0) +
    Object.values(totalesPorCalibre.totalesBin).reduce((s, v) => s + v, 0);

  async function guardar() {
    if (!campoId || !cultivoId) {
      setError("Selecciona campo y cultivo.");
      return;
    }
    setGuardando(true);
    setError(null);

    const filas: any[] = [];
    for (const distId of Object.keys(renglonesPorDist)) {
      for (const r of renglonesPorDist[distId]) {
        if (!r.cuadroId) continue;
        for (const c of calibresCaja) {
          const pallets = parseFloat(r.pallets[c.id] || "0") || 0;
          if (pallets <= 0) continue;
          const rate = cajasPorPalletEfectivo(distId, c.id);
          filas.push({
            fecha,
            campo_id: campoId,
            cuadro_id: r.cuadroId,
            cultivo_id: cultivoId,
            distribuidor_id: distId,
            calibre_id: c.id,
            tipo_unidad: "pallet",
            cantidad_unidades: pallets,
            cajas: pallets * rate,
          });
        }
        for (const c of calibresBin) {
          const bins = parseFloat(r.bins[c.id] || "0") || 0;
          if (bins <= 0) continue;
          filas.push({
            fecha,
            campo_id: campoId,
            cuadro_id: r.cuadroId,
            cultivo_id: cultivoId,
            distribuidor_id: distId,
            calibre_id: c.id,
            tipo_unidad: "bins",
            cantidad_unidades: bins,
            cajas: bins * (c.cajasPorBin ?? 0),
          });
        }
      }
    }

    if (filas.length === 0) {
      setError("No hay ninguna cantidad capturada todavía (o falta elegir el cuadro en algún renglón).");
      setGuardando(false);
      return;
    }

    const { error } = await supabase.from("corte_diario").insert(filas);
    if (error) {
      setGuardando(false);
      setError(error.message);
      return;
    }

    // Descuenta material de empaque automatico, segun la receta de cada
    // distribuidor + calibre. Amarilla siempre se trata como su propia
    // clasificacion; para los demas cultivos se usa lo que elegiste
    // arriba (Convencional/Orgánico).
    const nombreCultivoActual = cultivos.find((c) => c.id === cultivoId)?.label ?? "";
    const clasificacionEfectiva = nombreCultivoActual.toLowerCase().includes("amarilla")
      ? "Amarilla"
      : clasificacion;

    const filasConMaterial = filas; // tanto pallet como bins pueden tener receta
    if (filasConMaterial.length > 0) {
      const { data: tiposEmpaque } = await supabase
        .from("tipo_empaque")
        .select("id, distribuidor_id, calibre_id, receta_empaque(material_id, cantidad_por_caja)")
        .eq("clasificacion", clasificacionEfectiva);

      const consumoPorMaterial: Record<string, number> = {};
      let algunoSinReceta = false;
      for (const f of filasConMaterial) {
        const tipo = (tiposEmpaque ?? []).find(
          (t: any) => t.distribuidor_id === f.distribuidor_id && t.calibre_id === f.calibre_id
        );
        if (!tipo) {
          algunoSinReceta = true;
          continue;
        }
        for (const r of (tipo as any).receta_empaque ?? []) {
          consumoPorMaterial[r.material_id] =
            (consumoPorMaterial[r.material_id] ?? 0) + r.cantidad_por_caja * f.cajas;
        }
      }

      const movimientos = Object.entries(consumoPorMaterial).map(([materialId, cantidad]) => ({
        material_id: materialId,
        campo_id: campoId,
        fecha,
        tipo: "salida",
        cantidad,
        observaciones: "Consumo automático por Corte diario",
        origen_tipo: "corte_diario",
      }));
      if (movimientos.length > 0) {
        await supabase.from("movimiento_material_empaque").insert(movimientos);
      }
      if (algunoSinReceta) {
        setError(
          "El corte se guardó, pero algún calibre/distribuidor no tiene receta de materiales todavía — revísalo en Materiales."
        );
      }
    }

    setGuardando(false);
    setMensajeExito(`Corte guardado: ${filas.length} renglón(es), ${granTotalCajas.toFixed(0)} cajas en total.`);
    const inicial: Record<string, Renglon[]> = {};
    for (const d of distribuidores) inicial[d.id] = [nuevoRenglon()];
    setRenglonesPorDist(inicial);
    setClasificacion("Convencional");
    setTimeout(() => setMensajeExito(null), 6000);
  }

  const cultivoActual = cultivos.find((c) => c.id === cultivoId);
  const esCultivoSoportado = calibres.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">Corte diario</h1>
      <p className="mb-6 text-sm text-campo-600">
        Cajas empacadas por calibre y distribuidor — normalmente en pallets completos, pero se puede
        ajustar si algún pallet se manda parcial.
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

      <div className="card mb-6 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 md:grid-cols-4">
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
          <label className="mb-1 block text-xs font-medium text-campo-600">Cultivo</label>
          <select className="input" value={cultivoId} onChange={(e) => setCultivoId(e.target.value)}>
            <option value="">Selecciona...</option>
            {cultivos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-campo-600">Empaque</label>
          <select className="input" value={clasificacion} onChange={(e) => setClasificacion(e.target.value as any)}>
            <option value="Convencional">Convencional</option>
            <option value="Orgánico">Orgánico</option>
          </select>
        </div>
        <div className="flex items-end">
          <div className="text-sm text-campo-700">
            <span className="text-xs text-campo-500">Total del día:</span>{" "}
            <span className="font-semibold">{granTotalCajas.toFixed(0)} cajas</span>
          </div>
        </div>
      </div>

      {cultivoId && !esCultivoSoportado && (
        <div className="mb-6 rounded-md border border-tierra-200 bg-tierra-50 px-4 py-3 text-sm text-tierra-700">
          El formato de corte para <strong>{cultivoActual?.label}</strong> todavía no está listo — por ahora
          solo Sandía Mini. En cuanto me pases su formato, lo agrego igual.
        </div>
      )}

      {esCultivoSoportado && campoId && (
        <>
          {distribuidores.map((dist) => {
            const renglones = renglonesPorDist[dist.id] ?? [];
            return (
              <details key={dist.id} className="card mb-3 overflow-visible" open>
                <summary className="flex cursor-pointer list-none items-center justify-between bg-campo-50 px-4 py-2">
                  <span className="text-sm font-semibold text-campo-800">{dist.label}</span>
                </summary>
                <div className="overflow-x-auto p-3">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="text-left text-xs font-medium text-campo-600">
                      <tr>
                        <th className="px-2 py-1">Cuadro</th>
                        {calibresCaja.map((c) => (
                          <th key={c.id} className="px-1 py-1 text-center">
                            {c.nombre}
                            <div className="text-[9px] font-normal text-campo-400">
                              {cajasPorPalletEfectivo(dist.id, c.id)}/pallet
                            </div>
                          </th>
                        ))}
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {renglones.map((r) => (
                        <tr key={r.key} className="border-t border-campo-50">
                          <td className="px-2 py-1">
                            <select
                              className="input w-24"
                              value={r.cuadroId}
                              onChange={(e) => actualizarRenglon(dist.id, r.key, { cuadroId: e.target.value })}
                            >
                              <option value="">Cuadro...</option>
                              {cuadros.map((cu) => (
                                <option key={cu.id} value={cu.id}>{cu.label}</option>
                              ))}
                            </select>
                          </td>
                          {calibresCaja.map((c) => (
                            <td key={c.id} className="px-1 py-1">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                className="input w-16 text-center"
                                value={r.pallets[c.id] ?? ""}
                                onChange={(e) =>
                                  actualizarRenglon(dist.id, r.key, {
                                    pallets: { ...r.pallets, [c.id]: e.target.value },
                                  })
                                }
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1">
                            <button
                              className="text-red-500 hover:text-red-700"
                              onClick={() => quitarRenglon(dist.id, r.key)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-campo-100 bg-campo-50 text-xs font-medium">
                        <td className="px-2 py-1 text-campo-700">Total cajas</td>
                        {calibresCaja.map((c) => {
                          const totalRenglones = renglones.reduce((s, r) => {
                            const pallets = parseFloat(r.pallets[c.id] || "0") || 0;
                            return s + pallets * cajasPorPalletEfectivo(dist.id, c.id);
                          }, 0);
                          return (
                            <td key={c.id} className="px-1 py-1 text-center text-campo-700">
                              {totalRenglones > 0 ? totalRenglones.toFixed(0) : "—"}
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  <button className="btn-secondary mt-2 text-xs" onClick={() => agregarRenglon(dist.id)}>
                    + Agregar cuadro
                  </button>

                  {calibresBin.length > 0 && (
                    <>
                      <p className="mb-1 mt-4 text-xs font-medium text-campo-600">Bins (equivalente en cajas)</p>
                      <table className="w-full min-w-[500px] text-sm">
                        <thead className="text-left text-xs font-medium text-campo-600">
                          <tr>
                            <th className="px-2 py-1">Cuadro</th>
                            {calibresBin.map((c) => (
                              <th key={c.id} className="px-1 py-1 text-center">
                                {c.nombre}
                                <div className="text-[9px] font-normal text-campo-400">{c.cajasPorBin}/bin</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {renglones.map((r) => (
                            <tr key={r.key} className="border-t border-campo-50">
                              <td className="px-2 py-1 text-campo-600">
                                {cuadros.find((cu) => cu.id === r.cuadroId)?.label ?? "—"}
                              </td>
                              {calibresBin.map((c) => (
                                <td key={c.id} className="px-1 py-1">
                                  <input
                                    type="number"
                                    step="any"
                                    min={0}
                                    className="input w-16 text-center"
                                    value={r.bins[c.id] ?? ""}
                                    onChange={(e) =>
                                      actualizarRenglon(dist.id, r.key, {
                                        bins: { ...r.bins, [c.id]: e.target.value },
                                      })
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </details>
            );
          })}

          <button className="btn-primary mt-4" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar corte del día"}
          </button>
        </>
      )}
    </div>
  );
}
