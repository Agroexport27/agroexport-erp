// Excel del Acumulado de Sandía Mini con la MISMA estructura del formato
// "PROD. CONSOLIDADO SANDIAS DL MINIS": una hoja por campo (cuadros en
// columnas, días hacia abajo, Cajas / Bins / Total / Acum. x Sem., columnas
// por distribuidor, totales, cajas por ha, cortes, resumen por variedad y
// % de calibres) y una hoja "x DISTRIB" con el consolidado por día.
//
// Se usa ExcelJS (y no xlsx) porque necesitamos colores, bordes, celdas
// combinadas y fórmulas vivas como en el archivo de ejemplo.

type Registro = {
  fecha: string;
  cajas: number | string | null;
  tipo_unidad?: string | null;
  cuadro_id: string;
  cuadros?: { nombre?: string; campo_id?: string; campos?: { nombre?: string } | null } | null;
  distribuidores?: { nombre?: string } | null;
  calibres?: { nombre?: string } | null;
};

type CuadroPlantado = { cuadroId: string; nombre: string; campoId: string; variedad: string; hectareas: number };

const VERDE = "FFEAF1DD";
const AZUL = "FFC6D9F0";
const AZUL_OSC = "FF95B3D7";
const NARANJA = "FFFDE9D9";
const AMARILLO = "FFFFFF00";

const MEDIO = { style: "medium" as const };
const FINO = { style: "thin" as const };

function letra(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function aFecha(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function aIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function sumarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function esBins(r: Registro) {
  return (r.tipo_unidad ?? "") === "bins";
}

function ordenNumerico(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}


// ---- Resultados en caché de las fórmulas ----
// ExcelJS escribe las fórmulas SIN su resultado: Excel las calcula al abrir,
// pero la Vista Protegida (archivo recién descargado), el visor del celular,
// Vista previa, etc. no recalculan y muestran las celdas vacías. Aquí
// evaluamos nosotros las fórmulas (solo usamos SUM, IFERROR, + - * /) y
// guardamos el resultado junto a la fórmula.
const EPOCH_MS = Date.UTC(1899, 11, 30);

function celdaNumero(ws: any, addr: string, memo: Map<string, number>): number {
  if (memo.has(addr)) return memo.get(addr)!;
  const v = ws.getCell(addr).value;
  let n = 0;
  if (v && typeof v === "object" && !(v instanceof Date) && "formula" in v) {
    memo.set(addr, 0); // evita ciclos
    n = evaluar(ws, String((v as any).formula), memo);
  } else if (v instanceof Date) {
    n = (v.getTime() - EPOCH_MS) / 86400000;
  } else if (typeof v === "number") {
    n = v;
  }
  memo.set(addr, n);
  return n;
}

function rangoCeldas(a: string, b: string): string[] {
  const pa = /^([A-Z]+)(\d+)$/.exec(a)!;
  const pb = /^([A-Z]+)(\d+)$/.exec(b)!;
  const aNum = (l: string) => l.split("").reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0);
  const c1 = aNum(pa[1]);
  const c2 = aNum(pb[1]);
  const out: string[] = [];
  for (let r = Number(pa[2]); r <= Number(pb[2]); r++) for (let c = c1; c <= c2; c++) out.push(letra(c) + r);
  return out;
}

function evaluar(ws: any, formula: string, memo: Map<string, number>): number {
  let expr = formula
    .replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/g, "S('$1|$2')")
    .replace(/IFERROR\((.*),0\)$/, "IFE(()=>($1))")
    .replace(/(?<![A-Z'|])([A-Z]{1,3})(\d+)(?![\d'|])/g, "R('$1$2')");
  const S = (rng: string) => {
    const [a, b] = rng.split("|");
    return rangoCeldas(a, b).reduce((acc, ad) => acc + celdaNumero(ws, ad, memo), 0);
  };
  const R = (ad: string) => celdaNumero(ws, ad, memo);
  const IFE = (f: () => number) => {
    const v = f();
    return Number.isFinite(v) ? v : 0;
  };
  try {
    const v = new Function("S", "R", "IFE", `return (${expr});`)(S, R, IFE);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function guardarResultados(libro: any) {
  libro.eachSheet((ws: any) => {
    const memo = new Map<string, number>();
    const pendientes: { cell: any; formula: string }[] = [];
    ws.eachRow((row: any) =>
      row.eachCell((cell: any) => {
        const v = cell.value;
        if (v && typeof v === "object" && !(v instanceof Date) && "formula" in v) {
          pendientes.push({ cell, formula: String((v as any).formula) });
        }
      })
    );
    for (const { cell, formula } of pendientes) {
      const n = evaluar(ws, formula, memo);
      const esFecha = typeof cell.numFmt === "string" && /d-mmm/.test(cell.numFmt);
      cell.value = { formula, result: esFecha ? new Date(EPOCH_MS + n * 86400000) : n };
    }
  });
}

function estilo(
  c: any,
  o: {
    size?: number;
    bold?: boolean;
    font?: string;
    color?: string;
    fill?: string;
    fmt?: string;
    h?: "center" | "left" | "right";
    border?: "fino" | "medio";
    wrap?: boolean;
  } = {}
) {
  c.font = { name: o.font ?? "Arial", size: o.size ?? 12, bold: !!o.bold, color: o.color ? { argb: o.color } : undefined };
  if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
  if (o.fmt) c.numFmt = o.fmt;
  c.alignment = { horizontal: o.h ?? "center", vertical: "middle", wrapText: !!o.wrap };
  const b = o.border === "medio" ? MEDIO : FINO;
  c.border = { top: b, left: b, bottom: b, right: b };
}

function hojaCampo(
  libro: any,
  campoNombre: string,
  regsCampo: Registro[],
  cuadros: CuadroPlantado[],
  cajasManual: Record<string, string>,
  cicloLabel: string,
  inicio: Date,
  dias: number,
  nombreHoja: string
) {
  const ws = libro.addWorksheet(nombreHoja, { views: [{ showGridLines: false, state: "frozen", ySplit: 8 }] });

  const nC = Math.max(cuadros.length, 1);
  const cCuadro0 = 3; // C
  const cCuadroN = cCuadro0 + nC - 1;
  const cGap1 = cCuadroN + 1;
  const cCajas = cGap1 + 1; // "Cajas"
  const cBins = cCajas + 1;
  const cTotal = cBins + 1;
  const cAcum = cTotal + 1;
  const cGap2 = cAcum + 1;
  const nombresDist = Array.from(new Set(regsCampo.map((r) => r.distribuidores?.nombre).filter(Boolean) as string[])).sort();
  const nD = Math.max(nombresDist.length, 1);
  const cDist0 = cGap2 + 1;
  const cDistN = cDist0 + nD - 1;
  const cTotDist = cDistN + 1;

  ws.getColumn(1).width = 1;
  ws.getColumn(2).width = 13.5;
  for (let c = cCuadro0; c <= cCuadroN; c++) ws.getColumn(c).width = 10.5;
  ws.getColumn(cGap1).width = 1.5;
  ws.getColumn(cCajas).width = 11.6;
  ws.getColumn(cBins).width = 10.7;
  ws.getColumn(cTotal).width = 11.5;
  ws.getColumn(cAcum).width = 10.7;
  ws.getColumn(cGap2).width = 1.7;
  for (let c = cDist0; c <= cDistN; c++) ws.getColumn(c).width = 11.5;
  ws.getColumn(cTotDist).width = 11.5;

  const alturas: Record<number, number> = { 1: 9.5, 2: 25.5, 3: 16, 4: 18, 5: 25, 6: 18, 7: 17.5, 8: 19.9 };
  for (const [r, h] of Object.entries(alturas)) ws.getRow(Number(r)).height = h;

  // ---- Fila 2: título + fecha de hoy ----
  const titulo = `${campoNombre.toUpperCase()}                 SANDIAS  MINIS  Exportacion     ${cicloLabel}                   ${campoNombre.toUpperCase()}`;
  ws.mergeCells(2, 2, 2, cAcum);
  estilo(ws.getCell(2, 2), { size: 16, bold: true, fill: VERDE, border: "medio" });
  ws.getCell(2, 2).value = titulo;
  ws.mergeCells(2, cDist0, 2, cTotDist);
  estilo(ws.getCell(2, cDist0), { size: 18, bold: true, color: "FFFF0000", fill: VERDE, fmt: "d-mmm", border: "medio" });
  const hoy = new Date();
  ws.getCell(2, cDist0).value = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  // ---- Encabezado de cuadros (filas 3 a 8) ----
  const etiquetas: Record<number, string> = { 3: "Fecha Plant,", 4: "Dias desde FP.", 5: "Variedad", 6: "D a Cosecha", 7: "Has", 8: "CUADRO" };
  for (const [r, t] of Object.entries(etiquetas)) {
    const c = ws.getCell(Number(r), 2);
    c.value = t;
    estilo(c, { font: "Cambria", size: Number(r) === 8 ? 12 : 11, bold: Number(r) === 8, fill: Number(r) === 8 ? VERDE : undefined, border: "medio" });
  }
  for (let i = 0; i < nC; i++) {
    const col = cCuadro0 + i;
    const cu = cuadros[i];
    for (let r = 3; r <= 8; r++) estilo(ws.getCell(r, col), { size: 12, border: "medio" });
    if (!cu) continue;
    const esAmarilla = /honey|amarilla/i.test(cu.variedad);
    // Fila 3 (fecha de plantación) y 4 (días desde FP) se llenan a mano.
    ws.getCell(3, col).numFmt = "d-mmm";
    estilo(ws.getCell(5, col), { size: 9, fill: esAmarilla ? AMARILLO : VERDE, border: "medio", wrap: true });
    ws.getCell(5, col).value = cu.variedad.toUpperCase();
    estilo(ws.getCell(7, col), { size: 14, fmt: "0.0", border: "medio" });
    ws.getCell(7, col).value = cu.hectareas;
    estilo(ws.getCell(8, col), { size: 14, bold: true, fmt: "@", border: "medio" });
    ws.getCell(8, col).value = cu.nombre;
  }

  // K5:K6 = total has
  ws.mergeCells(5, cCajas, 6, cCajas);
  estilo(ws.getCell(5, cCajas), { size: 16, bold: true, fmt: "#,##0.0", border: "medio" });
  ws.getCell(5, cCajas).value = { formula: `SUM(${letra(cCuadro0)}7:${letra(cCuadroN)}7)` };

  // Encabezados K..N y distribuidores
  const encabezadosK: [number, string, string][] = [
    [cCajas, "Cajas ", "Cajas "],
    [cBins, "Cajas ", "Bins"],
    [cTotal, "Total", "Cajas"],
    [cAcum, "Acum.", "x Sem."],
  ];
  for (const [col, a, b] of encabezadosK) {
    if (col === cCajas) {
      ws.mergeCells(7, col, 8, col);
      estilo(ws.getCell(7, col), { size: 14, border: "medio" });
      ws.getCell(7, col).value = "Cajas ";
      continue;
    }
    estilo(ws.getCell(7, col), { size: 14, border: "medio" });
    estilo(ws.getCell(8, col), { size: 14, border: "medio" });
    ws.getCell(7, col).value = a;
    ws.getCell(8, col).value = b;
  }
  for (let i = 0; i < nD; i++) {
    const col = cDist0 + i;
    ws.mergeCells(7, col, 8, col);
    estilo(ws.getCell(7, col), { size: 12, border: "medio", wrap: true });
    ws.getCell(7, col).value = nombresDist[i] ?? "";
  }
  ws.mergeCells(7, cTotDist, 8, cTotDist);
  estilo(ws.getCell(7, cTotDist), { size: 14, border: "medio" });
  ws.getCell(7, cTotDist).value = "Total";

  // ---- Datos por día ----
  const cuadroIdx = new Map<string, number>();
  cuadros.forEach((c, i) => cuadroIdx.set(c.cuadroId, i));
  type Dia = { cuadro: number[]; bins: number; dist: number[] };
  const porDia = new Map<string, Dia>();
  const binsPorCuadro = new Array(nC).fill(0);
  for (const r of regsCampo) {
    const d =
      porDia.get(r.fecha) ?? { cuadro: new Array(nC).fill(0), bins: 0, dist: new Array(nD).fill(0) };
    const cajas = Number(r.cajas ?? 0);
    const ci = cuadroIdx.get(r.cuadro_id);
    if (esBins(r)) {
      d.bins += cajas;
      if (ci != null) binsPorCuadro[ci] += cajas;
    } else if (ci != null) {
      d.cuadro[ci] += cajas;
    }
    const di = nombresDist.indexOf(r.distribuidores?.nombre ?? "");
    if (di >= 0) d.dist[di] += cajas;
    porDia.set(r.fecha, d);
  }

  const r0 = 9;
  const rUlt = r0 + dias - 1;
  for (let i = 0; i < dias; i++) {
    const r = r0 + i;
    const fecha = sumarDias(inicio, i);
    const iso = aIso(fecha);
    const domingo = fecha.getUTCDay() === 0;
    const d = porDia.get(iso);
    ws.getRow(r).height = 16;

    const cf = ws.getCell(r, 2);
    estilo(cf, { font: "Cambria", size: 14, fmt: "d-mmm", fill: domingo ? AZUL : undefined });
    cf.value = i === 0 ? fecha : { formula: `B${r - 1}+1` };

    for (let k = 0; k < nC; k++) {
      const c = ws.getCell(r, cCuadro0 + k);
      estilo(c, { size: 14, fmt: "#,##0", fill: domingo ? AZUL : undefined });
      const v = d?.cuadro[k] ?? 0;
      if (v) c.value = v;
    }
    const cK = ws.getCell(r, cCajas);
    estilo(cK, { size: 14, fmt: "#,##0", fill: domingo ? AZUL_OSC : undefined });
    cK.value = { formula: `SUM(${letra(cCuadro0)}${r}:${letra(cCuadroN)}${r})` };
    const cB = ws.getCell(r, cBins);
    estilo(cB, { size: 14, fmt: "#,##0", fill: domingo ? AZUL_OSC : undefined });
    if (d?.bins) cB.value = d.bins;
    const cT = ws.getCell(r, cTotal);
    estilo(cT, { size: 14, fmt: "#,##0", fill: domingo ? AZUL_OSC : undefined });
    cT.value = { formula: `${letra(cBins)}${r}+${letra(cCajas)}${r}` };
    const cA = ws.getCell(r, cAcum);
    estilo(cA, { size: 14, fmt: "#,##0", fill: domingo ? AZUL : undefined });
    if (domingo) {
      const desde = Math.max(r0, r - 6);
      cA.value = { formula: `SUM(${letra(cTotal)}${desde}:${letra(cTotal)}${r})` };
    }
    for (let k = 0; k < nD; k++) {
      const c = ws.getCell(r, cDist0 + k);
      estilo(c, { size: 14, fmt: "#,##0", fill: domingo ? NARANJA : undefined });
      const v = d?.dist[k] ?? 0;
      if (v) c.value = v;
    }
    const cTD = ws.getCell(r, cTotDist);
    estilo(cTD, { size: 12, fmt: "#,##0", fill: domingo ? NARANJA : undefined });
    cTD.value = { formula: `SUM(${letra(cDist0)}${r}:${letra(cDistN)}${r})` };
  }

  // ---- Totales ----
  const rTot = rUlt + 1;
  const rBins = rTot + 1;
  const rCajas = rTot + 2;
  const rHa = rTot + 3;
  for (const r of [rTot, rBins, rCajas, rHa]) ws.getRow(r).height = 21;
  const rotulo = (r: number, t: string, fill?: string, bold?: boolean) => {
    const c = ws.getCell(r, 2);
    estilo(c, { font: "Cambria", size: 14, bold, fill, border: "medio" });
    c.value = t;
  };
  rotulo(rTot, "Total Cajas");
  rotulo(rBins, "Bins a Cajas", VERDE, true);
  rotulo(rCajas, "CAJAS", VERDE, true);
  rotulo(rHa, "CAJAS X HA", undefined, true);

  for (let k = 0; k < nC; k++) {
    const col = cCuadro0 + k;
    const L = letra(col);
    const c1 = ws.getCell(rTot, col);
    estilo(c1, { size: 14, fmt: "#,##0", border: "medio" });
    c1.value = { formula: `SUM(${L}${r0}:${L}${rUlt})` };
    const c2 = ws.getCell(rBins, col);
    estilo(c2, { size: 14, fmt: "#,##0", border: "medio", fill: VERDE });
    c2.value = binsPorCuadro[k] || 0;
    const c3 = ws.getCell(rCajas, col);
    estilo(c3, { size: 14, bold: true, fmt: "#,##0", border: "medio", fill: VERDE });
    c3.value = { formula: `+${L}${rTot}+${L}${rBins}` };
    const c4 = ws.getCell(rHa, col);
    estilo(c4, { size: 14, bold: true, fmt: "#,##0", border: "medio" });
    c4.value = { formula: `IFERROR(${L}${rCajas}/${L}7,0)` };
  }
  for (const col of [cCajas, cBins, cTotal, cAcum]) {
    const L = letra(col);
    const c = ws.getCell(rTot, col);
    estilo(c, { size: 14, fmt: "#,##0", border: "medio" });
    c.value = { formula: `SUM(${L}${r0}:${L}${rUlt})` };
  }
  for (let k = 0; k <= nD; k++) {
    const col = cDist0 + k;
    const L = letra(col);
    const c = ws.getCell(rTot, col);
    estilo(c, { size: 14, fmt: "#,##0", border: "medio" });
    c.value = { formula: `SUM(${L}${r0}:${L}${rUlt})` };
  }
  // Bins a cajas (K) y CAJAS / CAJAS X HA (K y M)
  {
    const cb = ws.getCell(rBins, cCajas);
    estilo(cb, { size: 14, fmt: "#,##0", border: "medio" });
    cb.value = { formula: `SUM(${letra(cCuadro0)}${rBins}:${letra(cCuadroN)}${rBins})` };
    const ck = ws.getCell(rCajas, cCajas);
    estilo(ck, { size: 14, bold: true, fmt: "#,##0", border: "medio", fill: VERDE });
    ck.value = { formula: `+${letra(cCajas)}${rTot}+${letra(cCajas)}${rBins}` };
    const cm = ws.getCell(rCajas, cTotal);
    estilo(cm, { size: 14, bold: true, fmt: "#,##0", border: "medio", fill: VERDE });
    cm.value = { formula: `SUM(${letra(cCuadro0)}${rCajas}:${letra(cCuadroN)}${rCajas})` };
    const kh = ws.getCell(rHa, cCajas);
    estilo(kh, { size: 14, bold: true, fmt: "#,##0", border: "medio" });
    kh.value = { formula: `IFERROR(${letra(cCajas)}${rCajas}/${letra(cCajas)}5,0)` };
  }

  // ---- Bloque inferior: cortes (izq), resumen por variedad, calibres ----
  const rEnc = rHa + 1;
  ws.getRow(rEnc).height = 19.9;
  const rIni = rEnc + 1;

  // Cortes manuales (1er..5to)
  const nombresCorte = ["1er corte ", "2do corte ", "3er corte ", "4er corte ", "5er corte "];
  for (let n = 0; n < 5; n++) {
    const r = rIni + n;
    ws.getRow(r).height = 19.5;
    const c = ws.getCell(r, 2);
    estilo(c, { size: 12, border: "medio" });
    c.value = nombresCorte[n];
    for (let k = 0; k < nC; k++) {
      const cc = ws.getCell(r, cCuadro0 + k);
      estilo(cc, { size: 14, fmt: "#,##0", border: "medio" });
      const cu = cuadros[k];
      const v = cu ? cajasManual[`${cu.cuadroId}__${n + 1}`] : "";
      if (v !== undefined && v !== "" && !isNaN(Number(v))) cc.value = Number(v);
    }
  }

  // Resumen por variedad (Has / T Cajas)
  const variedades = Array.from(new Set(cuadros.map((c) => c.variedad)));
  const colVarA = cCajas; // nombre (combinado con la siguiente)
  const colHas = cTotal;
  const colTC = cAcum;
  estilo(ws.getCell(rEnc, colHas), { size: 12, fill: NARANJA, border: "medio" });
  ws.getCell(rEnc, colHas).value = "Has";
  estilo(ws.getCell(rEnc, colTC), { size: 12, fill: NARANJA, border: "medio" });
  ws.getCell(rEnc, colTC).value = "T Cajas";
  variedades.forEach((v, i) => {
    const r = rIni + i;
    ws.getRow(r).height = 19.5;
    ws.mergeCells(r, colVarA, r, cBins);
    estilo(ws.getCell(r, colVarA), { size: 12, h: "right", border: "fino" });
    ws.getCell(r, colVarA).value = v;
    const idx = cuadros.map((c, k) => (c.variedad === v ? k : -1)).filter((k) => k >= 0);
    const hasF = idx.map((k) => `${letra(cCuadro0 + k)}7`).join("+");
    const cajF = idx.map((k) => `${letra(cCuadro0 + k)}${rCajas}`).join("+");
    const esAm = /honey|amarilla/i.test(v);
    estilo(ws.getCell(r, colHas), { size: 14, fmt: "0.0", fill: esAm ? AMARILLO : undefined, border: "medio" });
    ws.getCell(r, colHas).value = { formula: `+${hasF}` };
    estilo(ws.getCell(r, colTC), { size: 14, fmt: "#,##0", fill: esAm ? AMARILLO : undefined, border: "medio" });
    ws.getCell(r, colTC).value = { formula: `+${cajF}` };
  });
  const rTotVar = rIni + Math.max(variedades.length, 5);
  estilo(ws.getCell(rTotVar, colHas), { size: 14, fmt: "0.0", border: "medio" });
  ws.getCell(rTotVar, colHas).value = { formula: `SUM(${letra(colHas)}${rIni}:${letra(colHas)}${rTotVar - 1})` };
  estilo(ws.getCell(rTotVar, colTC), { size: 14, fmt: "#,##0", border: "medio" });
  ws.getCell(rTotVar, colTC).value = { formula: `SUM(${letra(colTC)}${rIni}:${letra(colTC)}${rTotVar - 1})` };

  // % de calibres (del campo; solo cajas en pallet, como el empaque)
  const porCalibre = new Map<string, number>();
  let totalCal = 0;
  for (const r of regsCampo) {
    const n = r.calibres?.nombre;
    if (!n) continue;
    const v = Number(r.cajas ?? 0);
    porCalibre.set(n, (porCalibre.get(n) ?? 0) + v);
    totalCal += v;
  }
  ws.mergeCells(rEnc, cDist0, rEnc, Math.min(cDist0 + 1, cTotDist));
  estilo(ws.getCell(rEnc, cDist0), { size: 12, fill: NARANJA, border: "medio" });
  ws.getCell(rEnc, cDist0).value = "CALIBRES";
  Array.from(porCalibre.keys())
    .sort(ordenNumerico)
    .forEach((cal, i) => {
      const r = rIni + i;
      ws.getRow(r).height = 19.5;
      estilo(ws.getCell(r, cDist0), { size: 14, border: "fino" });
      ws.getCell(r, cDist0).value = /^\d+$/.test(cal) ? Number(cal) : cal;
      estilo(ws.getCell(r, cDist0 + 1), { size: 14, fmt: "0.0%", color: "FF476F2D", border: "fino" });
      ws.getCell(r, cDist0 + 1).value = totalCal > 0 ? (porCalibre.get(cal) ?? 0) / totalCal : 0;
    });
}

export async function generarExcelAcumuladoSandia({
  registros,
  cuadrosPlantados,
  cajasManualPorCorte,
  campos,
  cicloLabel,
}: {
  registros: Registro[];
  cuadrosPlantados: CuadroPlantado[];
  cajasManualPorCorte: Record<string, string>;
  campos: { id: string; label: string }[];
  cicloLabel: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.calcProperties.fullCalcOnLoad = true;

  const fechas = registros.map((r) => r.fecha).sort();
  if (fechas.length === 0) throw new Error("No hay registros para exportar.");
  const minF = aFecha(fechas[0]);
  const maxF = aFecha(fechas[fechas.length - 1]);
  // La tabla arranca en el domingo anterior (o igual) al primer corte, igual
  // que el ejemplo, y dura mínimo 57 días terminando en domingo.
  const inicio = sumarDias(minF, -minF.getUTCDay());
  let dias = Math.max(57, Math.round((maxF.getTime() - inicio.getTime()) / 86400000) + 1);
  while (sumarDias(inicio, dias - 1).getUTCDay() !== 0) dias++;

  const idsCampoConDatos = Array.from(new Set(registros.map((r) => r.cuadros?.campo_id).filter(Boolean) as string[]));
  const camposOrden = idsCampoConDatos
    .map((id) => ({ id, nombre: campos.find((c) => c.id === id)?.label ?? registros.find((r) => r.cuadros?.campo_id === id)?.cuadros?.campos?.nombre ?? "Campo" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const nombresUsados = new Set<string>();
  for (const campo of camposOrden) {
    const regs = registros.filter((r) => r.cuadros?.campo_id === campo.id);
    const plant = cuadrosPlantados
      .filter((c) => c.campoId === campo.id)
      .sort((a, b) => ordenNumerico(a.nombre, b.nombre));
    // Cuadros con cajas que no estén en el programa del ciclo
    const conocidos = new Set(plant.map((c) => c.cuadroId));
    for (const r of regs) {
      if (!conocidos.has(r.cuadro_id)) {
        conocidos.add(r.cuadro_id);
        plant.push({ cuadroId: r.cuadro_id, nombre: r.cuadros?.nombre ?? "", campoId: campo.id, variedad: "Sin variedad", hectareas: 0 });
      }
    }
    let nombreHoja = campo.nombre.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    while (nombresUsados.has(nombreHoja.toLowerCase())) nombreHoja = (nombreHoja.slice(0, 28) + "_2");
    nombresUsados.add(nombreHoja.toLowerCase());
    hojaCampo(libro, campo.nombre, regs, plant, cajasManualPorCorte, cicloLabel, inicio, dias, nombreHoja);
  }

  hojaDistribuidor(libro, registros, camposOrden, cuadrosPlantados, cicloLabel, inicio, dias);

  guardarResultados(libro);
  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PROD_CONSOLIDADO_SANDIAS_MINIS_${cicloLabel || "acumulado"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Hoja "x DISTRIB": consolidado por día — cajas por campo, por distribuidor y bins.
function hojaDistribuidor(
  libro: any,
  registros: Registro[],
  camposOrden: { id: string; nombre: string }[],
  cuadrosPlantados: CuadroPlantado[],
  cicloLabel: string,
  inicio: Date,
  dias: number
) {
  const ws = libro.addWorksheet("x DISTRIB", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  const nC = camposOrden.length;
  const nombresDist = Array.from(
    new Set(registros.map((r) => r.distribuidores?.nombre).filter((n) => n && n !== "Nacional") as string[])
  ).sort();
  const nD = Math.max(nombresDist.length, 1);

  const cCampo0 = 3; // C
  const cCampoN = cCampo0 + nC - 1;
  const cDist0 = cCampoN + 2; // deja una columna de espacio
  const cDistN = cDist0 + nD - 1;
  const cTot = cDistN + 1;
  const cNac = cTot + 2;
  const cBins = cNac + 1;

  ws.getColumn(1).width = 11;
  ws.getColumn(2).width = 2;
  for (let c = cCampo0; c <= cCampoN; c++) ws.getColumn(c).width = 11;
  ws.getColumn(cCampoN + 1).width = 2;
  for (let c = cDist0; c <= cTot; c++) ws.getColumn(c).width = 11;
  ws.getColumn(cTot + 1).width = 2;
  ws.getColumn(cNac).width = 11;
  ws.getColumn(cBins).width = 11;

  // Encabezados
  ws.mergeCells(1, cDist0, 1, cTot);
  estilo(ws.getCell(1, cDist0), { size: 11, bold: true, border: "fino" });
  ws.getCell(1, cDist0).value = `CONSOLIDADO  ${cicloLabel}`;
  ws.mergeCells(2, cDist0, 2, cTot);
  estilo(ws.getCell(2, cDist0), { size: 12, bold: true, fill: VERDE, border: "medio" });
  ws.getCell(2, cDist0).value = "CAJAS  POR  D I S T R I B U I D O R ";
  ws.mergeCells(2, cNac, 2, cBins);
  estilo(ws.getCell(2, cNac), { size: 12, bold: true, fill: VERDE, border: "medio" });
  ws.getCell(2, cNac).value = "Nacionales";

  estilo(ws.getCell(3, 1), { font: "Cambria", size: 12, border: "medio" });
  ws.getCell(3, 1).value = "Fecha";
  estilo(ws.getCell(4, 1), { font: "Cambria", size: 12, border: "medio" });
  ws.getCell(4, 1).value = inicio.getUTCFullYear();

  camposOrden.forEach((c, i) => {
    const col = cCampo0 + i;
    const has = cuadrosPlantados.filter((p) => p.campoId === c.id).reduce((s, p) => s + p.hectareas, 0);
    estilo(ws.getCell(3, col), { size: 12, fmt: "#,##0.0", border: "medio" });
    ws.getCell(3, col).value = has;
    estilo(ws.getCell(4, col), { size: 11, bold: true, fill: VERDE, border: "medio", wrap: true });
    ws.getCell(4, col).value = c.nombre;
  });
  ws.getRow(4).height = 30;
  for (let i = 0; i < nD; i++) {
    const col = cDist0 + i;
    ws.mergeCells(3, col, 4, col);
    estilo(ws.getCell(3, col), { size: 12, border: "medio", wrap: true });
    ws.getCell(3, col).value = nombresDist[i] ?? "";
  }
  estilo(ws.getCell(3, cTot), { size: 12, bold: true, border: "medio" });
  ws.getCell(3, cTot).value = "Total";
  estilo(ws.getCell(4, cTot), { size: 12, bold: true, border: "medio" });
  ws.getCell(4, cTot).value = "Cajas";
  ws.mergeCells(3, cNac, 4, cNac);
  estilo(ws.getCell(3, cNac), { size: 12, border: "medio" });
  ws.getCell(3, cNac).value = "Cajas";
  ws.mergeCells(3, cBins, 4, cBins);
  estilo(ws.getCell(3, cBins), { size: 12, border: "medio" });
  ws.getCell(3, cBins).value = "Bins";

  // Datos por día
  type D = { campo: number[]; dist: number[]; nac: number; bins: number };
  const porDia = new Map<string, D>();
  for (const r of registros) {
    const d = porDia.get(r.fecha) ?? { campo: new Array(nC).fill(0), dist: new Array(nD).fill(0), nac: 0, bins: 0 };
    const cajas = Number(r.cajas ?? 0);
    const ci = camposOrden.findIndex((c) => c.id === r.cuadros?.campo_id);
    if (ci >= 0) d.campo[ci] += cajas;
    const nombre = r.distribuidores?.nombre ?? "";
    if (nombre === "Nacional") d.nac += cajas;
    else {
      const di = nombresDist.indexOf(nombre);
      if (di >= 0) d.dist[di] += cajas;
    }
    if (esBins(r)) d.bins += cajas;
    porDia.set(r.fecha, d);
  }

  const r0 = 5;
  const rUlt = r0 + dias - 1;
  for (let i = 0; i < dias; i++) {
    const r = r0 + i;
    const fecha = sumarDias(inicio, i);
    const domingo = fecha.getUTCDay() === 0;
    const d = porDia.get(aIso(fecha));
    const fill = domingo ? AZUL : undefined;
    const cf = ws.getCell(r, 1);
    estilo(cf, { font: "Cambria", size: 11, fmt: "d-mmm", fill });
    cf.value = i === 0 ? fecha : { formula: `A${r - 1}+1` };
    for (let k = 0; k < nC; k++) {
      const c = ws.getCell(r, cCampo0 + k);
      estilo(c, { size: 11, fmt: "#,##0", fill });
      if (d?.campo[k]) c.value = d.campo[k];
    }
    for (let k = 0; k < nD; k++) {
      const c = ws.getCell(r, cDist0 + k);
      estilo(c, { size: 11, fmt: "#,##0", fill });
      if (d?.dist[k]) c.value = d.dist[k];
    }
    const ct = ws.getCell(r, cTot);
    estilo(ct, { size: 11, fmt: "#,##0", fill });
    ct.value = { formula: `SUM(${letra(cDist0)}${r}:${letra(cDistN)}${r})` };
    const cn = ws.getCell(r, cNac);
    estilo(cn, { size: 11, fmt: "#,##0", fill });
    if (d?.nac) cn.value = d.nac;
    const cb = ws.getCell(r, cBins);
    estilo(cb, { size: 11, fmt: "#,##0", fill });
    if (d?.bins) cb.value = d.bins;
  }

  const rLeyenda = rUlt + 1;
  ws.getCell(rLeyenda, 1).value = "Cajas Exportacion - Incluye Bins ";
  ws.getCell(rLeyenda, 1).font = { name: "Cambria", size: 10 };
  const rExp = rUlt + 2;
  const rHa = rUlt + 3;
  const rot = (r: number, t: string) => {
    estilo(ws.getCell(r, 1), { font: "Cambria", size: 11, fill: VERDE, border: "medio" });
    ws.getCell(r, 1).value = t;
  };
  rot(rExp, "C Export.");
  rot(rHa, "C x Ha.");
  const cols = [
    ...Array.from({ length: nC }, (_, i) => cCampo0 + i),
    ...Array.from({ length: nD + 1 }, (_, i) => cDist0 + i),
    cNac,
    cBins,
  ];
  for (const col of cols) {
    const L = letra(col);
    const c = ws.getCell(rExp, col);
    estilo(c, { size: 12, bold: true, fmt: "#,##0", fill: VERDE, border: "medio" });
    c.value = { formula: `SUM(${L}${r0}:${L}${rUlt})` };
  }
  for (let k = 0; k < nC; k++) {
    const L = letra(cCampo0 + k);
    const c = ws.getCell(rHa, cCampo0 + k);
    estilo(c, { size: 12, bold: true, fmt: "#,##0", fill: AMARILLO, border: "medio" });
    c.value = { formula: `IFERROR(${L}${rExp}/${L}3,0)` };
  }
}
