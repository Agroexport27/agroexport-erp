import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaEmbarque = {
  fecha: string;
  campo: string;
  cuadro: string;
  distribuidor: string;
  manifiesto: string;
  empaque: string;
  calibre: string;
  cajas: number;
  bins: number;
};

export function generarPdfEmbarques(filas: FilaEmbarque[], rango: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  const totalCajas = filas.reduce((s, f) => s + f.cajas, 0);
  const totalBins = filas.reduce((s, f) => s + f.bins, 0);

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text(`Registros de embarques (${rango})`, 14, 21);
  doc.setFontSize(9);
  doc.text(`Total cajas: ${totalCajas.toLocaleString()}   Total bins: ${totalBins.toLocaleString()}`, 14, 27);

  autoTable(doc, {
    startY: 32,
    head: [["Fecha", "Campo", "Cuadro", "Distribuidor", "Manifiesto", "Empaque", "Calibre", "Cajas", "Bins"]],
    body: filas.map((f) => [
      f.fecha,
      f.campo,
      f.cuadro,
      f.distribuidor,
      f.manifiesto,
      f.empaque,
      f.calibre,
      f.cajas > 0 ? f.cajas.toFixed(0) : "-",
      f.bins > 0 ? f.bins.toFixed(0) : "-",
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [92, 140, 58] },
  });

  doc.save(`embarques_${rango}.pdf`);
}
