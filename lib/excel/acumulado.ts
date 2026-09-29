import * as XLSX from "xlsx";

export function generarExcelAcumulado({
  consolidadoDiario,
  detallePorCuadro,
  resumenVariedad,
  resumenPorDistribuidor,
  resumenPorCuadro,
  campoDetalleNombre,
  esPepino,
  esConTamano,
}: {
  consolidadoDiario: any;
  detallePorCuadro: any;
  resumenVariedad: any;
  resumenPorDistribuidor?: any[];
  resumenPorCuadro?: any[];
  campoDetalleNombre: string;
  esPepino?: boolean;
  esConTamano?: boolean;
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
    if (esConTamano) {
      for (const pt of v.porcentajesTamano ?? []) {
        fila[`%${pt.tamano}`] = Number(pt.porcentaje.toFixed(1));
      }
    }
    if (esPepino) {
      for (const pe of v.porcentajesEmpaque ?? []) {
        fila[`%${pe.calibre}`] = Number(pe.porcentaje.toFixed(1));
      }
      fila["Cajas 36s equiv."] = Number((v.cajas36s ?? 0).toFixed(1));
    }
    return fila;
  });
  const filaTotal: any = {
    Variedad: "TOTAL",
    ...Object.fromEntries(resumenVariedad.calibresOrden.map((c: string) => [c, resumenVariedad.totalesPorCalibre[c] || 0])),
    Total: resumenVariedad.granTotal,
  };
  if (esConTamano) {
    for (const pt of resumenVariedad.porcentajesTamano ?? []) {
      filaTotal[`%${pt.tamano}`] = Number(pt.porcentaje.toFixed(1));
    }
  }
  if (esPepino) {
    for (const pe of resumenVariedad.porcentajesEmpaque ?? []) {
      filaTotal[`%${pe.calibre}`] = Number(pe.porcentaje.toFixed(1));
    }
    filaTotal["Cajas 36s equiv."] = Number((resumenVariedad.granTotal36s ?? 0).toFixed(1));
    filaTotal["Cajas 36s/ha"] =
      resumenVariedad.granTotal36sPorHa != null ? Number(resumenVariedad.granTotal36sPorHa.toFixed(1)) : "";
  }
  filasResumen.push(filaTotal);
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasResumen), "% Resumen");

  // Hoja 4: % por distribuidor
  if (resumenPorDistribuidor && resumenPorDistribuidor.length > 0) {
    const filasDist = resumenPorDistribuidor.map((d: any) => {
      const fila: any = { Distribuidor: d.distribuidor, "Total cajas": d.granTotal };
      if (esConTamano) {
        for (const pt of d.porcentajesTamano ?? []) {
          fila[`%${pt.tamano}`] = Number(pt.porcentaje.toFixed(1));
        }
      }
      if (esPepino) {
        for (const pe of d.porcentajesEmpaque ?? []) {
          fila[`%${pe.calibre}`] = Number(pe.porcentaje.toFixed(1));
        }
        fila["Cajas 36s equiv."] = Number((d.cajas36s ?? 0).toFixed(1));
      }
      return fila;
    });
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasDist), "% por distribuidor");
  }

  // Hoja 5: % por cuadro
  if (resumenPorCuadro && resumenPorCuadro.length > 0) {
    const filasCuadro = resumenPorCuadro.map((c: any) => {
      const fila: any = { Campo: c.campo, Cuadro: c.nombre, "Total cajas": c.granTotal };
      if (esConTamano) {
        for (const pt of c.porcentajesTamano ?? []) {
          fila[`%${pt.tamano}`] = Number(pt.porcentaje.toFixed(1));
        }
      }
      if (esPepino) {
        for (const pe of c.porcentajesEmpaque ?? []) {
          fila[`%${pe.calibre}`] = Number(pe.porcentaje.toFixed(1));
        }
        fila["Cajas 36s equiv."] = Number((c.cajas36s ?? 0).toFixed(1));
        fila["Cajas 36s/ha"] = c.cajas36sPorHa != null ? Number(c.cajas36sPorHa.toFixed(1)) : "";
      }
      return fila;
    });
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasCuadro), "% por cuadro");
  }

  XLSX.writeFile(libro, `acumulado_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
