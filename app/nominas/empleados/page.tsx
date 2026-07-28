import CatalogoSimple from "@/components/CatalogoSimple";

export default function EmpleadosPage() {
  return (
    <CatalogoSimple
      tabla="empleados"
      titulo="Empleados"
      subtitulo="Base de claves — planta y temporal. Solo clave y nombre son obligatorios."
      ordenPor="clave"
      ordenNumerico
      campos={[
        { name: "clave", label: "Clave", type: "text", requerido: true },
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        { name: "curp", label: "CURP", type: "text" },
        { name: "rfc", label: "RFC", type: "text" },
        { name: "nss", label: "NSS", type: "text" },
        { name: "codigo_postal", label: "C.P.", type: "text" },
        {
          name: "tipo_nomina",
          label: "Tipo de nómina",
          type: "select",
          options: [
            { value: "planta", label: "Planta" },
            { value: "temporal", label: "Temporal" },
          ],
        },
        {
          name: "campo_base_id",
          label: "Campo base",
          type: "select",
          relacion: { tabla: "campos", valueCol: "id", labelCol: "nombre" },
        },
      ]}
    />
  );
}
