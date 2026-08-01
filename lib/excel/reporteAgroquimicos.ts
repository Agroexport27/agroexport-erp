import * as XLSX from "xlsx";

export type FilaCuadroProducto = { campo: string; cuadro: string; producto: string; cantidad: number; unidad: string };
export type FilaProductoCuadro = { campo: string; producto: string; cuadro: string; cantidad: number; unidad: string };

export function generarExcelReporteAgroquimicos({
  rango,
  cuadroProducto,
  productoCuadro,
}: {
  rango: string;
  cuadroProducto: FilaCuadroProducto[];
  productoCuadro: FilaProductoCuadro[];
}) {
  const libro = XLSX.utils.book_new();

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
