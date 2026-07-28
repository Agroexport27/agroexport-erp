export default function EnConstruccion({
  modulo,
  descripcion,
}: {
  modulo: string;
  descripcion: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-campo-900">{modulo}</h1>
      <div className="card mt-4 p-6">
        <p className="text-sm text-campo-600">
          Este módulo todavía no está construido. {descripcion}
        </p>
      </div>
    </div>
  );
}
