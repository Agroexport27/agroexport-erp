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

// Lista compacta: todos los trabajadores de un campo/periodo, con una
// columna por cada dia de la semana (sabado a viernes) mostrando cuanto
// gano ese dia, y una columna en blanco para firmar. Firmas de ingeniero
// y apuntadora al pie de cada hoja.
export function generarPdfRecibosNomina({
  campoNombre,
  periodoLabel,
  dias,
  recibos,
}: {
  campoNombre: string;
  periodoLabel: string;
  dias: { fecha: string; etiqueta: string }[];
  recibos: ReciboEmpleado[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });

  const body = recibos.map((r, i) => {
    const totalesPorDia = dias.map((d) => {
      const suma = r.filas
        .filter((f) => f.fecha === d.fecha)
        .reduce((s, f) => s + f.total, 0);
      return suma > 0 ? suma.toFixed(0) : "";
    });
    const total = r.filas.reduce((s, f) => s + f.total, 0);
    return [String(i + 1), r.clave, r.nombre, ...totalesPorDia, `$${total.toFixed(2)}`, ""];
  });

  const totalesColumnaPorDia = dias.map((d) =>
    recibos
      .reduce(
        (s, r) =>
          s + r.filas.filter((f) => f.fecha === d.fecha).reduce((s2, f) => s2 + f.total, 0),
        0
      )
      .toFixed(0)
  );
  const granTotal = recibos.reduce(
    (s, r) => s + r.filas.reduce((s2, f) => s2 + f.total, 0),
    0
  );

  autoTable(doc, {
    startY: 26,
    head: [["No.", "Clave", "Nombre", ...dias.map((d) => d.etiqueta), "Total", "Firma"]],
    body,
    foot: [["", "", "TOTAL", ...totalesColumnaPorDia, `$${granTotal.toFixed(2)}`, ""]],
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [92, 140, 58], fontSize: 7 },
    footStyles: { fillColor: [240, 226, 206], textColor: [61, 61, 58] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 16 },
      2: { cellWidth: 38 },
    },
    margin: { top: 26, bottom: 24 },
    didDrawPage: () => {
      doc.setFontSize(12);
      doc.text("Agroexport de Sonora", 14, 12);
      doc.setFontSize(9);
      doc.text(`Lista de nomina semanal — Campo: ${campoNombre} — Periodo: ${periodoLabel}`, 14, 18);

      const ancho = doc.internal.pageSize.getWidth();
      const alto = doc.internal.pageSize.getHeight();
      const y = alto - 12;
      doc.setFontSize(9);
      doc.line(20, y, 100, y);
      doc.text("Firma del ingeniero", 20, y + 5);
      doc.line(ancho - 100, y, ancho - 20, y);
      doc.text("Firma de la apuntadora", ancho - 100, y + 5);
    },
  });

  doc.save(`lista_nomina_${periodoLabel.replace(/\s+/g, "_")}.pdf`);
}
