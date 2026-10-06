export async function traerTodo<T = any>(
  construir: (desde: number, hasta: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>,
  tamanoPagina = 1000
): Promise<{ data: T[]; error: string | null }> {
  const todos: T[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await construir(desde, desde + tamanoPagina - 1);
    if (error) return { data: [], error: error.message };
    const pagina = (data ?? []) as T[];
    todos.push(...pagina);
    if (pagina.length < tamanoPagina) break;
    desde += tamanoPagina;
  }
  return { data: todos, error: null };
}
