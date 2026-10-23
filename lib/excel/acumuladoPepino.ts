// Excel del Acumulado de PEPINO. Misma forma que el de Sandía Mini (una hoja
// por campo, cuadros en columnas, días hacia abajo, Cajas / Acum. x Sem.,
// columnas por distribuidor, totales, cajas por ha) pero con lo que lleva el
// pepino: cajas equivalentes a 36s (por día, por cuadro y por ha), tabla de
// calibres por cuadro con su % y su factor a 36s. Más una hoja "x DISTRIB"
// (consolidado por día) y una hoja "CALIBRES" (resumen por campo).
//
// Reutiliza los helpers de acumuladoSandia.ts (estilos, fórmulas con
// resultado en caché, hoja x DISTRIB).

import {
  AMARILLO,
  AZUL,
  AZUL_OSC,
  NARANJA,
  VERDE,
  aFecha,
  aIso,
  estilo,
  guardarResultados,
  hojaDistribuidor,
  letra,
  ordenNumerico,
  sumarDias,
  type CuadroPlantado,
  type Registro,
} from "./acumuladoSandia";

// Piezas (pepinos) por caja de cada empaque -> factor a cajas de "36" =
// piezas / 36. Es la misma tabla que usa la pantalla del Acumulado de
// pepino (si se cambia allá, hay que cambiarla aquí también).
const PIEZAS_POR_CAJA_PEPINO: Record<string, number> = {
  "SUPER SELECT": 70,
  SELECTOS: 70,
  LARGE: 60,
  SMALL: 90,
  PLAIN: 70,
  "42'S": 42,
  "36'S": 36,
  "24'S": 24,
  "54'S": 54,
  "24'S RPC": 24,
  "36'S RPC": 36,
  "RPC 62": 62,
  "RPC 72": 72,
};

function factor36s(calibre: string): number | null {
  const p = PIEZAS_POR_CAJA_PEPINO[(calibre ?? "").trim().toUpperCase()];
  return p ? p / 36 : null;
}

function hojaCampoPepino(
  libro: any,
  campoNombre: string,
  regsCampo: Registro[],
  cuadros: CuadroPlantado[],
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
  const cCajas = cGap1 + 1; // Cajas
  const c36 = cCajas + 1; // Cajas 36s equiv.
  const cAcum = c36 + 1; // Acum. x Sem.
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
  ws.getColumn(c36).width = 11.6;
  ws.getColumn(cAcum).width = 11;
  ws.getColumn(cGap2).width = 1.7;
  for (let c = cDist0; c <= cDistN; c++) ws.getColumn(c).width = 12.5;
  ws.getColumn(cTotDist).width = 12.5;

  const alturas: Record<number, number> = { 1: 9.5, 2: 25.5, 3: 16, 4: 18, 5: 25, 6: 18, 7: 17.5, 8: 19.9 };
  for (const [r, h] of Object.entries(alturas)) ws.getRow(Number(r)).height = h;

  // ---- Fila 2: título + fecha de hoy ----
  const titulo = `${campoNombre.toUpperCase()}                 PEPINO  Exportacion     ${cicloLabel}                   ${campoNombre.toUpperCase()}`;
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
    ws.getCell(3, col).numFmt = "d-mmm";
    estilo(ws.getCell(5, col), { size: 9, fill: VERDE, border: "medio", wrap: true });
    ws.getCell(5, col).value = cu.variedad.toUpperCase();
    estilo(ws.getCell(7, col), { size: 14, fmt: "0.0", border: "medio" });
    ws.getCell(7, col).value = cu.hectareas;
    estilo(ws.getCell(8, col), { size: 14, bold: true, fmt: "@", border: "medio" });
    ws.getCell(8, col).value = cu.nombre;
  }

  // Total de has (combinado, como en sandía)
  ws.mergeCells(5, cCajas, 6, cCajas);
  estilo(ws.getCell(5, cCajas), { size: 16, bold: true, fmt: "#,##0.0", border: "medio" });
  ws.getCell(5, cCajas).value = { formula: `SUM(${letra(cCuadro0)}7:${letra(cCuadroN)}7)` };

  // Encabezados de las columnas de totales y distribuidores
  ws.mergeCells(7, cCajas, 8, cCajas);
  estilo(ws.getCell(7, cCajas), { size: 14, border: "medio" });
  ws.getCell(7, cCajas).value = "Cajas";
  ws.mergeCells(7, c36, 8, c36);
  estilo(ws.getCell(7, c36), { size: 12, bold: true, fill: AMARILLO, border: "medio", wrap: true });
  ws.getCell(7, c36).value = "Cajas 36s equiv.";
  estilo(ws.getCell(7, cAcum), { size: 14, border: "medio" });
  estilo(ws.getCell(8, cAcum), { size: 14, border: "medio" });
  ws.getCell(7, cAcum).value = "Acum.";
  ws.getCell(8, cAcum).value = "x Sem.";
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
  type Dia = { cuadro: number[]; dist: number[]; eq36: number };
  const porDia = new Map<string, Dia>();
  // calibre -> cuadro -> cajas
  const porCalibre = new Map<string, number[]>();
  for (const r of regsCampo) {
    const d = porDia.get(r.fecha) ?? { cuadro: new Array(nC).fill(0), dist: new Array(nD).fill(0), eq36: 0 };
    const cajas = Number(r.cajas ?? 0);
    const ci = cuadroIdx.get(r.cuadro_id);
    if (ci != null) d.cuadro[ci] += cajas;
    const di = nombresDist.indexOf(r.distribuidores?.nombre ?? "");
    if (di >= 0) d.dist[di] += cajas;
    const cal = r.calibres?.nombre ?? "";
    const f = factor36s(cal);
    if (f) d.eq36 += cajas * f;
    if (cal && ci != null) {
      const arr = porCalibre.get(cal) ?? new Array(nC).fill(0);
      arr[ci] += cajas;
      porCalibre.set(cal, arr);
    }
    porDia.set(r.fecha, d);
  }
  const calibres = Array.from(porCalibre.keys()).sort(ordenNumerico);

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
    const c3 = ws.getCell(r, c36);
    estilo(c3, { size: 14, fmt: "#,##0.0", fill: domingo ? AZUL_OSC : AMARILLO });
    if (d?.eq36) c3.value = d.eq36;
    const cA = ws.getCell(r, cAcum);
    estilo(cA, { size: 14, fmt: "#,##0", fill: domingo ? AZUL : undefined });
    if (domingo) {
      const desde = Math.max(r0, r - 6);
      cA.value = { formula: `SUM(${letra(cCajas)}${desde}:${letra(cCajas)}${r})` };
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
  const rHa = rTot + 1;
  const rEq = rTot + 2;
  const rEqHa = rTot + 3;
  for (const r of [rTot, rHa, rEq, rEqHa]) ws.getRow(r).height = 21;
  const rotulo = (r: number, t: string, fill?: string, bold?: boolean) => {
    const c = ws.getCell(r, 2);
    estilo(c, { font: "Cambria", size: 13, bold, fill, border: "medio" });
    c.value = t;
  };
  rotulo(rTot, "Total Cajas", VERDE, true);
  rotulo(rHa, "CAJAS X HA", undefined, true);
  rotulo(rEq, "CAJAS 36s", AMARILLO, true);
  rotulo(rEqHa, "36s X HA", AMARILLO, true);

  // Bloque de calibres (debajo de los totales)
  const rEnc = rEqHa + 2;
  const rIni = rEnc + 1;
  const rCalTot = rIni + Math.max(calibres.length, 1);

  for (let k = 0; k < nC; k++) {
    const col = cCuadro0 + k;
    const L = letra(col);
    const c1 = ws.getCell(rTot, col);
    estilo(c1, { size: 14, bold: true, fmt: "#,##0", border: "medio", fill: VERDE });
    c1.value = { formula: `SUM(${L}${r0}:${L}${rUlt})` };
    const c2 = ws.getCell(rHa, col);
    estilo(c2, { size: 14, bold: true, fmt: "#,##0", border: "medio" });
    c2.value = { formula: `IFERROR(${L}${rTot}/${L}7,0)` };
    // Cajas 36s del cuadro = suma de (cajas del calibre x factor)
    const partes: string[] = [];
    calibres.forEach((cal, i) => {
      if (factor36s(cal)) partes.push(`${L}${rIni + i}*${letra(cAcum)}${rIni + i}`);
    });
    const c3 = ws.getCell(rEq, col);
    estilo(c3, { size: 14, bold: true, fmt: "#,##0.0", border: "medio", fill: AMARILLO });
    if (partes.length > 0) c3.value = { formula: partes.join("+") };
    else c3.value = 0;
    const c4 = ws.getCell(rEqHa, col);
    estilo(c4, { size: 14, bold: true, fmt: "#,##0.0", border: "medio", fill: AMARILLO });
    c4.value = { formula: `IFERROR(${L}${rEq}/${L}7,0)` };
  }
  for (const col of [cCajas, c36, cAcum]) {
    const L = letra(col);
    const c = ws.getCell(rTot, col);
    estilo(c, { size: 14, bold: true, fmt: col === c36 ? "#,##0.0" : "#,##0", border: "medio", fill: VERDE });
    c.value = { formula: `SUM(${L}${r0}:${L}${rUlt})` };
  }
  for (let k = 0; k <= nD; k++) {
    const col = cDist0 + k;
    const L = letra(col);
    const c = ws.getCell(rTot, col);
    estilo(c, { size: 14, bold: true, fmt: "#,##0", border: "medio", fill: VERDE });
    c.value = { formula: `SUM(${L}${r0}:${L}${rUlt})` };
  }
  // CAJAS X HA y 36s total (K)
  {
    const kh = ws.getCell(rHa, cCajas);
    estilo(kh, { size: 14, bold: true, fmt: "#,##0", border: "medio" });
    kh.value = { formula: `IFERROR(${letra(cCajas)}${rTot}/${letra(cCajas)}5,0)` };
    const ke = ws.getCell(rEq, cCajas);
    estilo(ke, { size: 14, bold: true, fmt: "#,##0.0", border: "medio", fill: AMARILLO });
    ke.value = { formula: `SUM(${letra(cCuadro0)}${rEq}:${letra(cCuadroN)}${rEq})` };
    const keh = ws.getCell(rEqHa, cCajas);
    estilo(keh, { size: 14, bold: true, fmt: "#,##0.0", border: "medio", fill: AMARILLO });
    keh.value = { formula: `IFERROR(${letra(cCajas)}${rEq}/${letra(cCajas)}5,0)` };
  }

  // ---- Bloque de calibres: cajas por cuadro, total, %, factor 36s, cajas 36s ----
  ws.getRow(rEnc).height = 30;
  const encCal = (col: number, t: string) => {
    const c = ws.getCell(rEnc, col);
    estilo(c, { size: 11, bold: true, fill: NARANJA, border: "medio", wrap: true });
    c.value = t;
  };
  encCal(2, "CALIBRE");
  for (let k = 0; k < nC; k++) {
    const c = ws.getCell(rEnc, cCuadro0 + k);
    estilo(c, { size: 12, bold: true, fill: NARANJA, border: "medio" });
    c.value = cuadros[k]?.nombre ?? "";
  }
  encCal(cCajas, "Total cajas");
  encCal(c36, "% del total");
  encCal(cAcum, "Factor a 36s");
  encCal(cDist0, "Cajas 36s equiv.");

  calibres.forEach((cal, i) => {
    const r = rIni + i;
    ws.getRow(r).height = 19.5;
    estilo(ws.getCell(r, 2), { size: 12, bold: true, border: "fino", h: "left" });
    ws.getCell(r, 2).value = cal;
    const arr = porCalibre.get(cal) ?? [];
    for (let k = 0; k < nC; k++) {
      const c = ws.getCell(r, cCuadro0 + k);
      estilo(c, { size: 13, fmt: "#,##0", border: "fino" });
      if (arr[k]) c.value = arr[k];
    }
    const cT = ws.getCell(r, cCajas);
    estilo(cT, { size: 13, bold: true, fmt: "#,##0", border: "fino" });
    cT.value = { formula: `SUM(${letra(cCuadro0)}${r}:${letra(cCuadroN)}${r})` };
    const cP = ws.getCell(r, c36);
    estilo(cP, { size: 13, fmt: "0.0%", color: "FF476F2D", border: "fino" });
    cP.value = { formula: `IFERROR(${letra(cCajas)}${r}/${letra(cCajas)}${rCalTot},0)` };
    const f = factor36s(cal);
    const cF = ws.getCell(r, cAcum);
    estilo(cF, { size: 13, fmt: "0.000", border: "fino" });
    if (f) cF.value = f;
    const cE = ws.getCell(r, cDist0);
    estilo(cE, { size: 13, fmt: "#,##0.0", border: "fino", fill: f ? AMARILLO : undefined });
    if (f) cE.value = { formula: `${letra(cCajas)}${r}*${letra(cAcum)}${r}` };
  });
  // Fila de total del bloque
  {
    const r = rCalTot;
    estilo(ws.getCell(r, 2), { size: 12, bold: true, fill: VERDE, border: "medio", h: "left" });
    ws.getCell(r, 2).value = "TOTAL";
    for (let k = 0; k < nC; k++) {
      const L = letra(cCuadro0 + k);
      const c = ws.getCell(r, cCuadro0 + k);
      estilo(c, { size: 13, bold: true, fmt: "#,##0", fill: VERDE, border: "medio" });
      c.value = { formula: calibres.length ? `SUM(${L}${rIni}:${L}${r - 1})` : "0" };
    }
    const L = letra(cCajas);
    const cT = ws.getCell(r, cCajas);
    estilo(cT, { size: 13, bold: true, fmt: "#,##0", fill: VERDE, border: "medio" });
    cT.value = { formula: calibres.length ? `SUM(${L}${rIni}:${L}${r - 1})` : "0" };
    estilo(ws.getCell(r, c36), { size: 13, bold: true, fmt: "0.0%", fill: VERDE, border: "medio" });
    ws.getCell(r, c36).value = { formula: calibres.length ? `SUM(${letra(c36)}${rIni}:${letra(c36)}${r - 1})` : "0" };
    estilo(ws.getCell(r, cAcum), { size: 13, fill: VERDE, border: "medio" });
    const LE = letra(cDist0);
    estilo(ws.getCell(r, cDist0), { size: 13, bold: true, fmt: "#,##0.0", fill: VERDE, border: "medio" });
    ws.getCell(r, cDist0).value = { formula: calibres.length ? `SUM(${LE}${rIni}:${LE}${r - 1})` : "0" };
  }
  const sinFactor = calibres.filter((c) => !factor36s(c));
  if (sinFactor.length > 0) {
    const c = ws.getCell(rCalTot + 2, 2);
    c.value = `Sin factor a 36s (no cuentan en "Cajas 36s"): ${sinFactor.join(", ")}`;
    c.font = { name: "Cambria", size: 10, italic: true };
  }
}

// Hoja "CALIBRES": cajas por calibre y por campo (todo el ciclo), con % y
// cajas equivalentes a 36s.
function hojaCalibres(
  libro: any,
  registros: Registro[],
  camposOrden: { id: string; nombre: string }[],
  cuadrosPlantados: CuadroPlantado[],
  cicloLabel: string
) {
  const ws = libro.addWorksheet("CALIBRES", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  const nC = camposOrden.length;
  const calibres = Array.from(new Set(registros.map((r) => r.calibres?.nombre).filter(Boolean) as string[])).sort(ordenNumerico);

  const cCampo0 = 2;
  const cTot = cCampo0 + nC;
  const cPct = cTot + 1;
  const cFac = cPct + 1;
  const cEq = cFac + 1;

  ws.getColumn(1).width = 16;
  for (let c = cCampo0; c <= cEq; c++) ws.getColumn(c).width = 13;

  ws.mergeCells(1, 1, 1, cEq);
  estilo(ws.getCell(1, 1), { size: 14, bold: true, fill: VERDE, border: "medio" });
  ws.getCell(1, 1).value = `PEPINO — CAJAS POR CALIBRE   ${cicloLabel}`;

  estilo(ws.getCell(3, 1), { size: 11, bold: true, fill: NARANJA, border: "medio" });
  ws.getCell(3, 1).value = "Hectáreas";
  ws.getRow(4).height = 30;
  estilo(ws.getCell(4, 1), { size: 11, bold: true, fill: NARANJA, border: "medio" });
  ws.getCell(4, 1).value = "CALIBRE";
  camposOrden.forEach((c, i) => {
    estilo(ws.getCell(4, cCampo0 + i), { size: 11, bold: true, fill: NARANJA, border: "medio", wrap: true });
    ws.getCell(4, cCampo0 + i).value = c.nombre;
  });
  for (const [col, t] of [[cTot, "Total"], [cPct, "% del total"], [cFac, "Factor a 36s"], [cEq, "Cajas 36s equiv."]] as [number, string][]) {
    estilo(ws.getCell(4, col), { size: 11, bold: true, fill: NARANJA, border: "medio", wrap: true });
    ws.getCell(4, col).value = t;
  }

  const r0 = 5;
  const rTot = r0 + calibres.length;
  calibres.forEach((cal, i) => {
    const r = r0 + i;
    estilo(ws.getCell(r, 1), { size: 12, bold: true, border: "fino", h: "left" });
    ws.getCell(r, 1).value = cal;
    camposOrden.forEach((c, k) => {
      const v = registros
        .filter((x) => x.calibres?.nombre === cal && x.cuadros?.campo_id === c.id)
        .reduce((s, x) => s + Number(x.cajas ?? 0), 0);
      const cell = ws.getCell(r, cCampo0 + k);
      estilo(cell, { size: 12, fmt: "#,##0", border: "fino" });
      if (v) cell.value = v;
    });
    const cT = ws.getCell(r, cTot);
    estilo(cT, { size: 12, bold: true, fmt: "#,##0", border: "fino" });
    cT.value = { formula: `SUM(${letra(cCampo0)}${r}:${letra(cCampo0 + nC - 1)}${r})` };
    const cP = ws.getCell(r, cPct);
    estilo(cP, { size: 12, fmt: "0.0%", color: "FF476F2D", border: "fino" });
    cP.value = { formula: `IFERROR(${letra(cTot)}${r}/${letra(cTot)}${rTot},0)` };
    const f = factor36s(cal);
    const cF = ws.getCell(r, cFac);
    estilo(cF, { size: 12, fmt: "0.000", border: "fino" });
    if (f) cF.value = f;
    const cE = ws.getCell(r, cEq);
    estilo(cE, { size: 12, fmt: "#,##0.0", border: "fino", fill: f ? AMARILLO : undefined });
    if (f) cE.value = { formula: `${letra(cTot)}${r}*${letra(cFac)}${r}` };
  });

  estilo(ws.getCell(rTot, 1), { size: 12, bold: true, fill: VERDE, border: "medio", h: "left" });
  ws.getCell(rTot, 1).value = "TOTAL";
  const colsSuma = [...Array.from({ length: nC }, (_, i) => cCampo0 + i), cTot, cEq];
  for (const col of colsSuma) {
    const L = letra(col);
    const c = ws.getCell(rTot, col);
    estilo(c, { size: 12, bold: true, fmt: col === cEq ? "#,##0.0" : "#,##0", fill: VERDE, border: "medio" });
    c.value = { formula: calibres.length ? `SUM(${L}${r0}:${L}${rTot - 1})` : "0" };
  }
  estilo(ws.getCell(rTot, cPct), { size: 12, bold: true, fmt: "0.0%", fill: VERDE, border: "medio" });
  ws.getCell(rTot, cPct).value = { formula: calibres.length ? `SUM(${letra(cPct)}${r0}:${letra(cPct)}${rTot - 1})` : "0" };
  estilo(ws.getCell(rTot, cFac), { size: 12, fill: VERDE, border: "medio" });

  // Hectáreas por campo (fila 3) y rendimiento por ha (debajo del total)
  const rHa = rTot + 1;
  const rEqHa = rTot + 2;
  estilo(ws.getCell(rHa, 1), { size: 12, bold: true, border: "medio", h: "left" });
  ws.getCell(rHa, 1).value = "CAJAS X HA";
  estilo(ws.getCell(rEqHa, 1), { size: 12, bold: true, fill: AMARILLO, border: "medio", h: "left" });
  ws.getCell(rEqHa, 1).value = "36s X HA";
  camposOrden.forEach((c, k) => {
    const col = cCampo0 + k;
    const L = letra(col);
    const has = cuadrosPlantados.filter((p) => p.campoId === c.id).reduce((s, p) => s + p.hectareas, 0);
    estilo(ws.getCell(3, col), { size: 12, fmt: "#,##0.0", border: "medio" });
    ws.getCell(3, col).value = has;
    estilo(ws.getCell(rHa, col), { size: 12, bold: true, fmt: "#,##0", border: "medio" });
    ws.getCell(rHa, col).value = { formula: `IFERROR(${L}${rTot}/${L}3,0)` };
    // 36s por campo = suma de (cajas del calibre en el campo x factor)
    const partes: string[] = [];
    calibres.forEach((cal, i) => {
      if (factor36s(cal)) partes.push(`${L}${r0 + i}*${letra(cFac)}${r0 + i}`);
    });
    estilo(ws.getCell(rEqHa, col), { size: 12, bold: true, fmt: "#,##0.0", fill: AMARILLO, border: "medio" });
    ws.getCell(rEqHa, col).value = { formula: partes.length ? `IFERROR((${partes.join("+")})/${L}3,0)` : "0" };
  });
  // el total de hectáreas
  estilo(ws.getCell(3, cTot), { size: 12, bold: true, fmt: "#,##0.0", border: "medio" });
  ws.getCell(3, cTot).value = { formula: `SUM(${letra(cCampo0)}3:${letra(cCampo0 + nC - 1)}3)` };
  estilo(ws.getCell(rHa, cTot), { size: 12, bold: true, fmt: "#,##0", border: "medio" });
  ws.getCell(rHa, cTot).value = { formula: `IFERROR(${letra(cTot)}${rTot}/${letra(cTot)}3,0)` };
  estilo(ws.getCell(rEqHa, cTot), { size: 12, bold: true, fmt: "#,##0.0", fill: AMARILLO, border: "medio" });
  ws.getCell(rEqHa, cTot).value = { formula: `IFERROR(${letra(cEq)}${rTot}/${letra(cTot)}3,0)` };
}

export async function generarExcelAcumuladoPepino({
  registros,
  cuadrosPlantados,
  campos,
  cicloLabel,
}: {
  registros: Registro[];
  cuadrosPlantados: CuadroPlantado[];
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
  // La tabla arranca en el domingo anterior (o igual) al primer corte; dura
  // mínimo 28 días y termina en domingo.
  const inicio = sumarDias(minF, -minF.getUTCDay());
  let dias = Math.max(28, Math.round((maxF.getTime() - inicio.getTime()) / 86400000) + 1);
  while (sumarDias(inicio, dias - 1).getUTCDay() !== 0) dias++;

  const idsCampoConDatos = Array.from(new Set(registros.map((r) => r.cuadros?.campo_id).filter(Boolean) as string[]));
  const camposOrden = idsCampoConDatos
    .map((id) => ({
      id,
      nombre:
        campos.find((c) => c.id === id)?.label ??
        registros.find((r) => r.cuadros?.campo_id === id)?.cuadros?.campos?.nombre ??
        "Campo",
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const nombresUsados = new Set<string>();
  for (const campo of camposOrden) {
    const regs = registros.filter((r) => r.cuadros?.campo_id === campo.id);
    const plant = cuadrosPlantados
      .filter((c) => c.campoId === campo.id)
      .sort((a, b) => ordenNumerico(a.nombre, b.nombre));
    const conocidos = new Set(plant.map((c) => c.cuadroId));
    for (const r of regs) {
      if (!conocidos.has(r.cuadro_id)) {
        conocidos.add(r.cuadro_id);
        plant.push({ cuadroId: r.cuadro_id, nombre: r.cuadros?.nombre ?? "", campoId: campo.id, variedad: "Sin variedad", hectareas: 0 });
      }
    }
    let nombreHoja = campo.nombre.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    while (nombresUsados.has(nombreHoja.toLowerCase())) nombreHoja = nombreHoja.slice(0, 28) + "_2";
    nombresUsados.add(nombreHoja.toLowerCase());
    hojaCampoPepino(libro, campo.nombre, regs, plant, cicloLabel, inicio, dias, nombreHoja);
  }

  hojaDistribuidor(libro, registros, camposOrden, cuadrosPlantados, cicloLabel, inicio, dias);
  hojaCalibres(libro, registros, camposOrden, cuadrosPlantados, cicloLabel);

  guardarResultados(libro);
  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PROD_CONSOLIDADO_PEPINO_${cicloLabel || "acumulado"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
