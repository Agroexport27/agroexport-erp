import { generarPdfManifiesto } from "@/lib/pdf/manifiesto";

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
      "id, fecha_empaque, manifiesto, caja_transporte, placas, chofer, reg_transporte, tipo_tarima, cantidad_tarimas, campos(nombre), distribuidores(nombre, direccion, ciudad), cultivos(nombre), remision_detalle(cantidad_cajas, calibre_id, calibres(nombre))"
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
    }));

  generarPdfManifiesto({
    serie: serie || "A",
    folio: folio || "00",
    fecha: remision.fecha_empaque,
    campoNombre: remision.campos?.nombre ?? "",
    distribuidor: remision.distribuidores?.nombre ?? "",
    distribuidorDireccion: remision.distribuidores?.direccion ?? "",
    distribuidorCiudad: remision.distribuidores?.ciudad ?? "",
    cajaTransporte: remision.caja_transporte ?? "",
    placas: remision.placas ?? "",
    chofer: remision.chofer ?? "",
    regTransporte: remision.reg_transporte ?? "",
    cultivoNombre: remision.cultivos?.nombre ?? "",
    tipoTarima: remision.tipo_tarima ?? null,
    cantidadTarimas: remision.cantidad_tarimas != null ? Number(remision.cantidad_tarimas) : null,
    lineas,
  });
}
