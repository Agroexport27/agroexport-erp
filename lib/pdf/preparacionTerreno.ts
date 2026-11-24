import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// listo = terminada · programada = fecha del programa · pendiente = sin fecha todavía
// estimada = fecha calculada · na = no aplica en ese cuadro · vacio = nada
export type CeldaPdf = {
  estado: "listo" | "programada" | "pendiente" | "estimada" | "na" | "vacio";
  texto: string;
};

type CuadroPdf = {
  nombre: string;
  hectareas: number;
  fechaTrasplante: string | null;
  celdas: CeldaPdf[]; // mismo orden que "actividades"
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function generarPdfPreparacionTerreno({
  campoNombre,
  cicloClave,
  actividades,
  cuadros,
}: {
  campoNombre: string;
  cicloClave?: string;
  actividades: string[];
  cuadros: CuadroPdf[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  const totalHa = cuadros.reduce((s, c) => s + c.hectareas, 0);

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text(
    `Preparación de terreno — ${campoNombre}${cicloClave ? ` — Ciclo ${cicloClave}` : ""}`,
    14,
    21
  );
  doc.setFontSize(8);
  doc.text(
    `${cuadros.length} cuadro(s) · ${totalHa.toFixed(1)} ha · Emitido: ${new Date().toLocaleDateString("es-MX")}`,
    14,
    26
  );
  doc.text(
    "X = listo · fecha = programada · PEND = pendiente de programar · (fecha) = estimada · — = no aplica",
    14,
    30
  );

  // Hectáreas por actividad: las que ya están listas y las que faltan
  // (no cuentan los cuadros donde la actividad no aplica).
  const resumen = actividades.map((_, i) => {
    let aplica = 0;
    let listas = 0;
    for (const c of cuadros) {
      const celda = c.celdas[i];
      if (!celda || celda.estado === "na") continue;
      aplica += c.hectareas;
      if (celda.estado === "listo") listas += c.hectareas;
    }
    return { aplica, listas, faltan: aplica - listas };
  });

  const head = [
    [
      "Actividad",
      ...cuadros.map((c) => `${c.nombre}\n${c.hectareas} ha`),
      "Ha listas",
      "Ha que faltan",
      "Avance",
    ],
  ];

  const body = actividades.map((nombreActividad, i) => {
    const r = resumen[i];
    const pct = r.aplica > 0 ? Math.round((r.listas / r.aplica) * 100) : 0;
    return [
      nombreActividad,
      ...cuadros.map((c) => {
        const celda = c.celdas[i];
        if (!celda) return "";
        switch (celda.estado) {
          case "listo":
            return "X";
          case "programada":
            return celda.texto;
          case "pendiente":
            return "PEND";
          case "estimada":
            return `(${celda.texto})`;
          case "na":
            return "—";
          default:
            return "";
        }
      }),
      r.aplica > 0 ? r.listas.toFixed(1) : "—",
      r.aplica > 0 ? r.faltan.toFixed(1) : "—",
      r.aplica > 0 ? `${pct}%` : "—",
    ];
  });

  // Última fila: avance por cuadro (actividades listas / actividades que le aplican)
  const avancePorCuadro = cuadros.map((c) => {
    const aplican = c.celdas.filter((x) => x.estado !== "na");
    const listas = aplican.filter((x) => x.estado === "listo").length;
    return aplican.length > 0 ? `${Math.round((listas / aplican.length) * 100)}%` : "—";
  });
  const totAplica = resumen.reduce((s, r) => s + r.aplica, 0);
  const totListas = resumen.reduce((s, r) => s + r.listas, 0);
  body.push([
    "AVANCE",
    ...avancePorCuadro,
    "",
    "",
    totAplica > 0 ? `${Math.round((totListas / totAplica) * 100)}%` : "—",
  ]);

  const nCuadros = cuadros.length;
  const colExtra = nCuadros + 1; // primera de las 3 columnas finales
  autoTable(doc, {
    startY: 34,
    head,
    body,
    styles: { fontSize: 6.5, halign: "center", cellPadding: 1.2 },
    columnStyles: {
      0: { halign: "left", cellWidth: 30, fontStyle: "bold" },
      [colExtra]: { fillColor: [240, 247, 235] },
      [colExtra + 1]: { fillColor: [253, 240, 230], fontStyle: "bold" },
      [colExtra + 2]: { fillColor: [240, 247, 235] },
    },
    headStyles: { fillColor: [92, 140, 58], fontSize: 6.5 },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index < actividades.length) {
        const ci = data.column.index - 1;
        if (ci >= 0 && ci < nCuadros) {
          const celda = cuadros[ci].celdas[data.row.index];
          if (celda?.estado === "listo") {
            data.cell.styles.fillColor = [214, 236, 200];
            data.cell.styles.textColor = [40, 90, 30];
            data.cell.styles.fontStyle = "bold";
          } else if (celda?.estado === "pendiente") {
            data.cell.styles.textColor = [180, 90, 20];
            data.cell.styles.fontStyle = "bold";
          } else if (celda?.estado === "estimada" || celda?.estado === "na") {
            data.cell.styles.textColor = [150, 150, 150];
          }
        }
      }
      if (data.section === "body" && data.row.index === actividades.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [225, 235, 215];
      }
    },
  });

  doc.setFontSize(7);
  const finalY = (doc as any).lastAutoTable?.finalY ?? 40;
  doc.text(
    "Ha que faltan = hectáreas de los cuadros donde la actividad aplica y todavía no está lista.",
    14,
    Math.min(finalY + 5, 200)
  );

  doc.save(`preparacion_terreno_${campoNombre.replace(/\s+/g, "_")}.pdf`);
}
