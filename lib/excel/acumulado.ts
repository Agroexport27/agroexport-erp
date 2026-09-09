import * as XLSX from "xlsx";

export function generarExcelAcumulado({
  consolidadoDiario,
  detallePorCuadro,
  resumenVariedad,
  campoDetalleNombre,
}: {
  consolidadoDiario: any;
  detallePorCuadro: any;
  resumenVariedad: any;
  campoDetalleNombre: string;
}) {
  const libro = XLSX.utils.book_new();

  // Hoja 1: Consolidado diario
  const filasConsolidado = consolidadoDiario.filas.map((f: any) => {
    const fila: any = { Fecha: f.fecha };
    for (const c of consolidadoDiario.nombresCampo) fila[c] = f.porCampo[c] || 0;
    fila["Total"] = f.total;
    for (const d of consolidadoDiario.nombresDist) fila[d] = f.porDist[d] || 0;
    fila["Bins"] = f.bins;
    return fila;
  });
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasConsolidado), "Consolidado");

  // Hoja 2: Detalle por cuadro (del campo elegido)
  const encabezado = ["Fecha", ...detallePorCuadro.cuadrosInfo.map((c: any) => c.nombre)];
  const filasDetalle = [encabezado];
  for (const fecha of detallePorCuadro.fechas) {
    const fila = [fecha];
    for (const c of detallePorCuadro.cuadrosInfo) {
      fila.push(detallePorCuadro.porFecha.get(fecha)?.[c.id] ?? "");
    }
    filasDetalle.push(fila);
  }
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet(filasDetalle),
    `Detalle ${campoDetalleNombre}`.slice(0, 31)
  );

  // Hoja 3: % Resumen por variedad
  const filasResumen = resumenVariedad.variedades.map((v: any) => {
    const fila: any = { Variedad: v.variedad };
    for (const c of resumenVariedad.calibresOrden) fila[c] = v.cantidades[c] || 0;
    fila["Total"] = v.total;
    return fila;
  });
  filasResumen.push({
    Variedad: "TOTAL",
    ...Object.fromEntries(resumenVariedad.calibresOrden.map((c: string) => [c, resumenVariedad.totalesPorCalibre[c] || 0])),
    Total: resumenVariedad.granTotal,
  });
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasResumen), "% Resumen");

  XLSX.writeFile(libro, `acumulado_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
