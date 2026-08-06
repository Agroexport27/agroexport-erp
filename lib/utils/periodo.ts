// Calcula el "periodo" (semana) para una fecha dada, a partir de un dia
// ancla configurable: 6 = sabado (nomina Eventual), 3 = miercoles
// (nomina Planta/Temporal, pago con tarjeta). Por default es sabado,
// para no romper el resto del sistema (censo, riego, agroquimicos) que
// ya usaba semanas sabado-a-viernes.
export type TipoNomina = "eventual" | "planta" | "temporal";

export function diaAnclaPorTipo(tipo: TipoNomina): number {
  return tipo === "eventual" ? 6 : 3; // 6=sabado, 3=miercoles
}

export function calcularPeriodo(
  fechaISO: string,
  diaAncla: number = 6
): {
  semana: number;
  anio: number;
} {
  const fecha = new Date(fechaISO + "T00:00:00");
  let anio = fecha.getFullYear();

  function primerDiaAncla(y: number): Date {
    const enero1 = new Date(y, 0, 1);
    const diaSemana = enero1.getDay(); // 0=domingo...6=sabado
    const diasHasta = (diaAncla - diaSemana + 7) % 7;
    return new Date(y, 0, 1 + diasHasta);
  }

  let inicioAnio = primerDiaAncla(anio);

  // Si la fecha cae antes del primer dia-ancla del año, pertenece a la
  // ultima semana del año anterior.
  if (fecha < inicioAnio) {
    anio -= 1;
    inicioAnio = primerDiaAncla(anio);
  }

  const msPorDia = 24 * 60 * 60 * 1000;
  const diff = Math.floor((fecha.getTime() - inicioAnio.getTime()) / msPorDia);
  const semana = Math.floor(diff / 7) + 1;

  return { semana, anio };
}

// Inverso de calcularPeriodo: dado semana + anio (+ dia ancla), regresa
// las 7 fechas de ese periodo, con su etiqueta corta (DIA DD/MES).
const DIAS = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const MESES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

export function fechasDePeriodo(
  semana: number,
  anio: number,
  diaAncla: number = 6
): { fecha: string; etiqueta: string }[] {
  function primerDiaAncla(y: number): Date {
    const enero1 = new Date(y, 0, 1);
    const diaSemana = enero1.getDay();
    const diasHasta = (diaAncla - diaSemana + 7) % 7;
    return new Date(y, 0, 1 + diasHasta);
  }

  const inicio = primerDiaAncla(anio);
  inicio.setDate(inicio.getDate() + (semana - 1) * 7);

  const dias: { fecha: string; etiqueta: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dias.push({
      fecha: `${yyyy}-${mm}-${dd}`,
      etiqueta: `${DIAS[d.getDay()]} ${dd}/${MESES[d.getMonth()]}`,
    });
  }
  return dias;
}
