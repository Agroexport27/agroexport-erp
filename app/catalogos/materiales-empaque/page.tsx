import CatalogoSimple from "@/components/CatalogoSimple";

export default function MaterialesEmpaquePage() {
  return (
    <CatalogoSimple
      tabla="materiales_empaque"
      titulo="Materiales de empaque"
      subtitulo="Cajas, separadores, esquineros, flejes, etiquetas..."
      ordenPor="nombre"
      campos={[
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        { name: "proveedor", label: "Proveedor", type: "text" },
        { name: "precio", label: "Precio", type: "number" },
      ]}
    />
  );
}
