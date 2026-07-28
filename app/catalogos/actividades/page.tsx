import CatalogoSimple from "@/components/CatalogoSimple";

export default function ActividadesPage() {
  return (
    <CatalogoSimple
      tabla="actividades"
      titulo="Actividades"
      subtitulo="Catálogo de labores para el apuntador (deshierbe, riego, embarque...)"
      ordenPor="numero"
      campos={[
        { name: "numero", label: "Clave", type: "number" },
        { name: "nombre", label: "Nombre", type: "text", requerido: true },
        {
          name: "tipo_pago_permitido",
          label: "Tipo de pago",
          type: "select",
          options: [
            { value: "jornal", label: "Jornal" },
            { value: "destajo", label: "Destajo" },
            { value: "ambos", label: "Ambos" },
          ],
        },
      ]}
    />
  );
}
