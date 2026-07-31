import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type CuadroRiegoPdf = { nombre: string; horas: number };
export type ProductoRiegoPdf = { nombre: string; dosisHa: number | null; cantidad: number; unidad: string };

export function generarPdfRiego({
  fecha,
  campoNombre,
  horaInicio,
  horaFin,
  cuadros,
  productos,
}: {
  fecha: string;
  campoNombre: string;
  horaInicio: string | null;
  horaFin: string | null;
  cuadros: CuadroRiegoPdf[];
  productos: ProductoRiegoPdf[];
}) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(13);
  doc.text("Agroexport de Sonora", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("Riego", 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.text(`Fecha: ${fecha}`, 14, y);
  doc.text(`Campo: ${campoNombre}`, 90, y);
  y += 5;
  if (horaInicio || horaFin) {
    doc.text(`Horario: ${horaInicio ?? "?"} - ${horaFin ?? "?"}`, 14, y);
    y += 5;
  }
  y += 3;

  doc.setFontSize(10);
  doc.text("Cuadros regados", 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Cuadro", "Horas"]],
    body: cuadros.map((c) => [c.nombre, String(c.horas)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [92, 140, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (productos.length > 0) {
    doc.setFontSize(10);
    doc.text("Fertirriego aplicado", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Producto", "Dosis/ha", "Total aplicado"]],
      body: productos.map((p) => [
        p.nombre,
        p.dosisHa != null ? String(p.dosisHa) : "-",
        `${p.cantidad.toFixed(2)} ${p.unidad}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 140, 58] },
    });
  }

  doc.save(`riego_${fecha}.pdf`);
}
