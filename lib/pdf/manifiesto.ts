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

// REG TRANSP. nunca cambia -- se imprime siempre este valor sin importar
// lo que se haya capturado en la remisión.
const REG_TRANSPORTE_FIJO = "SCAC -ATJV CAAT 1636 FDA 11511915174";

// Libras por caja de Pepino, segun el calibre/presentacion. Se busca por
// nombre normalizado (sin espacios, apostrofes ni mayusculas/minusculas)
// para no depender de como esta escrito exactamente en el catalogo.
const LBS_PEPINO_POR_CALIBRE: Record<string, number> = {
  superselect: 55,
  selectos: 55,
  large: 55,
  small: 55,
  plain: 55,
  "42s": 28,
  "36s": 28,
  "24s": 24,
  "54s": 38,
  "24srpc": 26,
  "36srpc": 28,
  sselectowmrpc: 55,
  sselectoloblawrpc: 55,
};

function normalizarCalibre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9]/g, ""); // quita espacios, apostrofes, puntos, etc.
}

function pesoPorCaja(cultivoNombre: string, calibreNombre: string): number {
  const cultivo = cultivoNombre.toLowerCase();
  if (cultivo.includes("pepino")) {
    const clave = normalizarCalibre(calibreNombre);
    return LBS_PEPINO_POR_CALIBRE[clave] ?? PESO_POR_CAJA_LBS;
  }
  return PESO_POR_CAJA_LBS; // Sandia (y cualquier otro) siempre 35
}

function numeroATexto(n: number): string {
  // Para "SON:" -- como siempre es consignacion, el monto es cero.
  return "CERO DOLARES 00/100 U.S.Cy.";
}

export type LineaManifiesto = {
  cajas: number;
  calibreNombre: string;
  cajasPorPallet: number | null;
  variedad?: string;
};

export type TarimaManifiesto = { tipo: string; cantidad: number };

export function generarPdfManifiesto({
  serie,
  folio,
  fecha,
  campoNombre,
  cuadroNombre,
  distribuidor,
  distribuidorDireccion,
  distribuidorCiudad,
  cajaTransporte,
  placas,
  chofer,
  cultivoNombre,
  lineas,
  tarimas,
}: {
  serie: string;
  folio: string;
  fecha: string; // YYYY-MM-DD
  campoNombre: string;
  cuadroNombre?: string;
  distribuidor: string;
  distribuidorDireccion: string;
  distribuidorCiudad: string;
  cajaTransporte: string;
  placas: string;
  chofer: string;
  cultivoNombre: string;
  lineas: LineaManifiesto[];
  tarimas?: TarimaManifiesto[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = 216;
  const marginX = 12;
  const rightColX = 158;

  const [anio, mes, dia] = fecha.split("-");
  const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const mesTexto = MESES[parseInt(mes, 10) - 1] ?? mes;

  const totalCajas = lineas.reduce((s, l) => s + l.cajas, 0);

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
  const etiquetaCampo = cuadroNombre
    ? `CAMPO ${campoNombre.toUpperCase()}   WORK ORDER: ${cuadroNombre.toUpperCase()}`
    : `CAMPO ${campoNombre.toUpperCase()}`;
  doc.text(etiquetaCampo, marginX + 70, y);
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
    const peso = pesoPorCaja(cultivoNombre, l.calibreNombre);
    const nombreLinea = l.variedad ? `${cultivoNombre} ${l.variedad}` : cultivoNombre;
    const desc = `${nombreLinea.toUpperCase()} CALIBRE ${l.calibreNombre} ${caja}, ${peso} LBS`;
    const desc2 = `ETIQUETA ${distribuidor.toUpperCase()}`;
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

  // Las lineas verticales (separadores de columna) se dibujan AL FINAL, ya
  // con la altura real de la tabla (cada linea de detalle ocupa 2 renglones,
  // no 1) -- antes se calculaban con una altura mas chica y por eso a partir
  // de la 2da/3ra linea de detalle se veian filas sin separador vertical.
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
  doc.text(`REG TRANSP. ${REG_TRANSPORTE_FIJO}`, marginX, y);
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

  const totalBottomY = y + 2; // borde inferior del recuadro "TOTAL"

  y += 12;

  // ---- Sello fiscal (abajo a la izquierda) ----
  const selloW = 38;
  const selloH = (selloW * 173) / 323;
  doc.addImage(SELLO_MANIFIESTO_PNG, "PNG", marginX, y - 16, selloW, selloH);

  // ---- Firma ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.line(marginX + 60, y, marginX + 120, y);
  doc.text("FIRMA", marginX + 84, y + 4);

  // ---- Tarimas entregadas: 1.5cm debajo del borde inferior del recuadro
  // "TOTAL", para que nunca se encime con los totales de arriba ----
  const tarimasValidas = (tarimas ?? []).filter((t) => t.tipo && t.cantidad > 0);
  const tarimasX = rightColX - 10;
  let ty = totalBottomY + 15;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("TARIMAS ENTREGADAS", tarimasX, ty);
  doc.setFont("helvetica", "normal");
  ty += 5.5;
  if (tarimasValidas.length === 0) {
    doc.setFontSize(9);
    doc.text("—", tarimasX, ty);
  } else {
    doc.setFontSize(9);
    for (const t of tarimasValidas) {
      doc.text(`${t.tipo}: ${t.cantidad}`, tarimasX, ty);
      ty += 5;
    }
  }

  doc.save(`manifiesto_${serie}${folio}_${distribuidor.replace(/\s+/g, "_")}_${fecha}.pdf`);
}
