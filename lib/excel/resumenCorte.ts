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

// Los calibres de venta se agrupan en 4 tamaños base para el % de
// tamaño: M9 cuenta como 9; 8 COS y FT 8C cuentan como 8; 6J, 6JXL,
// 4D Cos y 4D cuentan como 6. "Otras" no entra en el % de tamaño.
const TAMANOS_BASE = ["6", "8", "9", "11"];
function tamanoDeCalibre(nombreCalibre: string): string | null {
  const n = nombreCalibre.trim().toUpperCase();
  if (n === "M 9" || n === "M9") return "9";
  if (n === "8 COS" || n === "FT 8C") return "8";
  if (n === "6 J" || n === "6 JXL" || n === "4D COS" || n === "4 D") return "6";
  if (TAMANOS_BASE.includes(n)) return n;
  return null;
}

function construirResumenTamanos(filas: FilaCorteDetalle[]) {
  const cajasPorTamano: Record<string, number> = {};
  let totalConTamano = 0;
  for (const f of filas) {
    if (f.tipoUnidad !== "pallet") continue;
    const tamano = tamanoDeCalibre(f.calibreNombre);
    if (!tamano) continue;
    cajasPorTamano[tamano] = (cajasPorTamano[tamano] ?? 0) + f.cajas;
    totalConTamano += f.cajas;
  }
  return TAMANOS_BASE.map((t) => ({
    tamano: t,
    cajas: cajasPorTamano[t] ?? 0,
    porcentaje: totalConTamano > 0 ? ((cajasPorTamano[t] ?? 0) / totalConTamano) * 100 : 0,
  }));
}


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

  const resumenTamanos = construirResumenTamanos(filas);
  filasHoja.push([]);
  filasHoja.push(["% POR TAMAÑO"]);
  filasHoja.push(["Tamaño", "Cajas", "%"]);
  for (const t of resumenTamanos) {
    filasHoja.push([t.tamano, t.cajas || "", `${t.porcentaje.toFixed(1)}%`]);
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
