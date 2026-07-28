import * as XLSX from "xlsx";

export type FilaCensoResumen = {
  fecha: string;
  campo: string;
  folio: string;
  totalPersonas: number;
};

export function generarExcelCensos(filas: FilaCensoResumen[], rango: string) {
  const datos = filas.map((f) => ({
    Fecha: f.fecha,
    Campo: f.campo,
    Folio: f.folio,
    "Total personas": f.totalPersonas,
  }));
  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Censos");
  XLSX.writeFile(libro, `censos_${rango}.xlsx`);
}
