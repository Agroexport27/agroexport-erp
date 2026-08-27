import CatalogoSimple from "@/components/CatalogoSimple";

export default function UnidadesPage() {
  return (
    <CatalogoSimple
      tabla="vehiculos"
      titulo="Unidades (tractores, camionetas...)"
      subtitulo="Es el mismo catálogo que Planeación → Vehículos — cualquier cambio aquí se ve allá también."
      ordenPor="nombre"
      campos={[
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        { name: "tipo", label: "Tipo", type: "text" },
        {
          name: "campo_base_id",
          label: "Campo",
          type: "select",
          relacion: { tabla: "campos", valueCol: "id", labelCol: "nombre" },
        },
        { name: "tarifa_interna_por_turno", label: "Tarifa/turno", type: "number" },
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
