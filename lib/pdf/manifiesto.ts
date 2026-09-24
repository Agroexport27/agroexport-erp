import jsPDF from "jspdf";
import { SELLO_MANIFIESTO_PNG } from "./selloManifiestoData";

// Nombre de la caja segun distribuidor (viene de la receta de materiales
// que ya cargamos en Empaque).
const CAJA_POR_DISTRIBUIDOR: Record<string, string> = {
  Dulcinea: "CAJA DULCINEA MANUAL",
  Giumarra: "CAJA LOLITA",
  "Robinson Fresh": "CAJA LOLITA",
  "Divine Flavor": "CAJA DIVINE FLAVOR",
  Nacional: "CAJA LOLITA",
};

const PESO_POR_CAJA_LBS = 35; // fijo para Sandia Mini, todos los calibres

function numeroATexto(n: number): string {
  // Para "SON:" -- como siempre es consignacion, el monto es cero.
  return "CERO DOLARES 00/100 U.S.Cy.";
}

export type LineaManifiesto = {
  cajas: number;
  calibreNombre: string;
};

export function generarPdfManifiesto({
  serie,
  folio,
  fecha,
  campoNombre,
  distribuidor,
  distribuidorDireccion,
  distribuidorCiudad,
  cajaTransporte,
  placas,
  chofer,
  regTransporte,
  cultivoNombre,
  cantidadTarimas,
  lineas,
}: {
  serie: string;
  folio: string;
  fecha: string; // YYYY-MM-DD
  campoNombre: string;
  distribuidor: string;
  distribuidorDireccion: string;
  distribuidorCiudad: string;
  cajaTransporte: string;
  placas: string;
  chofer: string;
  regTransporte: string;
  cultivoNombre: string;
  cantidadTarimas: number | null;
  lineas: LineaManifiesto[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = 216;
  const marginX = 12;
  const rightColX = 158;

  const [anio, mes, dia] = fecha.split("-");
  const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const mesTexto = MESES[parseInt(mes, 10) - 1] ?? mes;

  const totalCajas = lineas.reduce((s, l) => s + l.cajas, 0);
  const totalTarimas = cantidadTarimas ?? 0;

  let y = 14;

  // ---- Encabezado ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("AGROEXPORT DE SONORA , S.A. DE C.V", marginX, y);
  y += 5;
  doc.setFontSize(8.5);
  doc.text("R.F.C. ACO100902U59 CTA. EST. 61026-3 CENTRO DE PRODUCCION", marginX, y);

  // Caja "LISTA DE EMPAQUE" arriba a la derecha -- una sola caja, con
  // 3 secciones apiladas: titulo, serie/folio, y fecha (sin encimarse)
  const boxTop = 10;
  const boxW = 46;
  const boxH = 34;
  doc.rect(rightColX, boxTop, boxW, boxH);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("LISTA DE EMPAQUE", rightColX + boxW / 2, boxTop + 5, { align: "center" });
  doc.line(rightColX, boxTop + 7, rightColX + boxW, boxTop + 7);

  doc.setFontSize(13);
  doc.text(serie, rightColX + boxW * 0.28, boxTop + 15, { align: "center" });
  doc.text(folio, rightColX + boxW * 0.72, boxTop + 15, { align: "center" });
  doc.line(rightColX + boxW / 2, boxTop + 7, rightColX + boxW / 2, boxTop + 18);
  doc.line(rightColX, boxTop + 18, rightColX + boxW, boxTop + 18);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("EXPEDIDA EN HERMOSILLO, SONORA.", rightColX + boxW / 2, boxTop + 21.5, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("FECHA", rightColX + boxW / 2, boxTop + 25.5, { align: "center" });
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("DIA", rightColX + boxW * 0.2, boxTop + 28.5, { align: "center" });
  doc.text("MES", rightColX + boxW * 0.5, boxTop + 28.5, { align: "center" });
  doc.text("AÑO", rightColX + boxW * 0.8, boxTop + 28.5, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`${dia}   ${mesTexto}   ${anio}`, rightColX + boxW / 2, boxTop + 32, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("OFICINA MATRIZ Y DOMICILIO FISCAL", marginX, y);
  doc.text(`CAMPO ${campoNombre.toUpperCase()}`, marginX + 70, y);
  doc.setFont("helvetica", "normal");
  y += 4;
  doc.text("GARMENDIA # 46 Esq. Tamaulipas", marginX, y);
  doc.text("Carretera a Bahia de Kino Km. 42", marginX + 70, y);
  y += 4;
  doc.text("Tel (662)210-13-71, 214-89-11 Fax 214-58-99", marginX, y);
  doc.text("Costa de Hermosillo Hermosillo,", marginX + 70, y);
  y += 4;
  doc.text("Hermosillo, Sonora, México", marginX, y);
  doc.text("Sonora, México", marginX + 70, y);

  y += 8;

  // ---- Cliente ----
  const clienteTop = y;
  doc.rect(marginX, clienteTop, pageW - marginX * 2, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CLIENTE", pageW / 2, clienteTop + 5, { align: "center" });
  doc.line(marginX, clienteTop + 7, pageW - marginX, clienteTop + 7);
  doc.setFontSize(8.5);
  doc.text(`NOMBRE:`, marginX + 2, clienteTop + 12);
  doc.setFont("helvetica", "normal");
  doc.text(distribuidor.toUpperCase(), marginX + 22, clienteTop + 12);
  doc.setFont("helvetica", "bold");
  doc.text("R.F.C.", marginX + 130, clienteTop + 12);
  doc.text("DIRECCION:", marginX + 2, clienteTop + 17);
  doc.setFont("helvetica", "normal");
  doc.text(distribuidorDireccion.toUpperCase(), marginX + 24, clienteTop + 17);
  doc.setFont("helvetica", "bold");
  doc.text("CIUDAD:", marginX + 2, clienteTop + 22);
  doc.setFont("helvetica", "normal");
  doc.text(distribuidorCiudad.toUpperCase(), marginX + 20, clienteTop + 22);

  y = clienteTop + 24 + 4;

  // ---- Tabla ----
  const tableTop = y;
  const colCantidadW = 22;
  const colDescW = 100;
  const colParcialW = 25;
  const colImporteW = pageW - marginX * 2 - colCantidadW - colDescW - colParcialW;
  const tableW = pageW - marginX * 2;
  const rowH = 6;
  const numFilasVacias = 2;

  doc.rect(marginX, tableTop, tableW, rowH);
  doc.setFontSize(8.5);
  doc.text("CANTIDAD", marginX + colCantidadW / 2, tableTop + 4, { align: "center" });
  doc.text("DESCRIPCION", marginX + colCantidadW + colDescW / 2, tableTop + 4, { align: "center" });
  doc.text("PARCIAL", marginX + colCantidadW + colDescW + colParcialW / 2, tableTop + 4, { align: "center" });
  doc.text("IMPORTE", marginX + colCantidadW + colDescW + colParcialW + colImporteW / 2, tableTop + 4, { align: "center" });

  let filaY = tableTop + rowH;
  doc.setFont("helvetica", "normal");
  for (const l of lineas) {
    doc.line(marginX, filaY, marginX + tableW, filaY);
    const caja = CAJA_POR_DISTRIBUIDOR[distribuidor] ?? "CAJA";
    const desc = `${cultivoNombre.toUpperCase()} CALIBRE ${l.calibreNombre} ${caja}, ${PESO_POR_CAJA_LBS} LBS`;
    const desc2 = `LBS ETIQUETA ${distribuidor.toUpperCase()}`;
    doc.setFontSize(8);
    doc.text(String(l.cajas), marginX + colCantidadW / 2, filaY + 4, { align: "center" });
    doc.text(desc, marginX + colCantidadW + colDescW / 2, filaY + 4, { align: "center" });
    doc.text(desc2, marginX + colCantidadW + colDescW / 2, filaY + 4 + 4, { align: "center" });
    filaY += rowH * 2;
  }
  for (let i = 0; i < numFilasVacias; i++) {
    doc.line(marginX, filaY, marginX + tableW, filaY);
    filaY += rowH;
  }

  // Lineas verticales y marco exterior, ya con la altura real de la
  // tabla (algunas filas ocupan 2 renglones, por eso se calculan hasta
  // el final en vez de adivinar antes)
  const tableBottom = filaY;
  doc.line(marginX + colCantidadW, tableTop, marginX + colCantidadW, tableBottom);
  doc.line(marginX + colCantidadW + colDescW, tableTop, marginX + colCantidadW + colDescW, tableBottom);
  doc.line(
    marginX + colCantidadW + colDescW + colParcialW,
    tableTop,
    marginX + colCantidadW + colDescW + colParcialW,
    tableBottom
  );
  doc.rect(marginX, tableTop, tableW, tableBottom - tableTop);

  y = filaY + 6;

  // ---- Bloque de retorno/transporte, DEBAJO de la tabla ----
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`SE RETORNAN ${totalCajas} CAJAS`, marginX, y);
  y += 4;
  doc.text(`REG TRANSP. ${regTransporte || "-"}`, marginX, y);
  y += 4;
  doc.text(`CAMION: ${cajaTransporte || "-"}`, marginX, y);
  y += 4;
  doc.text(`PLACAS: ${placas || "-"}`, marginX, y);
  y += 4;
  doc.text(`CHOFER : ${chofer || "-"}`, marginX, y);
  y += 6;

  // ---- Texto legal ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const legal =
    "MANIFESTAMOS BAJO PROMESA DE DECIR VERDAD QUE LA PRESENTE OPERACIÓN NO SE TRATA DE UNA " +
    "ENAJENACIÓN EN LOS TERMINOS DEL ARTICULO 14 DE C.F.F. TODA VEZ QUE LA PRESENTE MERCANCIA VA " +
    "EN CONSIGNACIÓN";
  const legalLines = doc.splitTextToSize(legal, tableW);
  doc.text(legalLines, pageW / 2, y, { align: "center" });
  y += legalLines.length * 4 + 3;

  // ---- Totales (pegados a la derecha) ----
  const totalesLabelX = pageW - marginX - 63; // 63 = labelW(38) + valueW(25)
  const totalesValueX = pageW - marginX - 25;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("CANTIDAD CON LETRA:", marginX, y);
  doc.rect(totalesLabelX, y - 4, 38, 6);
  doc.text("SUB-TOTAL", totalesLabelX + 1, y);
  doc.rect(totalesValueX, y - 4, 25, 6);
  doc.text("0,000.00", totalesValueX + 12.5, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("SON:", marginX + 5, y);
  doc.setFont("helvetica", "normal");
  doc.text(numeroATexto(0), marginX + 20, y);
  doc.rect(totalesLabelX, y - 4, 38, 6);
  doc.text("TASA IVA 0%", totalesLabelX + 1, y);
  y += 6;
  doc.rect(totalesLabelX, y - 4, 38, 6);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", totalesLabelX + 1, y);
  doc.rect(totalesValueX, y - 4, 25, 6);
  doc.text("0,000.00", totalesValueX + 12.5, y, { align: "center" });

  y += 12;

  // ---- Sello fiscal (abajo a la izquierda) ----
  const selloW = 38;
  const selloH = (selloW * 173) / 323;
  doc.addImage(SELLO_MANIFIESTO_PNG, "PNG", marginX, y - 16, selloW, selloH);

  // ---- Firma y tarimas ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.line(marginX + 60, y, marginX + 120, y);
  doc.text("FIRMA", marginX + 84, y + 4);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(String(Math.round(totalTarimas)), rightColX + 20, y - 4);
  doc.setFontSize(7);
  doc.text("Cantidad de tarimas entregadas", rightColX - 10, y + 2);

  doc.save(`manifiesto_${serie}${folio}_${distribuidor.replace(/\s+/g, "_")}_${fecha}_${Date.now()}.pdf`);
}
