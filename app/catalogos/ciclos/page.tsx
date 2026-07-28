import CatalogoSimple from "@/components/CatalogoSimple";

export default function CiclosPage() {
  return (
    <CatalogoSimple
      tabla="ciclos"
      titulo="Ciclos"
      subtitulo="2026-1 (primavera, ene-jun), 2026-2 (otoño, jul-dic)..."
      ordenPor="clave"
      campos={[
        { name: "clave", label: "Clave", type: "text", requerido: true },
        {
          name: "tipo",
          label: "Tipo",
          type: "select",
          options: [
            { value: "primavera", label: "Primavera" },
            { value: "otoño", label: "Otoño" },
          ],
        },
        { name: "anio", label: "Año", type: "number" },
        { name: "fecha_inicio", label: "Fecha inicio", type: "date" },
        { name: "fecha_fin", label: "Fecha fin", type: "date" },
      ]}
    />
  );
}
