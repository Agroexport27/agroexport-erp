// Configuracion de columnas por distribuidor para Embarques (Envios).
// Los nombres en "cajas" deben coincidir EXACTO con calibres.nombre
// (cultivo Sandia Mini). Los "bins" no tienen conversion a cajas aqui
// (a diferencia de Corte) -- se guardan tal cual con etiqueta_libre.

export type ColumnaBin = { etiqueta: string };

export type ConfigDistribuidor = {
  cajas: string[]; // nombres de calibres.nombre
  bins: ColumnaBin[];
};

export const CONFIG_EMBARQUES: Record<string, ConfigDistribuidor> = {
  Dulcinea: {
    cajas: ["6", "6 J", "8", "9", "11", "8 COS", "FT 8C"],
    bins: [
      { etiqueta: "Bins 120 (mini)" },
      { etiqueta: "Bins 140 (mini)" },
      { etiqueta: "Bins 36 (regular)" },
      { etiqueta: "Bins 45 (regular)" },
      { etiqueta: "Bins 60 (regular)" },
    ],
  },
  Giumarra: {
    cajas: ["6", "6 J", "8", "9", "11"],
    bins: [
      { etiqueta: "Bins 36 (regular)" },
      { etiqueta: "Bins 45 (regular)" },
      { etiqueta: "Bins 60 (regular)" },
    ],
  },
  "Robinson Fresh": {
    cajas: ["6", "6 J", "8", "9", "11", "8 COS", "FT 8C"],
    bins: [],
  },
  "Divine Flavor": {
    cajas: ["6", "6 J", "8", "9", "11", "8 COS", "FT 8C"],
    bins: [
      { etiqueta: "Bins 36 (regular)" },
      { etiqueta: "Bins 45 (regular)" },
      { etiqueta: "Bins 60 (regular)" },
      { etiqueta: "Bins 75 (regular)" },
    ],
  },
};

export const EMPAQUE_OPCIONES = ["Convencional", "Orgánico", "Regular", "REOrgánico", "Amarilla"];
