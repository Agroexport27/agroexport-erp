// `new Date().toISOString().slice(0, 10)` calcula la fecha en UTC, no en la
// hora local del navegador. Como el UTC va ~7 horas adelante de Hermosillo,
// a partir de las ~17:00 hora local ya "es mañana" en UTC, y los formularios
// que usan esa fecha como valor por default arrancan mostrando el día
// equivocado (ej. capturar un corte de la noche del 2/oct y que aparezca
// 3/oct). Esta función arma la fecha con los componentes LOCALES del
// navegador (getFullYear/getMonth/getDate), evitando ese corrimiento.
export function fechaLocalHoy(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
