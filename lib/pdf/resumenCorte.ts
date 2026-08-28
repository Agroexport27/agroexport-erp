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

const TAMANOS_BASE = ["6", "8", "9", "11"];
function tamanoDeCalibre(nombreCalibre: string): string | null {
  const n = nombreCalibre.trim().toUpperCase();
  if (n === "M 9" || n === "M9") return "9";
  if (n === "8 COS" || n === "FT 8C") return "8";
  if (n === "6 J" || n === "6 JXL" || n === "4D COS" || n === "4 D") return "6";
  if (TAMANOS_BASE.includes(n)) return n;
  return null;
}

function construirResumenTamanos(filas: FilaCorteDetalle[]) {
  const cajasPorTamano: Record<string, number> = {};
  let totalConTamano = 0;
  for (const f of filas) {
    if (f.tipoUnidad !== "pallet") continue;
    const tamano = tamanoDeCalibre(f.calibreNombre);
    if (!tamano) continue;
    cajasPorTamano[tamano] = (cajasPorTamano[tamano] ?? 0) + f.cajas;
    totalConTamano += f.cajas;
  }
  return TAMANOS_BASE.map((t) => ({
    tamano: t,
    cajas: cajasPorTamano[t] ?? 0,
    porcentaje: totalConTamano > 0 ? ((cajasPorTamano[t] ?? 0) / totalConTamano) * 100 : 0,
  }));
}

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
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const resumenTamanos = construirResumenTamanos(filas);
  doc.setFontSize(10);
  doc.text("% por tamaño", 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Tamaño", "Cajas", "%"]],
    body: resumenTamanos.map((t) => [t.tamano, t.cajas > 0 ? t.cajas.toFixed(0) : "-", `${t.porcentaje.toFixed(1)}%`]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [92, 140, 58] },
    tableWidth: 80,
  });
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

  doc.save(`corte_${campo.replace(/\s+/g, "_")}_${fecha}_${Date.now()}.pdf`);
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
  doc.save(`corte_${distribuidor.replace(/\s+/g, "_")}_${campo.replace(/\s+/g, "_")}_${fecha}_${Date.now()}.pdf`);
}
