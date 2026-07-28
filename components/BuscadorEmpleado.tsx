"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Empleado = { id: string; clave: string; nombre: string };

// Reemplaza al <datalist> nativo para catalogos grandes (miles de
// empleados): un <datalist> con miles de <option> traba el navegador.
// Aqui solo se dibujan las coincidencias mientras escribes (maximo 20).
export default function BuscadorEmpleado({
  empleados,
  valorTexto,
  onSeleccionar,
}: {
  empleados: Empleado[];
  valorTexto: string;
  onSeleccionar: (empleadoId: string | null, texto: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function manejarClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClicFuera);
    return () => document.removeEventListener("mousedown", manejarClicFuera);
  }, []);

  const coincidencias = useMemo(() => {
    const q = valorTexto.trim().toLowerCase();
    if (!q) return [];
    return empleados
      .filter(
        (e) => e.clave.toLowerCase().includes(q) || e.nombre.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [empleados, valorTexto]);

  return (
    <div className="relative" ref={contenedorRef}>
      <input
        className="input w-48"
        placeholder="Buscar clave o nombre..."
        value={valorTexto}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          onSeleccionar(null, e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && valorTexto.trim() && (
        <div className="absolute z-20 mt-1 max-h-56 w-72 overflow-y-auto rounded-md border border-campo-200 bg-white py-1 shadow-lg">
          {coincidencias.length === 0 && (
            <p className="px-3 py-2 text-xs text-campo-400">Sin coincidencias.</p>
          )}
          {coincidencias.map((e) => (
            <button
              key={e.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-campo-50"
              onClick={() => {
                onSeleccionar(e.id, `${e.clave} — ${e.nombre}`);
                setAbierto(false);
              }}
            >
              {e.clave} — {e.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
