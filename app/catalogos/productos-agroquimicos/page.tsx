import CatalogoSimple from "@/components/CatalogoSimple";

export default function ProductosAgroquimicosPage() {
  return (
    <CatalogoSimple
      tabla="catalogo_productos"
      titulo="Productos agroquímicos"
      subtitulo="Insecticidas, fungicidas, fertilizantes, herbicidas..."
      ordenPor="nombre"
      campos={[
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        {
          name: "unidad",
          label: "Unidad",
          type: "select",
          options: [
            { value: "LT", label: "LT" },
            { value: "KG", label: "KG" },
            { value: "LBS", label: "LBS" },
            { value: "GR", label: "GR" },
          ],
        },
        { name: "categoria", label: "Categoría", type: "text" },
        { name: "precio_presentacion", label: "Precio", type: "number" },
      ]}
    />
  );
}
