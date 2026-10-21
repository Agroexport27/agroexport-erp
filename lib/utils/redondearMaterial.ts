// Consumo de material de empaque: todo se descuenta en piezas enteras
// (redondeado), excepto el FLEJE, que sí lleva decimales.
export async function redondearConsumoMaterial(
  supabase: any,
  consumo: Record<string, number>
): Promise<Record<string, number>> {
  const ids = Object.keys(consumo);
  if (ids.length === 0) return consumo;
  const { data } = await supabase.from("materiales_empaque").select("id, nombre").in("id", ids);
  const esFleje: Record<string, boolean> = {};
  for (const m of data ?? []) esFleje[m.id] = /fleje/i.test(String(m.nombre ?? ""));
  const resultado: Record<string, number> = {};
  for (const id of ids) {
    resultado[id] = esFleje[id] ? Math.round(consumo[id] * 10000) / 10000 : Math.round(consumo[id]);
  }
  return resultado;
}
