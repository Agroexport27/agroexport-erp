import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type CeldaPdf = { completado: boolean; fecha: string };

type CuadroPdf = {
  nombre: string;
  hectareas: number;
  fechaTrasplante: string | null;
  celdas: CeldaPdf[]; // mismo orden que "actividades"
};

export function generarPdfPreparacionTerreno({
  campoNombre,
  actividades,
  cuadros,
}: {
  campoNombre: string;
  actividades: string[];
  cuadros: CuadroPdf[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text(`Preparación de terreno — ${campoNombre}`, 14, 21);
  doc.setFontSize(8);
  doc.text("Las fechas en blanco son pasos pendientes (todavía no realizados).", 14, 26);

  const head = [["Actividad", ...cuadros.map((c) => c.nombre)]];
  const body = actividades.map((nombreActividad, i) =>
    [
      nombreActividad,
      ...cuadros.map((c) => {
        const celda = c.celdas[i];
        if (!celda) return "";
        // Pendiente -> se borra la fecha, solo queda vacio
        return celda.completado ? celda.fecha || "Listo" : "";
      }),
    ]
  );

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 7, halign: "center" },
    columnStyles: { 0: { halign: "left", cellWidth: 32 } },
    headStyles: { fillColor: [92, 140, 58], fontSize: 6.5 },
  });

  doc.save(`preparacion_terreno_${campoNombre.replace(/\s+/g, "_")}.pdf`);
}
