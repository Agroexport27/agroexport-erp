import * as XLSX from "xlsx";

export type FilaCuadroProducto = { campo: string; cuadro: string; producto: string; cantidad: number; unidad: string };
export type FilaProductoCuadro = { campo: string; producto: string; cuadro: string; cantidad: number; unidad: string };
export type FilaTotalProducto = {
  producto: string;
  cantidad: number;
  unidad: string;
  hectareas: number;
  cantidadPorHa: number | null;
};

export function generarExcelReporteAgroquimicos({
  rango,
  porProducto,
  cuadroProducto,
  productoCuadro,
}: {
  rango: string;
  porProducto: FilaTotalProducto[];
  cuadroProducto: FilaCuadroProducto[];
  productoCuadro: FilaProductoCuadro[];
}) {
  const libro = XLSX.utils.book_new();

  const hojaTotal = XLSX.utils.json_to_sheet(
    porProducto.map((f) => ({
      Producto: f.producto,
      Total: f.cantidad,
      Unidad: f.unidad,
      Hectáreas: f.hectareas,
      "Cantidad/ha": f.cantidadPorHa ?? "",
    }))
  );
  XLSX.utils.book_append_sheet(libro, hojaTotal, "Acumulado por producto");

  const hoja1 = XLSX.utils.json_to_sheet(
    cuadroProducto.map((f) => ({
      Campo: f.campo,
      Cuadro: f.cuadro,
      Producto: f.producto,
      Cantidad: f.cantidad,
      Unidad: f.unidad,
    }))
  );
  XLSX.utils.book_append_sheet(libro, hoja1, "Campo-Cuadro-Producto");

  const hoja2 = XLSX.utils.json_to_sheet(
    productoCuadro.map((f) => ({
      Campo: f.campo,
      Producto: f.producto,
      Cuadro: f.cuadro,
      Cantidad: f.cantidad,
      Unidad: f.unidad,
    }))
  );
  XLSX.utils.book_append_sheet(libro, hoja2, "Campo-Producto-Cuadro");

  XLSX.writeFile(libro, `reporte_agroquimicos_${rango}.xlsx`);
}
