import * as XLSX from "xlsx";

export type FilaResumen = {
  nombre: string;
  registros: number;
  total: number;
  hectareas?: number | null;
};

export type FilaCruce = {
  cuadro: string;
  actividad: string;
  registros: number;
  total: number;
};

export type FilaJerarquia = {
  campo: string;
  hectareasCampo: number | null;
  cuadro: string;
  hectareasCuadro: number | null;
  actividad: string;
  registros: number;
  gasto: number;
};

export function generarExcelReporteNominas({
  porCampo,
  porCuadro,
  porActividad,
  porCuadroActividad,
  jerarquia,
  rango,
}: {
  porCampo: FilaResumen[];
  porCuadro: FilaResumen[];
  porActividad: FilaResumen[];
  porCuadroActividad: FilaCruce[];
  jerarquia: FilaJerarquia[];
  rango: string;
}) {
  const libro = XLSX.utils.book_new();

  function agregarHoja(nombre: string, filas: FilaResumen[], conHectareas: boolean) {
    const datos = filas.map((f) => {
      const base: Record<string, any> = {
        [nombre === "Por campo" ? "Campo" : nombre === "Por cuadro" ? "Cuadro" : "Actividad"]: f.nombre,
        Total: f.total,
      };
      if (conHectareas) {
        base["Hectáreas"] = f.hectareas ?? "";
        base["Costo/ha"] =
          f.hectareas && f.hectareas > 0
            ? Number((f.total / f.hectareas).toFixed(2))
            : "";
      }
      return base;
    });
    const hoja = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
  }

  agregarHoja("Por campo", porCampo, true);
  agregarHoja("Por cuadro", porCuadro, true);
  agregarHoja("Por actividad", porActividad, true);

  const hojaJerarquia = XLSX.utils.json_to_sheet(
    jerarquia.map((j) => ({
      Campo: j.campo,
      Cuadro: j.cuadro,
      Actividad: j.actividad,
      Gasto: j.gasto,
      "Hectáreas campo": j.hectareasCampo ?? "",
      "Hectáreas cuadro": j.hectareasCuadro ?? "",
      Registros: j.registros,
      "Gasto/ha (sobre cuadro)":
        j.hectareasCuadro && j.hectareasCuadro > 0
          ? Number((j.gasto / j.hectareasCuadro).toFixed(2))
          : "",
    }))
  );
  XLSX.utils.book_append_sheet(libro, hojaJerarquia, "Campo-Cuadro-Actividad");

  XLSX.writeFile(libro, `reporte_nominas_${rango}.xlsx`);
}
