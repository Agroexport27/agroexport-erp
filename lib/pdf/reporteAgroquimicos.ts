import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type NodoProducto = { nombre: string; cantidad: number; unidad: string };
type NodoCuadro1 = { nombre: string; productos: NodoProducto[] };
type NodoCampo1 = { nombre: string; cuadros: NodoCuadro1[] };

type NodoCuadro2 = { nombre: string; cantidad: number; unidad: string };
type NodoProducto2 = { nombre: string; total: number; cuadros: NodoCuadro2[] };
type NodoCampo2 = { nombre: string; productos: NodoProducto2[] };

const ALTO_PAGINA = 280;

export function generarPdfReporteAgroquimicos({
  rango,
  jerarquiaCuadroProducto,
  jerarquiaProductoCuadro,
}: {
  rango: string;
  jerarquiaCuadroProducto: NodoCampo1[];
  jerarquiaProductoCuadro: NodoCampo2[];
}) {
  const doc = new jsPDF();
  let y = 16;

  function saltoDePaginaSiHaceFalta(margen = 20) {
    if (y > ALTO_PAGINA - margen) {
      doc.addPage();
      y = 16;
    }
  }

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Reporte de agroquimicos (${rango})`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Desglose por campo: Cuadros > Productos", 14, y);
  y += 8;

  for (const campo of jerarquiaCuadroProducto) {
    saltoDePaginaSiHaceFalta(16);
    doc.setFillColor(224, 236, 211);
    doc.rect(12, y - 4, 186, 7, "F");
    doc.setFontSize(9.5);
    doc.setTextColor(41, 58, 29);
    doc.text(campo.nombre, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    for (const cuadro of campo.cuadros) {
      saltoDePaginaSiHaceFalta(24);
      doc.setFontSize(8.5);
      doc.text(`  ${cuadro.nombre}`, 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: 20 },
        head: [["Producto", "Cantidad"]],
        body: cuadro.productos.map((p) => [p.nombre, `${p.cantidad.toFixed(2)} ${p.unidad}`]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [156, 194, 172] },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
    y += 3;
  }

  doc.addPage();
  y = 16;
  doc.setFontSize(12);
  doc.text("Desglose por campo: Productos > Cuadros", 14, y);
  y += 8;

  for (const campo of jerarquiaProductoCuadro) {
    saltoDePaginaSiHaceFalta(16);
    doc.setFillColor(224, 236, 211);
    doc.rect(12, y - 4, 186, 7, "F");
    doc.setFontSize(9.5);
    doc.setTextColor(41, 58, 29);
    doc.text(campo.nombre, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    for (const producto of campo.productos) {
      saltoDePaginaSiHaceFalta(24);
      doc.setFontSize(8.5);
      doc.text(`  ${producto.nombre} — Total: ${producto.total.toFixed(2)}`, 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: 20 },
        head: [["Cuadro", "Cantidad"]],
        body: producto.cuadros.map((c) => [c.nombre, `${c.cantidad.toFixed(2)} ${c.unidad}`]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [156, 194, 172] },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
    y += 3;
  }

  doc.save(`reporte_agroquimicos_${rango}.pdf`);
}
