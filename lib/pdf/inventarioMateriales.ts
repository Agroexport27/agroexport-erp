import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaInventarioMaterial = { campo: string; material: string; stock: number };

export function generarPdfInventarioMateriales(filas: FilaInventarioMaterial[]) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text("Inventario de materiales de empaque", 14, 21);

  autoTable(doc, {
    startY: 28,
    head: [["Campo", "Material", "Stock"]],
    body: filas.map((f) => [f.campo, f.material, f.stock.toLocaleString()]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [92, 140, 58] },
  });

  doc.save(`inventario_materiales_${new Date().toISOString().slice(0, 10)}.pdf`);
}
