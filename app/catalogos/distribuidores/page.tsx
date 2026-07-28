import CatalogoSimple from "@/components/CatalogoSimple";

export default function DistribuidoresPage() {
  return (
    <CatalogoSimple
      tabla="distribuidores"
      titulo="Distribuidores"
      subtitulo="Dulcinea, Giumarra, Robinson Fresh, Divine Flavor, Nacional..."
      ordenPor="nombre"
      campos={[
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        { name: "porcentaje_asignado", label: "% de cosecha asignado", type: "number" },
      ]}
    />
  );
}
