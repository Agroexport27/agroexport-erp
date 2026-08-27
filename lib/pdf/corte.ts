import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaCorte = {
  fecha: string;
  campo: string;
  cuadro: string;
  cultivo: string;
  distribuidor: string;
  calibre: string;
  tipoUnidad: string;
  unidades: number;
  cajas: number;
};

export function generarPdfCorte(filas: FilaCorte[], rango: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  const total = filas.reduce((s, f) => s + f.cajas, 0);

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text(`Registros de corte (${rango})`, 14, 21);
  doc.setFontSize(9);
  doc.text(`Total cajas: ${total.toLocaleString()}`, 14, 27);

  autoTable(doc, {
    startY: 32,
    head: [["Fecha", "Campo", "Cuadro", "Distribuidor", "Calibre", "Tipo", "Unidades", "Cajas"]],
    body: filas.map((f) => [
      f.fecha,
      f.campo,
      f.cuadro,
      f.distribuidor,
      f.calibre,
      f.tipoUnidad,
      String(f.unidades),
      f.cajas.toFixed(0),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [92, 140, 58] },
  });

  doc.save(`corte_diario_${rango}.pdf`);
}
