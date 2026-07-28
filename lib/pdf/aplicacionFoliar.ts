import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ProductoAplicacionPdf = {
  producto: string;
  dosisHa: number | null;
  dosisTanque: number | null;
  totalUsado: number;
  unidad: string;
};

export function generarPdfAplicacionFoliar({
  folio,
  campo,
  cultivo,
  variedad,
  cuadros,
  superficieHas,
  fechaAplicacion,
  tripleLavado,
  operador,
  noTractor,
  noAspersora,
  ltsPorTanque,
  hasPorTanque,
  noCargas,
  seCalibroEquipo,
  horaInicio,
  horaTermino,
  gerenteCampo,
  encargadoAplicaciones,
  productos,
}: {
  folio: string;
  campo: string;
  cultivo: string;
  variedad: string;
  cuadros: string;
  superficieHas: number;
  fechaAplicacion: string;
  tripleLavado: boolean;
  operador: string;
  noTractor: string;
  noAspersora: string;
  ltsPorTanque: string;
  hasPorTanque: string;
  noCargas: string;
  seCalibroEquipo: boolean;
  horaInicio: string;
  horaTermino: string;
  gerenteCampo: string;
  encargadoAplicaciones: string;
  productos: ProductoAplicacionPdf[];
}) {
  const doc = new jsPDF();

  doc.setFontSize(13);
  doc.text("Agroexport de Sonora", 14, 16);
  doc.setFontSize(10);
  doc.text("Control de aplicaciones de agroquimicos via foliar", 14, 22);
  doc.setFontSize(10);
  doc.text(`Folio: ${folio || "-"}`, 160, 16);

  autoTable(doc, {
    startY: 27,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1 },
    body: [
      ["Campo:", campo, "Cultivo:", cultivo, "Variedad:", variedad],
      ["Cuadros:", cuadros, "Superficie:", `${superficieHas.toFixed(2)} ha`, "Fecha:", fechaAplicacion],
      [
        "Triple lavado:",
        tripleLavado ? "Si" : "No",
        "Se calibro equipo:",
        seCalibroEquipo ? "Si" : "No",
        "",
        "",
      ],
      ["Operador:", operador || "-", "No. tractor:", noTractor || "-", "No. aspersora:", noAspersora || "-"],
      [
        "Lts/tanque:",
        ltsPorTanque || "-",
        "Has/tanque:",
        hasPorTanque || "-",
        "No. cargas:",
        noCargas || "-",
      ],
      ["Hora inicio:", horaInicio || "-", "Hora termino:", horaTermino || "-", "", ""],
      ["Gerente de campo:", gerenteCampo || "-", "Encargado aplicaciones:", encargadoAplicaciones || "-", "", ""],
    ],
    columnStyles: {
      0: { fontStyle: "bold" },
      2: { fontStyle: "bold" },
      4: { fontStyle: "bold" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: finalY,
    head: [["Producto", "Dosis/ha", "Dosis/tanque", "Total usado"]],
    body: productos.map((p) => [
      p.producto,
      p.dosisHa != null ? String(p.dosisHa) : "-",
      p.dosisTanque != null ? String(p.dosisTanque) : "-",
      `${p.totalUsado} ${p.unidad}`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [92, 140, 58] },
  });

  const nombreArchivo = `aplicacion_foliar_${folio || fechaAplicacion}.pdf`;
  doc.save(nombreArchivo);
}
