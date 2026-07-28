import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FilaResumen } from "@/lib/excel/reporteNominas";

type NodoActividadSimple = { nombre: string; registros: number; total: number };
type NodoCuadro = {
  nombre: string;
  hectareas: number | null;
  total: number;
  actividades: NodoActividadSimple[];
};
type NodoCampoPorCuadro = {
  nombre: string;
  hectareas: number | null;
  total: number;
  cuadros: NodoCuadro[];
};

type NodoCuadroSimple = { nombre: string; registros: number; total: number; hectareas: number | null };
type NodoActividad = {
  nombre: string;
  total: number;
  cuadros: NodoCuadroSimple[];
};
type NodoCampoPorActividad = {
  nombre: string;
  hectareas: number | null;
  total: number;
  actividades: NodoActividad[];
};

const ALTO_PAGINA = 280;

export function generarPdfReporteNominas({
  porCampo,
  porCuadro,
  porActividad,
  jerarquia,
  jerarquiaPorActividad,
  rango,
  granTotal,
}: {
  porCampo: FilaResumen[];
  porCuadro: FilaResumen[];
  porActividad: FilaResumen[];
  jerarquia: NodoCampoPorCuadro[];
  jerarquiaPorActividad: NodoCampoPorActividad[];
  rango: string;
  granTotal: number;
}) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(14);
  doc.text("Agroexport de Sonora", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Reporte de costo - Nominas (${rango})`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Total del periodo: $${granTotal.toFixed(2)}`, 14, y);
  y += 6;

  function tabla(titulo: string, filas: FilaResumen[], conHectareas: boolean) {
    doc.setFontSize(10);
    doc.text(titulo, 14, y);
    const head = conHectareas
      ? [["Nombre", "Total", "Hectáreas", "Costo/ha"]]
      : [["Nombre", "Total"]];
    const body = filas.map((f) => {
      const base = [f.nombre, `$${f.total.toFixed(2)}`];
      if (conHectareas) {
        base.push(f.hectareas ? String(f.hectareas) : "—");
        base.push(
          f.hectareas && f.hectareas > 0
            ? `$${(f.total / f.hectareas).toFixed(2)}`
            : "—"
        );
      }
      return base;
    });

    autoTable(doc, {
      startY: y + 3,
      head,
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [92, 140, 58] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  tabla("Costo por campo", porCampo, true);
  tabla("Costo por cuadro", porCuadro, true);
  tabla("Costo por actividad", porActividad, true);

  function saltoDePaginaSiHaceFalta(margen = 20) {
    if (y > ALTO_PAGINA - margen) {
      doc.addPage();
      y = 16;
    }
  }

  // --- Desglose por campo: Cuadros -----------------------------------
  doc.addPage();
  y = 16;
  doc.setFontSize(12);
  doc.text("Desglose por campo: Cuadros", 14, y);
  y += 8;

  for (const campo of jerarquia) {
    saltoDePaginaSiHaceFalta(16);
    doc.setFillColor(224, 236, 211); // campo-100
    doc.rect(12, y - 4, 186, 7, "F");
    doc.setFontSize(9.5);
    doc.setTextColor(41, 58, 29); // campo-900
    const haTxt = campo.hectareas ? `${campo.hectareas} ha` : "—";
    doc.text(
      `${campo.nombre}   |   Total: $${campo.total.toFixed(2)}   |   ${haTxt}`,
      14,
      y
    );
    doc.setTextColor(0, 0, 0);
    y += 8;

    for (const cuadro of campo.cuadros) {
      saltoDePaginaSiHaceFalta(24);
      doc.setFontSize(8.5);
      const haCuadro = cuadro.hectareas ? `${cuadro.hectareas} ha` : "—";
      const costoHa =
        cuadro.hectareas && cuadro.hectareas > 0
          ? `$${(cuadro.total / cuadro.hectareas).toFixed(2)}/ha`
          : "—";
      doc.text(
        `  Cuadro ${cuadro.nombre}  —  Total: $${cuadro.total.toFixed(2)}  —  ${haCuadro}  —  ${costoHa}`,
        14,
        y
      );
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: 20 },
        head: [["Actividad", "Gasto", "Gasto/ha"]],
        body: cuadro.actividades.map((a) => [
          a.nombre,
          `$${a.total.toFixed(2)}`,
          cuadro.hectareas && cuadro.hectareas > 0
            ? `$${(a.total / cuadro.hectareas).toFixed(2)}`
            : "—",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [156, 194, 172] },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
    y += 3;
  }

  // --- Desglose por campo: Actividades --------------------------------
  doc.addPage();
  y = 16;
  doc.setFontSize(12);
  doc.text("Desglose por campo: Actividades", 14, y);
  y += 8;

  for (const campo of jerarquiaPorActividad) {
    saltoDePaginaSiHaceFalta(16);
    doc.setFillColor(224, 236, 211);
    doc.rect(12, y - 4, 186, 7, "F");
    doc.setFontSize(9.5);
    doc.setTextColor(41, 58, 29);
    const haTxt = campo.hectareas ? `${campo.hectareas} ha` : "—";
    doc.text(
      `${campo.nombre}   |   Total: $${campo.total.toFixed(2)}   |   ${haTxt}`,
      14,
      y
    );
    doc.setTextColor(0, 0, 0);
    y += 8;

    for (const actividad of campo.actividades) {
      saltoDePaginaSiHaceFalta(24);
      doc.setFontSize(8.5);
      doc.text(
        `  ${actividad.nombre}  —  Total: $${actividad.total.toFixed(2)}`,
        14,
        y
      );
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: 20 },
        head: [["Cuadro", "Gasto", "Gasto/ha"]],
        body: actividad.cuadros.map((c) => [
          c.nombre,
          `$${c.total.toFixed(2)}`,
          c.hectareas && c.hectareas > 0
            ? `$${(c.total / c.hectareas).toFixed(2)}`
            : "—",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [156, 194, 172] },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
    y += 3;
  }

  doc.save(`reporte_nominas_${rango}.pdf`);
}
