import * as XLSX from "xlsx";

type Fila = { nombre: string; litros: number };

export function generarExcelReporteCombustible({
  rango,
  porCampo,
  porUnidad,
  porChofer,
}: {
  rango: string;
  porCampo: Fila[];
  porUnidad: Fila[];
  porChofer: Fila[];
}) {
  const libro = XLSX.utils.book_new();

  const hojaCampo = XLSX.utils.json_to_sheet(porCampo.map((f) => ({ Campo: f.nombre, Litros: f.litros })));
  XLSX.utils.book_append_sheet(libro, hojaCampo, "Por campo");

  const hojaUnidad = XLSX.utils.json_to_sheet(porUnidad.map((f) => ({ Unidad: f.nombre, Litros: f.litros })));
  XLSX.utils.book_append_sheet(libro, hojaUnidad, "Por unidad");

  const hojaChofer = XLSX.utils.json_to_sheet(porChofer.map((f) => ({ Chofer: f.nombre, Litros: f.litros })));
  XLSX.utils.book_append_sheet(libro, hojaChofer, "Por chofer");

  XLSX.writeFile(libro, `reporte_combustible_${rango}.xlsx`);
}
