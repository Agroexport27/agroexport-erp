import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaInventario = {
  campo: string;
  producto: string;
  categoria: string;
  stock: number;
  unidad: string;
};

export function generarPdfInventario(filas: FilaInventario[]) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text("Inventario de agroquimicos", 14, y);
  y += 8;

  const porCampo = new Map<string, FilaInventario[]>();
  for (const f of filas) {
    const arr = porCampo.get(f.campo) ?? [];
    arr.push(f);
    porCampo.set(f.campo, arr);
  }

  for (const [campo, items] of porCampo.entries()) {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(10);
    doc.text(campo, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Producto", "Categoría", "Stock"]],
      body: items.map((f) => [f.producto, f.categoria, `${f.stock.toLocaleString()} ${f.unidad}`]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 140, 58] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.save(`inventario_agroquimicos_${new Date().toISOString().slice(0, 10)}.pdf`);
}
