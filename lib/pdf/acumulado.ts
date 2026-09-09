import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generarPdfAcumulado({
  consolidadoDiario,
  resumenVariedad,
  cicloLabel,
}: {
  consolidadoDiario: any;
  resumenVariedad: any;
  cicloLabel: string;
}) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text(`Acumulado — Ciclo ${cicloLabel}`, 14, 21);

  autoTable(doc, {
    startY: 27,
    head: [[
      "Fecha",
      ...consolidadoDiario.nombresCampo,
      "Total",
      ...consolidadoDiario.nombresDist,
      "Bins",
    ]],
    body: consolidadoDiario.filas.map((f: any) => [
      f.fecha,
      ...consolidadoDiario.nombresCampo.map((c: string) => f.porCampo[c] || ""),
      f.total.toFixed(0),
      ...consolidadoDiario.nombresDist.map((d: string) => f.porDist[d] || ""),
      f.bins > 0 ? f.bins.toFixed(0) : "",
    ]),
    styles: { fontSize: 7, halign: "center" },
    columnStyles: { 0: { halign: "left" } },
    headStyles: { fillColor: [92, 140, 58], fontSize: 6.5 },
  });

  doc.addPage();
  doc.setFontSize(12);
  doc.text("% Resumen por variedad", 14, 16);
  autoTable(doc, {
    startY: 21,
    head: [["Variedad", ...resumenVariedad.calibresOrden, "Total"]],
    body: [
      ...resumenVariedad.variedades.map((v: any) => [
        v.variedad,
        ...resumenVariedad.calibresOrden.map((c: string) => v.cantidades[c] || ""),
        v.total.toFixed(0),
      ]),
      [
        "TOTAL",
        ...resumenVariedad.calibresOrden.map((c: string) => resumenVariedad.totalesPorCalibre[c]?.toFixed(0) || ""),
        resumenVariedad.granTotal.toFixed(0),
      ],
    ],
    styles: { fontSize: 7, halign: "center" },
    columnStyles: { 0: { halign: "left" } },
    headStyles: { fillColor: [92, 140, 58], fontSize: 6.5 },
  });

  const y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text("% por tamaño (general):", 14, y);
  doc.setFontSize(9);
  const texto = resumenVariedad.porcentajesTamano
    .map((t: any) => `${t.tamano}: ${t.porcentaje.toFixed(1)}%`)
    .join("    ");
  doc.text(texto, 14, y + 6);

  doc.save(`acumulado_${new Date().toISOString().slice(0, 10)}.pdf`);
}
