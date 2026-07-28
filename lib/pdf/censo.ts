import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaCensoPdf = {
  categoria: string; // etiqueta legible: "Maquinaria / Taller / Almacén", "Riego"...
  descripcion: string; // nombre del puesto o texto libre
  cuadro: string; // nombre(s) de cuadro, o "General"
  cantidad: number;
};

export function generarPdfCenso({
  campoNombre,
  fecha,
  folio,
  filas,
}: {
  campoNombre: string;
  fecha: string;
  folio?: string | null;
  filas: FilaCensoPdf[];
}) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 16);
  doc.setFontSize(11);
  doc.text("Censo Diario", 14, 23);

  doc.setFontSize(9);
  doc.text(`Campo: ${campoNombre}`, 14, 31);
  doc.text(`Fecha: ${fecha}`, 90, 31);
  if (folio) doc.text(`Folio: ${folio}`, 150, 31);

  // Solo renglones con gente (cantidad > 0) — ya vienen filtrados, pero
  // se filtra de nuevo aquí por seguridad.
  const filasConGente = filas.filter((f) => f.cantidad > 0);

  const total = filasConGente.reduce((sum, f) => sum + f.cantidad, 0);

  autoTable(doc, {
    startY: 37,
    head: [["No. personas", "Categoría", "Descripción", "Cuadro / Área"]],
    body: filasConGente.map((f) => [
      String(f.cantidad),
      f.categoria,
      f.descripcion,
      f.cuadro || "General",
    ]),
    foot: [["", "", "TOTAL", String(total)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [92, 140, 58] }, // verde campo
    footStyles: { fillColor: [240, 226, 206], textColor: [61, 61, 58] },
  });

  const nombreArchivo = `censo_${campoNombre.replace(/\s+/g, "_")}_${fecha}.pdf`;
  doc.save(nombreArchivo);
}
