import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const VERDE: [number, number, number] = [92, 140, 58];
const VERDE_OSCURO: [number, number, number] = [58, 92, 34];
const VERDE_CLARO: [number, number, number] = [237, 244, 229];
const GRIS_TEXTO: [number, number, number] = [55, 65, 47];
const GRIS_CLARO: [number, number, number] = [120, 130, 112];

export function generarPdfAcumulado({
  cicloLabel,
  cultivoLabel,
  distribuidorLabel,
  rangoLabel,
  totalGeneral,
  consolidadoDiario,
  detallePorCuadro,
  campoDetalleNombre,
  cortesManuales,
  resumenVariedad,
  resumenPorDistribuidor,
  resumenPorCuadro,
  esPepino,
  esConTamano,
  esConTamanoGeneral,
}: {
  cicloLabel: string;
  cultivoLabel: string;
  distribuidorLabel: string;
  rangoLabel: string;
  totalGeneral: number;
  consolidadoDiario: any;
  detallePorCuadro: any;
  campoDetalleNombre: string;
  cortesManuales?: {
    cuadrosPlantados: { cuadroId: string; nombre: string; campoId: string }[];
    cajasManualPorCorte: Record<string, string>;
    campos: { id: string; label: string }[];
  };
  resumenVariedad: any;
  resumenPorDistribuidor?: any[];
  resumenPorCuadro?: any[];
  esPepino?: boolean;
  esConTamano?: boolean;
  esConTamanoGeneral?: boolean;
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;

  // ---------- Encabezado (banda de color) ----------
  function encabezado(titulo: string) {
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("Agroexport de Sonora", marginX, 10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(titulo, marginX, 17);

    doc.setFontSize(8.5);
    const infoDer = [
      `Ciclo: ${cicloLabel}`,
      `Cultivo: ${cultivoLabel}`,
      `Distribuidor: ${distribuidorLabel}`,
      `Periodo: ${rangoLabel}`,
    ];
    let yInfo = 8;
    for (const linea of infoDer) {
      doc.text(linea, pageW - marginX, yInfo, { align: "right" });
      yInfo += 4;
    }
    doc.setTextColor(...GRIS_TEXTO);
  }

  encabezado("Reporte Acumulado de Cosecha");

  // ---------- Tarjetas de totales ----------
  let y = 30;
  const tarjetas = [
    { label: "Total general", valor: totalGeneral },
    ...consolidadoDiario.nombresDist.map((d: string) => ({
      label: d,
      valor: consolidadoDiario.filas.reduce((s: number, f: any) => s + (f.porDist[d] || 0), 0),
    })),
  ];
  const anchoTarjeta = Math.min(42, (pageW - marginX * 2 - (tarjetas.length - 1) * 4) / tarjetas.length);
  let xTarjeta = marginX;
  for (const t of tarjetas) {
    doc.setFillColor(...VERDE_CLARO);
    doc.roundedRect(xTarjeta, y, anchoTarjeta, 16, 1.5, 1.5, "F");
    doc.setTextColor(...GRIS_CLARO);
    doc.setFontSize(6.5);
    doc.text(t.label, xTarjeta + 3, y + 6, { maxWidth: anchoTarjeta - 6 });
    doc.setTextColor(...VERDE_OSCURO);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(Number(t.valor).toLocaleString(), xTarjeta + 3, y + 12.5);
    doc.setFont("helvetica", "normal");
    xTarjeta += anchoTarjeta + 4;
    if (xTarjeta + anchoTarjeta > pageW - marginX) {
      xTarjeta = marginX;
      y += 19;
    }
  }
  y += 22;

  function tituloSeccion(texto: string, yPos: number) {
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...VERDE_OSCURO);
    doc.text(texto, marginX, yPos);
    doc.setDrawColor(...VERDE);
    doc.setLineWidth(0.4);
    doc.line(marginX, yPos + 1.5, pageW - marginX, yPos + 1.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRIS_TEXTO);
  }

  function saltoDePaginaSiHaceFalta(margen = 30) {
    if (y > 190 - margen) {
      doc.addPage();
      encabezado("Reporte Acumulado de Cosecha (continuación)");
      y = 30;
    }
  }

  // Cuando una sola tabla es tan larga que jspdf-autotable la parte en varias
  // páginas por su cuenta (p. ej. "Detalle por cuadro" con hasta ~45 filas),
  // esta función se pasa como `didDrawPage` para que cada página nueva que
  // autoTable inserte automáticamente también lleve la banda verde de
  // encabezado y quede lista para el pie de página final — no solo las
  // páginas que iniciamos manualmente con saltoDePaginaSiHaceFalta().
  function conEncabezadoAuto(titulo: string) {
    return (data: any) => {
      if (data.pageNumber > 1) {
        encabezado(`Reporte Acumulado de Cosecha — ${titulo} (continuación)`);
      }
    };
  }

  // ---------- Consolidado diario ----------
  tituloSeccion("Consolidado diario", y);
  y += 4;
  autoTable(doc, {
    startY: y,
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
    theme: "striped",
    styles: { fontSize: 7, halign: "center", textColor: GRIS_TEXTO, lineColor: [225, 230, 218], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [247, 249, 244] },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    headStyles: { fillColor: VERDE, textColor: 255, fontSize: 6.5, fontStyle: "bold" },
    margin: { top: 30, left: marginX, right: marginX },
    didDrawPage: conEncabezadoAuto("Consolidado diario"),
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ---------- Detalle por cuadro ----------
  saltoDePaginaSiHaceFalta();
  tituloSeccion(`Detalle por cuadro — ${campoDetalleNombre}`, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Fecha", ...detallePorCuadro.cuadrosInfo.map((c: any) => c.nombre)]],
    body: [
      ...detallePorCuadro.fechas.map((fecha: string) => [
        fecha,
        ...detallePorCuadro.cuadrosInfo.map((c: any) => detallePorCuadro.porFecha.get(fecha)?.[c.id] ?? ""),
      ]),
      [
        "Total",
        ...detallePorCuadro.cuadrosInfo.map((c: any) => detallePorCuadro.totalPorCuadro[c.id]?.toFixed(0) ?? ""),
      ],
      [
        "Cajas/ha",
        ...detallePorCuadro.cuadrosInfo.map((c: any) => {
          const total = detallePorCuadro.totalPorCuadro[c.id] ?? 0;
          return c.hectareas > 0 ? (total / c.hectareas).toFixed(1) : "";
        }),
      ],
    ],
    theme: "striped",
    styles: { fontSize: 7, halign: "center", textColor: GRIS_TEXTO, lineColor: [225, 230, 218], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [247, 249, 244] },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    headStyles: { fillColor: VERDE, textColor: 255, fontSize: 6.5, fontStyle: "bold" },
    margin: { top: 30, left: marginX, right: marginX },
    didDrawPage: conEncabezadoAuto(`Detalle por cuadro — ${campoDetalleNombre}`),
    didParseCell: (data) => {
      const filas = detallePorCuadro.fechas.length;
      if (data.section === "body" && data.row.index === filas + 1) {
        data.cell.styles.fillColor = VERDE_CLARO;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = VERDE_OSCURO;
      }
      if (data.section === "body" && data.row.index === filas) {
        data.cell.styles.fillColor = [237, 240, 233];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ---------- Cortes por número (manual) ----------
  if (!esPepino && cortesManuales && cortesManuales.cuadrosPlantados.length > 0) {
    saltoDePaginaSiHaceFalta();
    tituloSeccion("Cortes por número (manual)", y);
    y += 4;
    const etiquetas = ["1er", "2do", "3er", "4to", "5to"];
    const filas = [...cortesManuales.cuadrosPlantados]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }))
      .map((c) => [
        cortesManuales.campos.find((cc) => cc.id === c.campoId)?.label ?? "",
        c.nombre,
        ...etiquetas.map((_, i) => cortesManuales.cajasManualPorCorte[`${c.cuadroId}__${i + 1}`] || ""),
      ]);
    autoTable(doc, {
      startY: y,
      head: [["Campo", "Cuadro", ...etiquetas.map((e) => `${e} corte`)]],
      body: filas,
      theme: "striped",
      styles: { fontSize: 7, halign: "center", textColor: GRIS_TEXTO, lineColor: [225, 230, 218], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [247, 249, 244] },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "left", fontStyle: "bold" } },
      headStyles: { fillColor: VERDE, textColor: 255, fontSize: 6.5, fontStyle: "bold" },
      margin: { top: 30, left: marginX, right: marginX },
      didDrawPage: conEncabezadoAuto("Cortes por número (manual)"),
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---------- % Resumen por variedad ----------
  doc.addPage();
  encabezado("Reporte Acumulado de Cosecha — % Resumen");
  y = 30;
  tituloSeccion("% Resumen por variedad", y);
  y += 4;

  const encabezadosPct = esPepino ? resumenVariedad.calibresOrden.map((c: string) => `%${c}`) : [];
  const encabezado36s = esPepino ? ["Cajas 36s"] : [];
  const encabezadosTamano = esConTamano ? ["%6", "%8", "%9", "%11"] : [];

  autoTable(doc, {
    startY: y,
    head: [[
      "Variedad",
      ...resumenVariedad.calibresOrden,
      "Total",
      ...encabezadosTamano,
      ...encabezadosPct,
      ...encabezado36s,
    ]],
    body: [
      ...resumenVariedad.variedades.map((v: any) => [
        v.variedad,
        ...resumenVariedad.calibresOrden.map((c: string) => v.cantidades[c] || ""),
        v.total.toFixed(0),
        ...(esConTamano
          ? (v.porcentajesTamano ?? []).map((pt: any) =>
              esConTamanoGeneral || v.usaTamanoForzado ? `${pt.porcentaje.toFixed(1)}%` : "—"
            )
          : []),
        ...(esPepino ? (v.porcentajesEmpaque ?? []).map((pe: any) => `${pe.porcentaje.toFixed(1)}%`) : []),
        ...(esPepino ? [v.cajas36s > 0 ? v.cajas36s.toFixed(1) : ""] : []),
      ]),
      [
        "TOTAL",
        ...resumenVariedad.calibresOrden.map((c: string) => resumenVariedad.totalesPorCalibre[c]?.toFixed(0) || ""),
        resumenVariedad.granTotal.toFixed(0),
        ...(esConTamano ? (resumenVariedad.porcentajesTamano ?? []).map((pt: any) => `${pt.porcentaje.toFixed(1)}%`) : []),
        ...(esPepino ? (resumenVariedad.porcentajesEmpaque ?? []).map((pe: any) => `${pe.porcentaje.toFixed(1)}%`) : []),
        ...(esPepino ? [resumenVariedad.granTotal36s > 0 ? resumenVariedad.granTotal36s.toFixed(1) : ""] : []),
      ],
    ],
    theme: "striped",
    styles: { fontSize: 7, halign: "center", textColor: GRIS_TEXTO, lineColor: [225, 230, 218], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [247, 249, 244] },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    headStyles: { fillColor: VERDE, textColor: 255, fontSize: 6.5, fontStyle: "bold" },
    margin: { top: 30, left: marginX, right: marginX },
    didDrawPage: conEncabezadoAuto("% Resumen por variedad"),
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === resumenVariedad.variedades.length) {
        data.cell.styles.fillColor = VERDE_CLARO;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = VERDE_OSCURO;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (esConTamanoGeneral || esPepino) {
    saltoDePaginaSiHaceFalta(40);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    let texto = "";
    if (esConTamanoGeneral) {
      texto = "% por tamaño (general):  " + resumenVariedad.porcentajesTamano
        .map((t: any) => `${t.tamano}: ${t.porcentaje.toFixed(1)}%`)
        .join("     ");
    } else if (esPepino) {
      texto =
        "% por empaque (general):  " +
        resumenVariedad.porcentajesEmpaque.map((pe: any) => `${pe.calibre}: ${pe.porcentaje.toFixed(1)}%`).join("     ") +
        `     |     Total en cajas 36s: ${resumenVariedad.granTotal36s.toFixed(1)}` +
        `     |     Cajas 36s/ha: ${
          resumenVariedad.granTotal36sPorHa != null ? resumenVariedad.granTotal36sPorHa.toFixed(1) : "—"
        }`;
    }
    // Alto de la caja calculado según cuántas líneas ocupa el texto real
    // (con muchos calibres de Pepino esto ya no cabe en una sola línea).
    const anchoTexto = pageW - marginX * 2 - 8;
    const lineas = doc.splitTextToSize(texto, anchoTexto);
    const alturaResumen = lineas.length * 4.2 + 6;

    doc.setFillColor(...VERDE_CLARO);
    doc.roundedRect(marginX, y, pageW - marginX * 2, alturaResumen, 1.5, 1.5, "F");
    doc.setTextColor(...VERDE_OSCURO);
    doc.text(lineas, marginX + 4, y + 5.5, { lineHeightFactor: 1.4 });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRIS_TEXTO);
    y += alturaResumen + 10;
  }

  // ---------- % por distribuidor ----------
  if ((esConTamano || esPepino) && resumenPorDistribuidor && resumenPorDistribuidor.length > 0) {
    saltoDePaginaSiHaceFalta();
    tituloSeccion("% por distribuidor", y);
    y += 4;
    const encabezadosPctDist = esPepino ? resumenVariedad.calibresOrden.map((c: string) => `%${c}`) : [];
    const encabezado36sDist = esPepino ? ["Cajas 36s"] : [];
    const encabezadosTamanoDist = esConTamano ? ["%6", "%8", "%9", "%11"] : [];
    autoTable(doc, {
      startY: y,
      head: [["Distribuidor", "Total cajas", ...encabezadosTamanoDist, ...encabezadosPctDist, ...encabezado36sDist]],
      body: resumenPorDistribuidor.map((d: any) => [
        d.distribuidor,
        d.granTotal.toFixed(0),
        ...(esConTamano ? (d.porcentajesTamano ?? []).map((pt: any) => `${pt.porcentaje.toFixed(1)}%`) : []),
        ...(esPepino
          ? resumenVariedad.calibresOrden.map((c: string) => {
              const pe = (d.porcentajesEmpaque ?? []).find((x: any) => x.calibre === c);
              return pe ? `${pe.porcentaje.toFixed(1)}%` : "—";
            })
          : []),
        ...(esPepino ? [d.cajas36s > 0 ? d.cajas36s.toFixed(1) : ""] : []),
      ]),
      theme: "striped",
      styles: { fontSize: 7, halign: "center", textColor: GRIS_TEXTO, lineColor: [225, 230, 218], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [247, 249, 244] },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      headStyles: { fillColor: VERDE, textColor: 255, fontSize: 6.5, fontStyle: "bold" },
      margin: { top: 30, left: marginX, right: marginX },
      didDrawPage: conEncabezadoAuto("% por distribuidor"),
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---------- % por cuadro ----------
  if ((esConTamano || esPepino) && resumenPorCuadro && resumenPorCuadro.length > 0) {
    saltoDePaginaSiHaceFalta();
    tituloSeccion("% por cuadro", y);
    y += 4;
    const encabezadosPctCuadro = esPepino ? resumenVariedad.calibresOrden.map((c: string) => `%${c}`) : [];
    const encabezado36sCuadro = esPepino ? ["Cajas 36s", "Cajas 36s/ha"] : [];
    const encabezadosTamanoCuadro = esConTamano ? ["%6", "%8", "%9", "%11"] : [];
    autoTable(doc, {
      startY: y,
      head: [["Campo", "Cuadro", "Total cajas", ...encabezadosTamanoCuadro, ...encabezadosPctCuadro, ...encabezado36sCuadro]],
      body: resumenPorCuadro.map((c: any) => [
        c.campo,
        c.nombre,
        c.granTotal.toFixed(0),
        ...(esConTamano ? (c.porcentajesTamano ?? []).map((pt: any) => `${pt.porcentaje.toFixed(1)}%`) : []),
        ...(esPepino
          ? resumenVariedad.calibresOrden.map((cal: string) => {
              const pe = (c.porcentajesEmpaque ?? []).find((x: any) => x.calibre === cal);
              return pe ? `${pe.porcentaje.toFixed(1)}%` : "—";
            })
          : []),
        ...(esPepino
          ? [
              c.cajas36s > 0 ? c.cajas36s.toFixed(1) : "",
              c.cajas36sPorHa != null ? c.cajas36sPorHa.toFixed(1) : "—",
            ]
          : []),
      ]),
      theme: "striped",
      styles: { fontSize: 7, halign: "center", textColor: GRIS_TEXTO, lineColor: [225, 230, 218], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [247, 249, 244] },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "left", fontStyle: "bold" } },
      headStyles: { fillColor: VERDE, textColor: 255, fontSize: 6.5, fontStyle: "bold" },
      margin: { top: 30, left: marginX, right: marginX },
      didDrawPage: conEncabezadoAuto("% por cuadro"),
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---------- Pie de página (todas las páginas) ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...VERDE_CLARO);
    doc.setLineWidth(0.3);
    doc.line(marginX, h - 10, pageW - marginX, h - 10);
    doc.setFontSize(7);
    doc.setTextColor(...GRIS_CLARO);
    doc.text(
      `Agroexport de Sonora, S.A. de C.V. — Generado el ${new Date().toLocaleDateString("es-MX")}`,
      marginX,
      h - 5
    );
    doc.text(`Página ${p} de ${totalPaginas}`, pageW - marginX, h - 5, { align: "right" });
  }

  doc.save(`acumulado_${new Date().toISOString().slice(0, 10)}.pdf`);
}
