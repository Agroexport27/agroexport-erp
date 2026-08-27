import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FilaCorteDetalle = {
  cuadro: string;
  distribuidor: string;
  calibreId: string;
  calibreNombre: string;
  tipoUnidad: "pallet" | "bins";
  unidades: number;
  cajas: number;
};

export type CalibreCol = { id: string; nombre: string; orden: number };

function dibujarTablaDistribuidor(
  doc: jsPDF,
  campo: string,
  fecha: string,
  distribuidor: string,
  filas: FilaCorteDetalle[],
  calibresCaja: CalibreCol[],
  calibresBin: CalibreCol[]
) {
  doc.setFontSize(13);
  doc.text("Agroexport de Sonora", 14, 14);
  doc.setFontSize(11);
  doc.text(`Corte del día — ${campo} — ${fecha}`, 14, 21);
  doc.setFontSize(12);
  doc.text(distribuidor, 14, 28);

  const cuadros = Array.from(new Set(filas.map((f) => f.cuadro))).sort();

  const head = [
    ["Cuadro", ...calibresCaja.map((c) => c.nombre)],
  ];
  const body = cuadros.map((cuadro) => [
    cuadro,
    ...calibresCaja.map((c) => {
      const f = filas.find((x) => x.cuadro === cuadro && x.calibreId === c.id && x.tipoUnidad === "pallet");
      return f ? `${f.unidades}p / ${f.cajas}c` : "";
    }),
  ]);
  const totalPorCalibre = calibresCaja.map((c) =>
    filas.filter((f) => f.calibreId === c.id && f.tipoUnidad === "pallet").reduce((s, f) => s + f.cajas, 0)
  );
  const totalGeneral = totalPorCalibre.reduce((s, t) => s + t, 0);

  autoTable(doc, {
    startY: 33,
    head,
    body,
    foot: [["TOTAL CAJAS", ...totalPorCalibre.map((t) => (t > 0 ? String(t) : ""))]],
    styles: { fontSize: 7.5, halign: "center" },
    columnStyles: { 0: { halign: "left" } },
    headStyles: { fillColor: [92, 140, 58], fontSize: 7 },
    footStyles: { fillColor: [240, 226, 206], textColor: [61, 61, 58] },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(10);
  doc.text(`Total del distribuidor: ${totalGeneral.toFixed(0)} cajas`, 14, y);
  y += 8;

  const calibresBinConDatos = calibresBin.filter((c) =>
    filas.some((f) => f.calibreId === c.id && f.tipoUnidad === "bins")
  );
  if (calibresBinConDatos.length > 0) {
    doc.setFontSize(10);
    doc.text("Bins", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Cuadro", ...calibresBinConDatos.map((c) => c.nombre)]],
      body: cuadros
        .map((cuadro) => [
          cuadro,
          ...calibresBinConDatos.map((c) => {
            const f = filas.find((x) => x.cuadro === cuadro && x.calibreId === c.id && x.tipoUnidad === "bins");
            return f ? `${f.unidades}b / ${f.cajas}c` : "";
          }),
        ])
        .filter((fila) => fila.slice(1).some((v) => v !== "")),
      styles: { fontSize: 7.5, halign: "center" },
      columnStyles: { 0: { halign: "left" } },
      headStyles: { fillColor: [92, 140, 58], fontSize: 7 },
    });
  }
}

export function generarPdfResumenCorte({
  fecha,
  campo,
  filas,
  calibresCaja,
  calibresBin,
}: {
  fecha: string;
  campo: string;
  filas: FilaCorteDetalle[];
  calibresCaja: CalibreCol[];
  calibresBin: CalibreCol[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });

  dibujarTablaDistribuidor(doc, campo, fecha, "RESUMEN GENERAL — TODOS LOS DISTRIBUIDORES", filas, calibresCaja, calibresBin);

  const distribuidores = Array.from(new Set(filas.map((f) => f.distribuidor)));
  for (const dist of distribuidores) {
    doc.addPage();
    dibujarTablaDistribuidor(doc, campo, fecha, dist, filas.filter((f) => f.distribuidor === dist), calibresCaja, calibresBin);
  }

  doc.save(`corte_${campo.replace(/\s+/g, "_")}_${fecha}.pdf`);
}

// Un PDF individual para un solo distribuidor (para mandarle nada mas
// lo suyo por correo, sin ver los demas)
export function generarPdfResumenCorteUnDistribuidor({
  fecha,
  campo,
  distribuidor,
  filas,
  calibresCaja,
  calibresBin,
}: {
  fecha: string;
  campo: string;
  distribuidor: string;
  filas: FilaCorteDetalle[];
  calibresCaja: CalibreCol[];
  calibresBin: CalibreCol[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  dibujarTablaDistribuidor(doc, campo, fecha, distribuidor, filas, calibresCaja, calibresBin);
  doc.save(`corte_${distribuidor.replace(/\s+/g, "_")}_${campo.replace(/\s+/g, "_")}_${fecha}.pdf`);
}
