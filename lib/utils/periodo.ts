// Calcula el "periodo" (semana sábado-a-viernes) para una fecha dada.
// La semana 1 del año es la que contiene el primer sábado (ej. 2026:
// semana 1 = 3-9 enero, porque el 3 de enero es sábado).
export function calcularPeriodo(fechaISO: string): {
  semana: number;
  anio: number;
} {
  const fecha = new Date(fechaISO + "T00:00:00");
  let anio = fecha.getFullYear();

  function primerSabado(y: number): Date {
    const enero1 = new Date(y, 0, 1);
    const diaSemana = enero1.getDay(); // 0=domingo...6=sabado
    const diasHastaSabado = (6 - diaSemana + 7) % 7;
    const sab = new Date(y, 0, 1 + diasHastaSabado);
    return sab;
  }

  let inicioAnio = primerSabado(anio);

  // Si la fecha cae antes del primer sábado del año, pertenece a la
  // última semana del año anterior.
  if (fecha < inicioAnio) {
    anio -= 1;
    inicioAnio = primerSabado(anio);
  }

  const msPorDia = 24 * 60 * 60 * 1000;
  const diff = Math.floor((fecha.getTime() - inicioAnio.getTime()) / msPorDia);
  const semana = Math.floor(diff / 7) + 1;

  return { semana, anio };
}

// Inverso de calcularPeriodo: dado semana + anio, regresa las 7 fechas
// de ese periodo (sabado a viernes), con su etiqueta corta (DIA DD/MES).
const DIAS = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const MESES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

export function fechasDePeriodo(
  semana: number,
  anio: number
): { fecha: string; etiqueta: string }[] {
  function primerSabado(y: number): Date {
    const enero1 = new Date(y, 0, 1);
    const diaSemana = enero1.getDay();
    const diasHastaSabado = (6 - diaSemana + 7) % 7;
    return new Date(y, 0, 1 + diasHastaSabado);
  }

  const inicio = primerSabado(anio);
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
