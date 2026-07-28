import CatalogoSimple from "@/components/CatalogoSimple";

export default function ViverosPage() {
  return (
    <CatalogoSimple
      tabla="viveros"
      titulo="Viveros"
      subtitulo="Proveedores externos de plántula: Nainari, JAM, Sierra Seed, Baja Plant, Full Count..."
      ordenPor="nombre"
      campos={[{ name: "nombre", label: "Nombre", type: "text", requerido: true }]}
    />
  );
}
