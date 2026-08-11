import CatalogoSimple from "@/components/CatalogoSimple";

export default function UnidadesPage() {
  return (
    <CatalogoSimple
      tabla="catalogo_unidades"
      titulo="Unidades (tractores, camionetas...)"
      subtitulo="Cada unidad se liga a diesel o gasolina, para el control de combustible."
      ordenPor="nombre"
      campos={[
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        {
          name: "tipo_combustible",
          label: "Combustible",
          type: "select",
          requerido: true,
          options: [
            { value: "diesel", label: "Diésel" },
            { value: "gasolina", label: "Gasolina" },
          ],
        },
      ]}
    />
  );
}
