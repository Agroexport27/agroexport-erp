import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EMPRESA, dinero, fechaMx } from "@/lib/administrativo";

export type OrdenCompraPdf = {
  folio: string;
  fecha: string;
  estatus: string;
  solicitudFolio?: string | null;
  proveedor: { nombre: string; rfc?: string | null; contacto?: string | null; direccion?: string | null };
  solicitante?: string | null;
  campo?: string | null;
  fechaEntrega?: string | null;
  lugarEntrega?: string | null;
  condicionesPago?: string | null;
  moneda: string;
  ivaPct: number;
  notas?: string | null;
  autorizo?: string | null;
  autorizoFecha?: string | null;
  lineas: { descripcion: string; cantidad: number; unidad: string; precio: number }[];
};

export function generarPdfOrdenCompra(oc: OrdenCompraPdf) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const verde: [number, number, number] = [92, 140, 58];

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(EMPRESA.nombre, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let yEmp = 21;
  for (const t of [EMPRESA.rfc && `RFC: ${EMPRESA.rfc}`, EMPRESA.direccion, EMPRESA.telefono && `Tel. ${EMPRESA.telefono}`]) {
    if (t) {
      doc.text(String(t), 14, yEmp);
      yEmp += 4;
    }
  }

  doc.setFillColor(...verde);
  doc.rect(W - 78, 10, 64, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ORDEN DE COMPRA", W - 46, 15.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Folio: ${oc.folio}`, W - 76, 24);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${fechaMx(oc.fecha)}`, W - 76, 29);
  if (oc.solicitudFolio) doc.text(`Solicitud: ${oc.solicitudFolio}`, W - 76, 34);
  doc.text(`Estatus: ${oc.estatus}`, W - 76, oc.solicitudFolio ? 39 : 34);

  // Proveedor / entrega
  const yBloque = 46;
  doc.setDrawColor(190);
  doc.rect(14, yBloque, (W - 32) / 2, 30);
  doc.rect(14 + (W - 32) / 2 + 4, yBloque, (W - 32) / 2, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PROVEEDOR", 16, yBloque + 4.5);
  doc.text("ENTREGA / CONDICIONES", 18 + (W - 32) / 2, yBloque + 4.5);
  doc.setFont("helvetica", "normal");
  const col1 = [
    oc.proveedor.nombre || "—",
    oc.proveedor.rfc ? `RFC: ${oc.proveedor.rfc}` : "",
    oc.proveedor.contacto ? `Contacto: ${oc.proveedor.contacto}` : "",
    oc.proveedor.direccion ?? "",
  ].filter(Boolean);
  doc.setFontSize(9);
  let y1 = yBloque + 10;
  for (const t of col1) {
    const lineas = doc.splitTextToSize(String(t), (W - 32) / 2 - 6);
    doc.text(lineas, 16, y1);
    y1 += 4.2 * lineas.length;
  }
  const col2 = [
    `Entrega: ${oc.fechaEntrega ? fechaMx(oc.fechaEntrega) : "—"}`,
    oc.lugarEntrega ? `Lugar: ${oc.lugarEntrega}` : "",
    `Pago: ${oc.condicionesPago || "—"}`,
    oc.campo ? `Campo: ${oc.campo}` : "",
    oc.solicitante ? `Solicita: ${oc.solicitante}` : "",
  ].filter(Boolean);
  let y2 = yBloque + 10;
  for (const t of col2) {
    const lineas = doc.splitTextToSize(String(t), (W - 32) / 2 - 6);
    doc.text(lineas, 18 + (W - 32) / 2, y2);
    y2 += 4.2 * lineas.length;
  }

  // Conceptos
  const subtotal = oc.lineas.reduce((s, l) => s + l.cantidad * l.precio, 0);
  const iva = subtotal * (oc.ivaPct / 100);
  const total = subtotal + iva;
  const fmt = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  autoTable(doc, {
    startY: yBloque + 35,
    head: [["#", "Descripción", "Cantidad", "Unidad", "Precio unit.", "Importe"]],
    body: oc.lineas.map((l, i) => [
      String(i + 1),
      l.descripcion,
      l.cantidad.toLocaleString("es-MX"),
      l.unidad,
      fmt(l.precio),
      fmt(l.cantidad * l.precio),
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: verde },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { halign: "right", cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  if (y > 225) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(9);
  const xTot = W - 14 - 70;
  doc.text("Subtotal:", xTot, y);
  doc.text(dinero(subtotal, oc.moneda), W - 14, y, { align: "right" });
  doc.text(`IVA (${oc.ivaPct}%):`, xTot, y + 5);
  doc.text(dinero(iva, oc.moneda), W - 14, y + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", xTot, y + 11);
  doc.text(dinero(total, oc.moneda), W - 14, y + 11, { align: "right" });
  doc.setFont("helvetica", "normal");

  if (oc.notas) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(oc.notas, W - 100), 14, y + 4);
  }

  // Firmas
  let yF = Math.max(y + 32, 235);
  if (yF > 255) {
    doc.addPage();
    yF = 40;
  }
  doc.setDrawColor(120);
  const ancho = (W - 28 - 20) / 3;
  const firmas = [
    { rol: "Solicitó", nombre: oc.solicitante ?? "" },
    { rol: "Autorizó", nombre: oc.autorizo ? `${oc.autorizo}${oc.autorizoFecha ? `\n${fechaMx(oc.autorizoFecha)}` : ""}` : "" },
    { rol: "Recibe / Proveedor", nombre: "" },
  ];
  firmas.forEach((f, i) => {
    const x = 14 + i * (ancho + 10);
    doc.line(x, yF, x + ancho, yF);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(f.rol, x + ancho / 2, yF + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    if (f.nombre) doc.text(f.nombre.split("\n"), x + ancho / 2, yF + 8, { align: "center" });
  });

  doc.save(`${oc.folio}.pdf`);
}
