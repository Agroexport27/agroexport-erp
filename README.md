# Agroexport ERP

Sistema interno de gestión agrícola: Planeación, Nóminas, Maquinaria, Riego,
Agroquímicos, Empaque, Cosecha y Embarques — todo conectado por cuadro y
ciclo.

## Cómo correrlo

1. Instala dependencias:
   ```
   npm install
   ```
2. Copia `.env.local.example` a `.env.local` y llena tus llaves de Supabase
   (Project Settings → API en tu proyecto de Supabase).
3. Corre en desarrollo:
   ```
   npm run dev
   ```
4. Abre http://localhost:3000

## Estructura

- `sql/001_schema.sql` — el esquema completo de base de datos (57 tablas).
  Ya debiste haberlo corrido en el SQL Editor de Supabase.
- `sql/002_rls_policies.sql` — políticas de seguridad (RLS). También ya
  corrido.
- `app/catalogos/campos` y `app/catalogos/cuadros` — el patrón de
  referencia para todos los catálogos editables (agregar, editar,
  eliminar, activar/desactivar). El resto de catálogos (proveedores,
  distribuidores, productos, viveros, actividades, vehículos...) se
  construyen replicando este mismo patrón.
- `lib/supabase/client.ts` — cliente de Supabase para el navegador.

## Siguientes pasos

- Réplica del patrón de catálogos para: ciclos, cultivos/variedades,
  viveros, proveedores de semilla, distribuidores, productos
  agroquímicos, materiales de empaque, actividades, vehículos.
- Autenticación (login) para los 6 usuarios del equipo.
- Módulos de captura diaria: apuntador, uso de maquinaria, riego,
  aplicaciones, corte diario, remisiones.
- Reportes y dashboards (costo por cuadro, utilidad por máquina,
  acumulado de agroquímicos, plan vs. real).
