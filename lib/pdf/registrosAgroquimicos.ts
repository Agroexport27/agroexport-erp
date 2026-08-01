import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaRegistroAgroquimico = {
  fecha: string;
  campo: string;
  cuadro: string;
  producto: string;
  cantidad: number;
  unidad: string;
  metodo: string;
};

export function generarPdfRegistrosAgroquimicos({
  rango,
  foliar,
  fertirriego,
}: {
  rango: string;
  foliar: FilaRegistroAgroquimico[];
  fertirriego: FilaRegistroAgroquimico[];
}) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(13);
  doc.text("Agroexport de Sonora", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text(`Registros de agroquimicos (${rango})`, 14, y);
  y += 8;

  function tabla(titulo: string, filas: FilaRegistroAgroquimico[]) {
    doc.setFontSize(10);
    doc.text(titulo, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Fecha", "Campo", "Cuadro", "Producto", "Cantidad", "Método"]],
      body: filas.map((f) => [
        f.fecha,
        f.campo,
        f.cuadro,
        f.producto,
        `${f.cantidad.toFixed(2)} ${f.unidad}`,
        f.metodo,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 140, 58] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  tabla("Foliar", foliar);
  if (y > 250) {
    doc.addPage();
    y = 16;
  }
  tabla("Vía riego", fertirriego);

  doc.save(`registros_agroquimicos_${rango}.pdf`);
}
