import * as XLSX from "xlsx";

export type FilaCorteDetalle = {
  cuadro: string;
  distribuidor: string;
  calibreId: string;
  calibreNombre: string;
  tipoUnidad: "pallet" | "bins";
  unidades: number;
  cajas: number;
};

export type CalibreCol = { id: string; nombre: string; orden: number };

function construirHojaDistribuidor(
  distribuidor: string,
  filas: FilaCorteDetalle[],
  calibresCaja: CalibreCol[],
  calibresBin: CalibreCol[]
) {
  const cuadros = Array.from(new Set(filas.map((f) => f.cuadro))).sort();

  const encabezado1 = ["CUADRO", ...calibresCaja.flatMap((c) => [c.nombre, ""])];
  const encabezado2 = ["", ...calibresCaja.flatMap(() => ["PALLET", "CAJA"])];

  const filasHoja: any[][] = [encabezado1, encabezado2];

  for (const cuadro of cuadros) {
    const fila: any[] = [cuadro];
    for (const c of calibresCaja) {
      const f = filas.find((x) => x.cuadro === cuadro && x.calibreId === c.id && x.tipoUnidad === "pallet");
      fila.push(f ? f.unidades : "");
      fila.push(f ? f.cajas : "");
    }
    filasHoja.push(fila);
  }

  const totalRow: any[] = ["TOTAL CAJAS"];
  for (const c of calibresCaja) {
    const total = filas
      .filter((f) => f.calibreId === c.id && f.tipoUnidad === "pallet")
      .reduce((s, f) => s + f.cajas, 0);
    totalRow.push("");
    totalRow.push(total || "");
  }
  filasHoja.push(totalRow);

  if (calibresBin.length > 0) {
    filasHoja.push([]);
    filasHoja.push(["BINS", ...calibresBin.flatMap((c) => [c.nombre, ""])]);
    filasHoja.push(["", ...calibresBin.flatMap(() => ["BINS", "CAJA"])]);
    for (const cuadro of cuadros) {
      const filaBin: any[] = [cuadro];
      let hayDato = false;
      for (const c of calibresBin) {
        const f = filas.find((x) => x.cuadro === cuadro && x.calibreId === c.id && x.tipoUnidad === "bins");
        if (f) hayDato = true;
        filaBin.push(f ? f.unidades : "");
        filaBin.push(f ? f.cajas : "");
      }
      if (hayDato) filasHoja.push(filaBin);
    }
  }

  return XLSX.utils.aoa_to_sheet(filasHoja);
}

export function generarExcelResumenCorte({
  fecha,
  campo,
  filas,
  calibresCaja,
  calibresBin,
}: {
  fecha: string;
  campo: string;
  filas: FilaCorteDetalle[];
  calibresCaja: CalibreCol[];
  calibresBin: CalibreCol[];
}) {
  const libro = XLSX.utils.book_new();

  // Hoja resumen general (todos los distribuidores juntos)
  const hojaGeneral = construirHojaDistribuidor("TODOS", filas, calibresCaja, calibresBin);
  XLSX.utils.book_append_sheet(libro, hojaGeneral, "RESUMEN");

  const distribuidores = Array.from(new Set(filas.map((f) => f.distribuidor)));
  for (const dist of distribuidores) {
    const filasDist = filas.filter((f) => f.distribuidor === dist);
    const hoja = construirHojaDistribuidor(dist, filasDist, calibresCaja, calibresBin);
    XLSX.utils.book_append_sheet(libro, hoja, dist.slice(0, 31));
  }

  XLSX.writeFile(libro, `corte_${campo.replace(/\s+/g, "_")}_${fecha}.xlsx`);
}
