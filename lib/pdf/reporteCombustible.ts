import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Fila = { nombre: string; litros: number };

export function generarPdfReporteCombustible({
  rango,
  totalLitros,
  porCampo,
  porUnidad,
  porChofer,
}: {
  rango: string;
  totalLitros: number;
  porCampo: Fila[];
  porUnidad: Fila[];
  porChofer: Fila[];
}) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Reporte de combustible (${rango})`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Litros totales: ${totalLitros.toLocaleString()} L`, 14, y);
  y += 8;

  function tabla(titulo: string, filas: Fila[]) {
    doc.setFontSize(10);
    doc.text(titulo, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Nombre", "Litros"]],
      body: filas.map((f) => [f.nombre, `${f.litros.toLocaleString()} L`]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 140, 58] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
  }

  tabla("Por campo", porCampo);
  tabla("Por unidad", porUnidad);
  tabla("Por chofer / operador", porChofer);

  doc.save(`reporte_combustible_${rango}.pdf`);
}
