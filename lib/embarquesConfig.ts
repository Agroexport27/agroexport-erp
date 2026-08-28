// Configuracion de columnas por distribuidor para Embarques (Envios).
// Los nombres en "cajas" deben coincidir EXACTO con calibres.nombre
// (cultivo Sandia Mini). Los "bins" no tienen conversion a cajas aqui
// (a diferencia de Corte) -- se guardan tal cual con etiqueta_libre.

export type ColumnaBin = { etiqueta: string };

export type ConfigDistribuidor = {
  cajas: string[]; // nombres de calibres.nombre
  bins: ColumnaBin[];
};

const BINS_UNIFICADOS = [
  { etiqueta: "Bins 120 (mini)" },
  { etiqueta: "Bins 140 (mini)" },
  { etiqueta: "Bins 28 (regular)" },
  { etiqueta: "Bins 36 (regular)" },
  { etiqueta: "Bins 45 (regular)" },
  { etiqueta: "Bins 60 (regular)" },
  { etiqueta: "Bins 80 (regular)" },
];

export const CONFIG_EMBARQUES: Record<string, ConfigDistribuidor> = {
  Dulcinea: {
    cajas: ["6", "6 J", "8", "9", "M 9", "11", "8 COS", "FT 8C", "4 D"],
    bins: BINS_UNIFICADOS,
  },
  Giumarra: {
    cajas: ["6", "6 J", "8", "9", "M 9", "11", "4 D"],
    bins: BINS_UNIFICADOS,
  },
  "Robinson Fresh": {
    cajas: ["6", "6 J", "8", "9", "M 9", "11", "8 COS", "FT 8C", "4 D"],
    bins: BINS_UNIFICADOS,
  },
  "Divine Flavor": {
    cajas: ["6", "6 J", "8", "9", "M 9", "11", "8 COS", "FT 8C", "4 D"],
    bins: BINS_UNIFICADOS,
  },
  Nacional: {
    cajas: ["6", "6 J", "8", "9", "M 9", "11", "8 COS", "FT 8C", "4 D"],
    bins: BINS_UNIFICADOS,
  },
};

export const EMPAQUE_OPCIONES = ["Convencional", "Orgánico", "Regular", "REOrgánico", "Amarilla"];
