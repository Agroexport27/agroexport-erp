"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InventarioAgroquimicosPage() {
  const supabase = createClient();
  const [filas, setFilas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [soloConStock, setSoloConStock] = useState(true);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventario_agroquimicos")
      .select("id, stock_actual, campos(nombre), catalogo_productos(nombre, unidad, categoria)")
      .order("stock_actual", { ascending: false });
    if (error) setError(error.message);
    else setFilas(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f: any) => {
      if (soloConStock && Number(f.stock_actual) === 0) return false;
      if (!q) return true;
      return (
        f.catalogo_productos?.nombre?.toLowerCase().includes(q) ||
        f.campos?.nombre?.toLowerCase().includes(q)
      );
    });
  }, [filas, busqueda, soloConStock]);

  const porCampo = useMemo(() => {
    const mapa = new Map<string, any[]>();
    for (const f of filasVisibles) {
      const campo = f.campos?.nombre ?? "Sin campo";
      if (!mapa.has(campo)) mapa.set(campo, []);
      mapa.get(campo)!.push(f);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filasVisibles]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">
        Inventario — Agroquímicos
      </h1>
      <p className="mb-6 text-sm text-campo-600">
        Existencias actuales, calculadas automáticamente de tus entradas y
        salidas.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-4 flex items-center justify-between gap-3 p-4">
        <input
          className="input max-w-xs"
          placeholder="Buscar producto o campo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-campo-600">
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(e) => setSoloConStock(e.target.checked)}
          />
          Solo con existencia
        </label>
      </div>

      {loading && <p className="text-sm text-campo-400">Cargando...</p>}

      {porCampo.map(([campo, items]) => (
        <div key={campo} className="card mb-4 overflow-hidden">
          <div className="bg-campo-50 px-4 py-2">
            <h2 className="text-sm font-semibold text-campo-800">{campo}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-campo-600">
              <tr>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2">Stock actual</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f: any) => (
                <tr key={f.id} className="border-t border-campo-50">
                  <td className="px-4 py-2 text-campo-800">{f.catalogo_productos?.nombre}</td>
                  <td className="px-4 py-2 text-campo-600">{f.catalogo_productos?.categoria}</td>
                  <td className="px-4 py-2 text-campo-800">
                    {Number(f.stock_actual).toLocaleString()} {f.catalogo_productos?.unidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {!loading && porCampo.length === 0 && (
        <p className="text-sm text-campo-400">
          Sin existencias todavía. Captura movimientos en "Entradas y salidas".
        </p>
      )}
    </div>
  );
}
