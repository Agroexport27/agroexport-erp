"use client";

import { useEffect, useRef, useState } from "react";

type Opcion = { id: string; label: string; grupo?: string };

export default function MultiSelectCuadros({
  opciones,
  seleccionados,
  onChange,
}: {
  opciones: Opcion[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function manejarClicFuera(e: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClicFuera);
    return () => document.removeEventListener("mousedown", manejarClicFuera);
  }, []);

  const grupos = opciones
    .filter((o) => o.label.toLowerCase().includes(busqueda.toLowerCase()))
    .reduce<Record<string, Opcion[]>>((acc, o) => {
      const g = o.grupo ?? "Otros";
      acc[g] = acc[g] ?? [];
      acc[g].push(o);
      return acc;
    }, {});

  function toggle(id: string) {
    if (seleccionados.includes(id)) {
      onChange(seleccionados.filter((s) => s !== id));
    } else {
      onChange([...seleccionados, id]);
    }
  }

  function quitar(id: string) {
    onChange(seleccionados.filter((s) => s !== id));
  }

  const etiquetaPorId = (id: string) =>
    opciones.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="relative" ref={contenedorRef}>
      <div
        className="input flex min-h-[38px] cursor-pointer flex-wrap items-center gap-1 py-1"
        onClick={() => setAbierto((a) => !a)}
      >
        {seleccionados.length === 0 && (
          <span className="text-campo-400">General (sin cuadro) — clic para elegir</span>
        )}
        {seleccionados.map((id) => (
          <span
            key={id}
            className="flex items-center gap-1 rounded-full bg-campo-100 px-2 py-0.5 text-xs text-campo-700"
          >
            {etiquetaPorId(id)}
            <button
              type="button"
              className="text-campo-500 hover:text-campo-800"
              onClick={(e) => {
                e.stopPropagation();
                quitar(id);
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {abierto && (
        <div className="absolute z-20 mt-1 w-[min(20rem,90vw)] rounded-md border border-campo-200 bg-white p-2 shadow-lg">
          <input
            autoFocus
            className="input mb-2"
            placeholder="Buscar cuadro..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="max-h-52 overflow-y-auto">
            {Object.entries(grupos).map(([grupo, opts]) => (
              <div key={grupo} className="mb-2">
                <p className="mb-1 text-xs font-semibold text-campo-500">
                  {grupo}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {opts.map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 text-sm hover:bg-campo-50"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(o.id)}
                        onChange={() => toggle(o.id)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(grupos).length === 0 && (
              <p className="text-sm text-campo-400">Sin resultados.</p>
            )}
          </div>
          <button
            className="btn-secondary mt-2 w-full text-xs"
            onClick={() => setAbierto(false)}
          >
            Listo
          </button>
        </div>
      )}
    </div>
  );
}
