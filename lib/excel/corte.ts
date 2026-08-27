import * as XLSX from "xlsx";

export type FilaCorte = {
  fecha: string;
  campo: string;
  cuadro: string;
  cultivo: string;
  distribuidor: string;
  calibre: string;
  tipoUnidad: string;
  unidades: number;
  cajas: number;
};

export function generarExcelCorte(filas: FilaCorte[], rango: string) {
  const hoja = XLSX.utils.json_to_sheet(
    filas.map((f) => ({
      Fecha: f.fecha,
      Campo: f.campo,
      Cuadro: f.cuadro,
      Cultivo: f.cultivo,
      Distribuidor: f.distribuidor,
      Calibre: f.calibre,
      Tipo: f.tipoUnidad,
      Unidades: f.unidades,
      Cajas: f.cajas,
    }))
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Corte");
  XLSX.writeFile(libro, `corte_diario_${rango}.xlsx`);
}
