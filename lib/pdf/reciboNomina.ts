import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaRecibo = {
  fecha: string;
  actividad: string;
  cuadro: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  total: number;
};

export type ReciboEmpleado = {
  clave: string;
  nombre: string;
  filas: FilaRecibo[];
};

// Lista compacta: todos los trabajadores de un campo/periodo en la misma
// hoja (o el minimo de hojas posible), con una columna en blanco para que
// cada quien firme junto a su total. Al pie de cada hoja van las firmas
// del ingeniero y la apuntadora.
export function generarPdfRecibosNomina({
  campoNombre,
  periodoLabel,
  recibos,
}: {
  campoNombre: string;
  periodoLabel: string;
  recibos: ReciboEmpleado[];
}) {
  const doc = new jsPDF();

  const body = recibos.map((r, i) => {
    const total = r.filas.reduce((s, f) => s + f.total, 0);
    return [String(i + 1), r.clave, r.nombre, `$${total.toFixed(2)}`, ""];
  });

  const granTotal = recibos.reduce(
    (s, r) => s + r.filas.reduce((s2, f) => s2 + f.total, 0),
    0
  );

  autoTable(doc, {
    startY: 30,
    head: [["No.", "Clave", "Nombre", "Total semana", "Firma de conformidad"]],
    body,
    foot: [["", "", "TOTAL", `$${granTotal.toFixed(2)}`, ""]],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [92, 140, 58] },
    footStyles: { fillColor: [240, 226, 206], textColor: [61, 61, 58] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      3: { cellWidth: 26 },
      4: { cellWidth: 55, minCellHeight: 10 },
    },
    margin: { top: 30, bottom: 32 },
    didDrawPage: () => {
      // Encabezado en cada hoja
      doc.setFontSize(12);
      doc.text("Agroexport de Sonora", 14, 14);
      doc.setFontSize(9);
      doc.text("Lista de nomina semanal", 14, 20);
      doc.text(`Campo: ${campoNombre}`, 14, 26);
      doc.text(`Periodo: ${periodoLabel}`, 120, 26);

      // Firmas al pie de cada hoja
      const alto = doc.internal.pageSize.getHeight();
      const y = alto - 18;
      doc.setFontSize(9);
      doc.line(20, y, 90, y);
      doc.text("Firma del ingeniero", 20, y + 5);
      doc.line(120, y, 190, y);
      doc.text("Firma de la apuntadora", 120, y + 5);
    },
  });

  doc.save(`lista_nomina_${periodoLabel.replace(/\s+/g, "_")}.pdf`);
}
