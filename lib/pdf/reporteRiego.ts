import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaCuadroRiego = {
  campo: string;
  nombre: string;
  hectareas: number;
  riegos: number;
  horas: number;
  laminaHa: number;
  laminaTotal: number;
};
export type FilaMesRiego = { mes: string; horas: number };

export function generarPdfReporteRiego({
  rango,
  totalHoras,
  totalLamina,
  porCuadro,
  porMes,
}: {
  rango: string;
  totalHoras: number;
  totalLamina: number;
  porCuadro: FilaCuadroRiego[];
  porMes: FilaMesRiego[];
}) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Reporte de riego (${rango})`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Horas totales: ${totalHoras.toFixed(1)} h    Lamina total: ${totalLamina.toFixed(1)} mm`, 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text("Horas de riego por mes", 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Mes", "Horas"]],
    body: porMes.map((m) => [m.mes, `${m.horas.toFixed(1)} h`]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [92, 140, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  if (y > 250) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(11);
  doc.text("Detalle por cuadro", 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Campo", "Cuadro", "Ha", "No. riegos", "Horas", "Lamina/ha (mm)", "Lamina total (mm)"]],
    body: porCuadro.map((c) => [
      c.campo,
      c.nombre,
      c.hectareas ? String(c.hectareas) : "—",
      String(c.riegos),
      `${c.horas.toFixed(1)} h`,
      c.laminaHa > 0 ? `${c.laminaHa.toFixed(1)} mm` : "—",
      c.laminaTotal > 0 ? `${c.laminaTotal.toFixed(1)}` : "—",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [92, 140, 58] },
  });

  doc.save(`reporte_riego_${rango}.pdf`);
}
