import CatalogoSimple from "@/components/CatalogoSimple";

export default function PuestosPage() {
  return (
    <CatalogoSimple
      tabla="catalogo_puestos"
      titulo="Puestos (censo)"
      subtitulo="Cada puesto debe ligarse a su actividad de costeo, para que el censo precargue el apuntador."
      ordenPor="categoria"
      campos={[
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        {
          name: "categoria",
          label: "Categoría",
          type: "select",
          options: [
            { value: "maquinaria_taller_almacen", label: "Maquinaria/Taller/Almacén" },
            { value: "riego", label: "Riego" },
            { value: "jornal", label: "Jornal" },
            { value: "operativo", label: "Operativo" },
            { value: "temporada", label: "Temporada" },
          ],
        },
        {
          name: "actividad_id",
          label: "Actividad de costeo",
          type: "select",
          relacion: { tabla: "actividades", valueCol: "id", labelCol: "nombre" },
        },
      ]}
    />
  );
}
