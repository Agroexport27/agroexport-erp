// Trae los cuadros de todos los campos, en orden numerico (mallas al
// final), y los restringe a los que YA estan definidos en el Programa
// (ciclos "2026-2" y "2027-1", que incluye el solarizado). Si un campo
// todavia no tiene Programa cargado, se le muestran TODOS sus cuadros
// como respaldo (para no dejarlo sin poder trabajar).
export async function obtenerCuadrosPermitidos(supabase: any) {
  const [{ data: cua }, { data: ciclosActivos }] = await Promise.all([
    supabase
      .from("cuadros")
      .select("id, nombre, hectareas, campo_id, cultivo_id, orden, campos(nombre)")
      .order("campo_id")
      .order("orden"),
    supabase.from("ciclos").select("id").in("clave", ["2026-2", "2027-1"]),
  ]);

  const idsCiclosActivos = (ciclosActivos ?? []).map((c: any) => c.id);
  let cuadroIdsProgramados = new Set<string>();
  if (idsCiclosActivos.length > 0) {
    const { data: programa } = await supabase
      .from("cuadro_ciclo")
      .select("cuadro_id")
      .in("ciclo_id", idsCiclosActivos);
    cuadroIdsProgramados = new Set((programa ?? []).map((p: any) => p.cuadro_id));
  }

  const todos = ((cua ?? []) as any[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    hectareas: Number(c.hectareas ?? 0),
    campoId: c.campo_id,
    campoNombre: c.campos?.nombre ?? "Sin campo",
    cultivoId: c.cultivo_id as string | null,
    orden: c.orden ?? 9999,
  }));

  // Por campo: si tiene AL MENOS un cuadro programado, se filtra a solo
  // esos; si no tiene ninguno, se dejan todos (respaldo).
  const campoTieneProgramado = new Set<string>();
  for (const c of todos) {
    if (cuadroIdsProgramados.has(c.id)) campoTieneProgramado.add(c.campoId);
  }

  return todos.filter(
    (c) => !campoTieneProgramado.has(c.campoId) || cuadroIdsProgramados.has(c.id)
  );
}
