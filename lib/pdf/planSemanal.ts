import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaPlanSemanal = {
  campo: string;
  cuadro: string;
  jornales: number;
  diasActivos: boolean[];
};

const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

export function generarPdfPlanSemanal({
  actividad,
  semanaInicio,
  dias,
  filas,
}: {
  actividad: string;
  semanaInicio: string;
  dias: string[];
  filas: FilaPlanSemanal[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text(`Plan semanal de labores - ${actividad}`, 14, 21);
  doc.setFontSize(9);
  doc.text(`Semana del ${dias[0]} al ${dias[6]}`, 14, 27);

  const head = [["Campo", "Cuadro", "Jornales/dia", ...DIAS.map((d, i) => `${d}\n${dias[i]}`)]];
  const body = filas.map((f) => [
    f.campo,
    f.cuadro,
    String(f.jornales),
    ...f.diasActivos.map((activo) => (activo ? String(f.jornales) : "-")),
  ]);

  const totalPorDia = dias.map((_, i) => filas.reduce((s, f) => s + (f.diasActivos[i] ? f.jornales : 0), 0));

  autoTable(doc, {
    startY: 32,
    head,
    body,
    foot: [["", "", "TOTAL", ...totalPorDia.map((t) => (t ? String(t) : "-"))]],
    styles: { fontSize: 8, halign: "center" },
    columnStyles: {
      0: { halign: "left", cellWidth: 30 },
      1: { halign: "left", cellWidth: 22 },
    },
    headStyles: { fillColor: [92, 140, 58], fontSize: 7 },
    footStyles: { fillColor: [240, 226, 206], textColor: [61, 61, 58] },
  });

  doc.save(`plan_semanal_${actividad.replace(/\s+/g, "_")}_${semanaInicio}.pdf`);
}
