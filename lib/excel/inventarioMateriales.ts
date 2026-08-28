import * as XLSX from "xlsx";

export type FilaInventarioMaterial = { campo: string; material: string; stock: number };

export function generarExcelInventarioMateriales(filas: FilaInventarioMaterial[]) {
  const hoja = XLSX.utils.json_to_sheet(
    filas.map((f) => ({ Campo: f.campo, Material: f.material, Stock: f.stock }))
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario materiales");
  XLSX.writeFile(libro, `inventario_materiales_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
