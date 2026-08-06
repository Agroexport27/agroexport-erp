import * as XLSX from "xlsx";

export type FilaInventario = {
  campo: string;
  producto: string;
  categoria: string;
  stock: number;
  unidad: string;
};

export function generarExcelInventario(filas: FilaInventario[]) {
  const datos = filas.map((f) => ({
    Campo: f.campo,
    Producto: f.producto,
    Categoría: f.categoria,
    Stock: f.stock,
    Unidad: f.unidad,
  }));
  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 8 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");
  XLSX.writeFile(libro, `inventario_agroquimicos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
