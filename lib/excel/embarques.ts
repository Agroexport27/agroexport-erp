import * as XLSX from "xlsx";

export type FilaEmbarque = {
  fecha: string;
  campo: string;
  cuadro: string;
  distribuidor: string;
  manifiesto: string;
  empaque: string;
  calibre: string;
  cajas: number;
  bins: number;
};

export function generarExcelEmbarques(filas: FilaEmbarque[], rango: string) {
  const hoja = XLSX.utils.json_to_sheet(
    filas.map((f) => ({
      Fecha: f.fecha,
      Campo: f.campo,
      Cuadro: f.cuadro,
      Distribuidor: f.distribuidor,
      Manifiesto: f.manifiesto,
      Empaque: f.empaque,
      Calibre: f.calibre,
      Cajas: f.cajas || "",
      Bins: f.bins || "",
    }))
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Embarques");
  XLSX.writeFile(libro, `embarques_${rango}.xlsx`);
}
