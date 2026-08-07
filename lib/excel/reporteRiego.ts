import * as XLSX from "xlsx";

export type FilaCuadroRiego = {
  campo: string;
  nombre: string;
  hectareas: number;
  riegos: number;
  horas: number;
  laminaHa: number;
  laminaTotal: number;
};
export type FilaMesRiego = { mes: string; horas: number };

export function generarExcelReporteRiego({
  rango,
  porCuadro,
  porMes,
}: {
  rango: string;
  porCuadro: FilaCuadroRiego[];
  porMes: FilaMesRiego[];
}) {
  const libro = XLSX.utils.book_new();

  const hoja1 = XLSX.utils.json_to_sheet(
    porCuadro.map((c) => ({
      Campo: c.campo,
      Cuadro: c.nombre,
      Hectáreas: c.hectareas,
      "No. riegos": c.riegos,
      "Horas totales": Number(c.horas.toFixed(2)),
      "Lámina/ha (mm)": Number(c.laminaHa.toFixed(2)),
      "Lámina/ha promedio por riego": c.riegos > 0 ? Number((c.laminaHa / c.riegos).toFixed(2)) : "",
      "Lámina total (mm x ha)": Number(c.laminaTotal.toFixed(2)),
    }))
  );
  XLSX.utils.book_append_sheet(libro, hoja1, "Por cuadro");

  const hoja2 = XLSX.utils.json_to_sheet(
    porMes.map((m) => ({ Mes: m.mes, "Horas de riego": Number(m.horas.toFixed(2)) }))
  );
  XLSX.utils.book_append_sheet(libro, hoja2, "Por mes");

  XLSX.writeFile(libro, `reporte_riego_${rango}.xlsx`);
}
