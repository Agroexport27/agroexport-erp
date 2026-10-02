import { generarPdfManifiesto } from "@/lib/pdf/manifiesto";

// Para Dulcinea, el manifiesto no muestra el nombre real del cuadro sino un
// código de "Work Order" que agrupa varios cuadros de un mismo campo.
const WORK_ORDER_DULCINEA: Record<string, string> = {
  C31: "26AGRSO2",
  "1": "26AGRSO1",
  "2": "26AGRSO1",
  "3": "26AGRSO3",
  "4A": "26AGRSO3",
  "4B": "26AGRSO4",
};

function nombreParaManifiesto(cuadroNombre: string, distribuidorNombre: string): string {
  if (!cuadroNombre) return cuadroNombre;
  if (!/dulcinea/i.test(distribuidorNombre)) return cuadroNombre;
  const partes = cuadroNombre
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const traducidas = partes.map((p) => WORK_ORDER_DULCINEA[p.toUpperCase()] ?? p);
  return Array.from(new Set(traducidas)).join(", ");
}

function parseSerieFolio(manifiesto: string | null): { serie: string; folio: string } {
  if (!manifiesto) return { serie: "", folio: "" };
  const m = manifiesto.trim().match(/^([A-Za-z])\s*-?\s*(\d+)$/);
  if (m) return { serie: m[1].toUpperCase(), folio: m[2] };
  return { serie: "", folio: manifiesto };
}

export async function generarManifiestoDeRemision(supabase: any, remisionId: string) {
  const { data: remision, error } = await supabase
    .from("remision_envio")
    .select(
      "id, fecha_empaque, manifiesto, caja_transporte, placas, chofer, tipo_tarima, cantidad_tarimas, tipo_tarima_2, cantidad_tarimas_2, campos(nombre), cuadros(nombre), distribuidores(nombre, direccion, ciudad), cultivos(nombre), remision_detalle(cantidad_cajas, calibre_id, calibres(nombre, cajas_por_pallet)), remision_envio_cuadro(cuadro_id, cuadros(nombre))"
    )
    .eq("id", remisionId)
    .single();

  if (error || !remision) {
    throw new Error(error?.message ?? "No se encontró la remisión.");
  }

  const { serie, folio } = parseSerieFolio(remision.manifiesto);
  const lineas = (remision.remision_detalle ?? [])
    .filter((d: any) => d.calibre_id && Number(d.cantidad_cajas) > 0)
    .map((d: any) => ({
      cajas: Number(d.cantidad_cajas),
      calibreNombre: d.calibres?.nombre ?? "",
      cajasPorPallet: d.calibres?.cajas_por_pallet != null ? Number(d.calibres.cajas_por_pallet) : null,
    }));

  const cuadroNombreReal =
    (remision.remision_envio_cuadro ?? [])
      .map((x: any) => x.cuadros?.nombre)
      .filter(Boolean)
      .join(", ") || remision.cuadros?.nombre || "";
  const cuadroNombre = nombreParaManifiesto(cuadroNombreReal, remision.distribuidores?.nombre ?? "");

  const tarimas = [
    { tipo: remision.tipo_tarima ?? "", cantidad: Number(remision.cantidad_tarimas ?? 0) },
    { tipo: remision.tipo_tarima_2 ?? "", cantidad: Number(remision.cantidad_tarimas_2 ?? 0) },
  ].filter((t) => t.tipo && t.cantidad > 0);

  generarPdfManifiesto({
    serie: serie || "A",
    folio: folio || "00",
    fecha: remision.fecha_empaque,
    campoNombre: remision.campos?.nombre ?? "",
    cuadroNombre,
    distribuidor: remision.distribuidores?.nombre ?? "",
    distribuidorDireccion: remision.distribuidores?.direccion ?? "",
    distribuidorCiudad: remision.distribuidores?.ciudad ?? "",
    cajaTransporte: remision.caja_transporte ?? "",
    placas: remision.placas ?? "",
    chofer: remision.chofer ?? "",
    cultivoNombre: remision.cultivos?.nombre ?? "",
    lineas,
    tarimas,
  });
}
