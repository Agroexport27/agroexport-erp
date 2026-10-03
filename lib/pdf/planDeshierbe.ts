import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ItemPlanDeshierbe = { campo: string; cuadro: string; cultivo: string; jornales: number };
export type DiaPlanDeshierbe = { etiqueta: string; items: ItemPlanDeshierbe[] };

export function generarPdfPlanDeshierbe({
  semanaLabel,
  dias,
}: {
  semanaLabel: string;
  dias: DiaPlanDeshierbe[];
}) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Plan de deshierbe — Semana ${semanaLabel}`, 14, y);
  y += 10;

  for (const dia of dias) {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(10);
    doc.text(dia.etiqueta, 14, y);
    y += 3;

    if (dia.items.length === 0) {
      doc.setFontSize(8);
      doc.text("Sin deshierbe programado.", 18, y + 5);
      y += 10;
      continue;
    }

    autoTable(doc, {
      startY: y + 2,
      head: [["Campo", "Cuadro", "Cultivo", "Jornales"]],
      body: dia.items.map((it) => [it.campo, it.cuadro, it.cultivo, String(it.jornales)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 140, 58] },
      foot: [["", "", "TOTAL", String(dia.items.reduce((s, it) => s + it.jornales, 0))]],
      footStyles: { fillColor: [240, 226, 206], textColor: [61, 61, 58] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.save(`plan_deshierbe_${semanaLabel.replace(/\s+/g, "_")}.pdf`);
}
