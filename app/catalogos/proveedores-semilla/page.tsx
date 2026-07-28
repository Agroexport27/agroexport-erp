import CatalogoSimple from "@/components/CatalogoSimple";

export default function ProveedoresSemillaPage() {
  return (
    <CatalogoSimple
      tabla="proveedores_semilla"
      titulo="Proveedores de semilla"
      subtitulo="JAM, AHERN, BD Water..."
      ordenPor="nombre"
      campos={[{ name: "nombre", label: "Nombre", type: "text", requerido: true }]}
    />
  );
}
