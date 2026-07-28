import CatalogoSimple from "@/components/CatalogoSimple";

export default function CultivosPage() {
  return (
    <CatalogoSimple
      tabla="cultivos"
      titulo="Cultivos"
      subtitulo="Cada cultivo necesita su clave contable — de ahí parten los reportes de costo."
      ordenPor="nombre"
      campos={[
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        { name: "clave_contable", label: "Clave contable", type: "text", requerido: true },
      ]}
    />
  );
}
