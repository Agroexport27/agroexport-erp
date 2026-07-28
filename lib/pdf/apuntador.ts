import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FilaApuntadorExport } from "@/lib/excel/apuntador";

export function generarPdfApuntador(
  filas: FilaApuntadorExport[],
  titulo: string,
  nombreArchivo: string
) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 16);
  doc.setFontSize(11);
  doc.text(titulo, 14, 23);

  const total = filas.reduce((sum, f) => sum + f.total, 0);

  autoTable(doc, {
    startY: 29,
    head: [["Empleado", "Cuadro", "Actividad", "Tipo", "Avance", "Tarifa", "Total"]],
    body: filas.map((f) => [
      `${f.empleadoClave} — ${f.empleadoNombre}`,
      f.cuadro,
      f.actividad,
      f.tipoPago,
      f.avance ?? "",
      `$${f.tarifa.toFixed(2)}`,
      `$${f.total.toFixed(2)}`,
    ]),
    foot: [["", "", "", "", "", "TOTAL", `$${total.toFixed(2)}`]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [92, 140, 58] },
    footStyles: { fillColor: [240, 226, 206], textColor: [61, 61, 58] },
  });

  doc.save(nombreArchivo);
}
