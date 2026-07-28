import * as XLSX from "xlsx";

export type FilaApuntadorExport = {
  fecha: string;
  campo: string;
  empleadoClave: string;
  empleadoNombre: string;
  cuadro: string;
  actividad: string;
  tipoPago: string;
  avance: number | null;
  tarifa: number;
  total: number;
  periodo: string;
};

export function generarExcelApuntador(
  filas: FilaApuntadorExport[],
  nombreArchivo: string
) {
  const datos = filas.map((f) => ({
    Fecha: f.fecha,
    Campo: f.campo,
    Clave: f.empleadoClave,
    Empleado: f.empleadoNombre,
    Cuadro: f.cuadro,
    Actividad: f.actividad,
    "Tipo de pago": f.tipoPago,
    Avance: f.avance ?? "",
    Tarifa: f.tarifa,
    Total: f.total,
    Periodo: f.periodo,
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja["!cols"] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    { wch: 24 },
    { wch: 10 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Apuntador");
  XLSX.writeFile(libro, nombreArchivo);
}
