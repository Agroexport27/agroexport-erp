-- =====================================================================
-- AGROEXPORT DE SONORA — ERP AGRÍCOLA
-- Esquema de base de datos completo (PostgreSQL / Supabase)
-- =====================================================================
-- Convenciones:
--  * Toda tabla usa id UUID como llave primaria (default gen_random_uuid())
--  * Toda tabla "catálogo" tiene columna `activo boolean default true`
--    en vez de borrarse físicamente cuando algo deja de usarse (soft delete),
--    pero la app permite eliminar libremente desde la UI (delete real)
--    salvo que haya movimientos históricos ligados — en ese caso se
--    recomienda desactivar en vez de borrar. Ambas operaciones están
--    disponibles.
--  * created_at / updated_at en todas las tablas para auditoría.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 0. NÚCLEO — campos, cuadros, ciclos, cultivos, variedades
-- =====================================================================

create table campos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cuadros (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references campos(id) on delete restrict,
  nombre text not null,                 -- ej. "13", "7 MALLA", "27A", "1 SUR"
  hectareas numeric(10,4) not null,
  bajo_malla boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

create table ciclos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,           -- ej. "2026-1", "2026-2"
  tipo text not null check (tipo in ('primavera','otoño')),
  anio int not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  created_at timestamptz not null default now()
);

create table cultivos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,          -- ej. "Sandía Mini", "Pepino", "Naranja"
  perenne boolean not null default false,
  activo boolean not null default true
);

create table variedades (
  id uuid primary key default gen_random_uuid(),
  cultivo_id uuid not null references cultivos(id) on delete restrict,
  nombre text not null,                 -- ej. "KALAHARI", "CANDY RED INJ"
  es_injerto boolean not null default false,
  dias_a_cosecha_estimado int,          -- ej. 86
  densidad_siembra_por_ha numeric(12,2),-- para calcular cantidad de plántula
  activo boolean not null default true,
  unique (cultivo_id, nombre)
);

-- qué se sembró en cada cuadro, en cada ciclo (llena Programa/Planeación)
create table cuadro_ciclo (
  id uuid primary key default gen_random_uuid(),
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  ciclo_id uuid not null references ciclos(id) on delete restrict,
  variedad_id uuid not null references variedades(id) on delete restrict,
  fecha_trasplante date,
  cantidad_plantas numeric(12,2),       -- calculado: hectareas * densidad
  millares numeric(12,3),               -- calculado: cantidad_plantas/1000
  created_at timestamptz not null default now(),
  unique (cuadro_id, ciclo_id, variedad_id)
);

-- =====================================================================
-- 1. PLANEACIÓN
-- =====================================================================

create table viveros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,          -- Nainari, JAM, Sierra Seed, Baja Plant, Full Count
  contacto text,
  activo boolean not null default true
);

create table proveedores_semilla (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,          -- JAM, AHERN, BD Water...
  contacto text,
  activo boolean not null default true
);

create table programa_plantula (
  id uuid primary key default gen_random_uuid(),
  vivero_id uuid not null references viveros(id) on delete restrict,
  ciclo_id uuid not null references ciclos(id) on delete restrict,
  campo_id uuid not null references campos(id) on delete restrict,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  variedad_id uuid not null references variedades(id) on delete restrict,
  rol text not null default 'principal' check (rol in ('principal','polinizador')),
  tipo text not null default 'semilla' check (tipo in ('semilla','injerto')),
  cantidad numeric(12,2) not null,
  fecha date not null,
  created_at timestamptz not null default now()
);

create table solarizado (
  id uuid primary key default gen_random_uuid(),
  ciclo_destino_id uuid not null references ciclos(id) on delete restrict,
  campo_id uuid not null references campos(id) on delete restrict,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  hectareas numeric(10,4) not null,
  fecha_inicio date,
  fecha_fin date,
  dias_cubierto int generated always as (case when fecha_inicio is not null and fecha_fin is not null
      then (fecha_fin - fecha_inicio) else null end) stored,
  costo_plastico numeric(12,2),
  costo_mano_obra numeric(12,2),
  costo_total numeric(12,2) generated always as (coalesce(costo_plastico,0)+coalesce(costo_mano_obra,0)) stored,
  estatus text not null default 'planeado' check (estatus in ('planeado','en_proceso','terminado')),
  created_at timestamptz not null default now()
);

create table ordenes_compra_semilla (
  id uuid primary key default gen_random_uuid(),
  numero_orden int generated always as identity,
  proveedor_semilla_id uuid not null references proveedores_semilla(id) on delete restrict,
  ciclo_id uuid references ciclos(id),
  campo_id uuid references campos(id),
  cultivo_id uuid references cultivos(id),
  fecha date not null,
  autorizado_por text,
  estatus text not null default 'pendiente' check (estatus in ('pendiente','surtida')),
  created_at timestamptz not null default now()
);

create table orden_compra_semilla_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_compra_semilla(id) on delete cascade,
  cantidad numeric(12,2) not null,      -- millares
  descripcion text not null,
  precio_unitario numeric(12,2),
  importe numeric(12,2) generated always as (cantidad*coalesce(precio_unitario,0)) stored
);

-- =====================================================================
-- 2. NÓMINAS / MANO DE OBRA
-- =====================================================================

create table empleados (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  tipo_nomina text not null check (tipo_nomina in ('planta','temporal')),
  campo_base_id uuid references campos(id),
  activo boolean not null default true
);

create table actividades (
  id uuid primary key default gen_random_uuid(),
  numero int,
  nombre text not null unique,          -- catálogo real: rastreo, deshierbe, riego, embarque...
  categoria text,                       -- jornal, riego, maquinaria/taller, operativo
  tipo_pago_permitido text not null default 'ambos' check (tipo_pago_permitido in ('jornal','destajo','ambos')),
  unidad_destajo text,                  -- surco, caja, metro...
  activo boolean not null default true
);

create table centros_costo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('cultivo_ciclo','indirectos','solarizado','vivero','composta')),
  campo_id uuid references campos(id),
  ciclo_id uuid references ciclos(id),
  cultivo_id uuid references cultivos(id)
);

create table plan_semanal_labores (
  id uuid primary key default gen_random_uuid(),
  semana int not null,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  actividad_id uuid not null references actividades(id) on delete restrict,
  fecha_planeada date,
  jornales_estimados numeric(10,2),
  cantidad_estimada numeric(12,2),
  costo_estimado numeric(12,2),
  created_at timestamptz not null default now()
);

create table apuntador_diario (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete restrict,
  fecha date not null,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  actividad_id uuid not null references actividades(id) on delete restrict,
  tipo_pago text not null check (tipo_pago in ('jornal','destajo')),
  dias numeric(6,2),                    -- si es jornal
  avance numeric(12,2),                 -- si es destajo (surcos, cajas, metros...)
  tarifa numeric(12,2) not null,
  total numeric(12,2) generated always as (tarifa * coalesce(dias, avance, 0)) stored,
  plan_semanal_id uuid references plan_semanal_labores(id),
  created_at timestamptz not null default now()
);

create table catalogo_puestos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  categoria text not null check (categoria in ('maquinaria_taller_almacen','riego','jornal','operativo','temporada')),
  activo boolean not null default true
);

create table censo_diario (
  id uuid primary key default gen_random_uuid(),
  folio text unique,
  campo_id uuid not null references campos(id) on delete restrict,
  fecha date not null,
  created_at timestamptz not null default now()
);

create table censo_diario_detalle (
  id uuid primary key default gen_random_uuid(),
  censo_id uuid not null references censo_diario(id) on delete cascade,
  puesto_id uuid references catalogo_puestos(id),
  puesto_texto_libre text,              -- para "actividad por temporada" no catalogada
  cuadro_id uuid references cuadros(id),
  cantidad_personas int not null
);

-- =====================================================================
-- 3. MAQUINARIA
-- =====================================================================

create table vehiculos (
  id uuid primary key default gen_random_uuid(),
  numero int,
  nombre text not null,                 -- Tractor 5204, Pipa Ford, Hilux, Dron...
  tipo text not null default 'tractor', -- tractor, pipa, camioneta, cuatrimoto, dron, retro...
  campo_base_id uuid references campos(id),
  operador_default text,
  proveedor text,
  tarifa_interna_por_turno numeric(12,2),
  activo boolean not null default true
);

create table catalogo_actividades_preparacion (
  id uuid primary key default gen_random_uuid(),
  orden int not null,
  nombre text not null unique,          -- Desvaradora, Cuchilla, Sacar plástico...
  requiere_maquinaria boolean not null default true
);

create table plan_preparacion_terreno (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclos(id) on delete restrict,
  campo_id uuid not null references campos(id) on delete restrict,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  hectareas numeric(10,4) not null,
  fecha_objetivo date
);

create table preparacion_terreno_estatus (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plan_preparacion_terreno(id) on delete cascade,
  actividad_prep_id uuid not null references catalogo_actividades_preparacion(id) on delete restrict,
  completado boolean not null default false,
  fecha_completado date,
  unique (plan_id, actividad_prep_id)
);

create table uso_maquinaria (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references vehiculos(id) on delete restrict,
  fecha date not null,
  campo_id uuid references campos(id),
  cuadro_id uuid references cuadros(id),
  actividad_id uuid references actividades(id),
  operador text,
  turnos numeric(6,2) not null default 0,
  horas numeric(8,2),
  ingreso_interno numeric(12,2),        -- calculado: turnos * tarifa_interna_por_turno del vehículo
  created_at timestamptz not null default now()
);

create table mantenimiento_maquinaria (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references vehiculos(id) on delete restrict,
  problema text,
  fecha_salida date,
  fecha_reingreso date,
  costo numeric(12,2) not null default 0,
  estado_pago text
);

create table tanque_combustible (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('diesel','gasolina')),
  fecha date not null,
  folio text,
  litros_entrada numeric(12,2) not null,
  precio_litro numeric(10,2)
);

create table consumo_combustible (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references vehiculos(id) on delete restrict,
  fecha date not null,
  chofer text,
  litros numeric(10,2) not null,
  folio text,
  campo_id uuid references campos(id),
  tipo text not null check (tipo in ('diesel','gasolina')),
  observaciones text
);

create table horometro (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references vehiculos(id) on delete restrict,
  fecha date not null,
  horas_acumuladas numeric(10,2) not null
);

-- =====================================================================
-- 4. RIEGO
-- =====================================================================

create table estaciones_humedad (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  campo_id uuid not null references campos(id) on delete restrict
);

create table estacion_cuadro_ciclo (
  id uuid primary key default gen_random_uuid(),
  estacion_id uuid not null references estaciones_humedad(id) on delete cascade,
  ciclo_id uuid not null references ciclos(id) on delete restrict,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  unique (estacion_id, ciclo_id, cuadro_id)
);

create table lectura_humedad (
  id uuid primary key default gen_random_uuid(),
  estacion_id uuid not null references estaciones_humedad(id) on delete restrict,
  fecha date not null,
  profundidad text not null check (profundidad in ('20cm','40cm')),
  lectura_centibar numeric(6,2)
);

create table plan_riego (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  hora_inicio time,
  hora_fin time,
  horas_programadas numeric(6,2)
);

create table plan_riego_producto (
  id uuid primary key default gen_random_uuid(),
  plan_riego_id uuid not null references plan_riego(id) on delete cascade,
  producto_id uuid not null,            -- fk a catalogo_productos (definida abajo)
  cantidad numeric(12,3) not null,
  unidad text not null check (unidad in ('kg','lt'))
);

create table riego_diario (
  id uuid primary key default gen_random_uuid(),
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  fecha date not null,
  horas_riego numeric(6,2) not null,
  observaciones text
);

create table sistema_riego_cuadro (
  id uuid primary key default gen_random_uuid(),
  cuadro_id uuid not null references cuadros(id) on delete cascade,
  vigente_desde date not null default current_date,
  caudal_gotero_lh numeric(8,3) not null,      -- L/h
  separacion_goteros_m numeric(8,3) not null,  -- m
  separacion_lineas_m numeric(8,3) not null    -- m
);

-- =====================================================================
-- 5. AGROQUÍMICOS
-- =====================================================================

create table catalogo_productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  unidad text not null check (unidad in ('LT','KG','LBS','GR')),
  categoria text,                       -- insecticidas, fungicidas, fertilizantes, herbicidas...
  precio_presentacion numeric(12,2),
  distribuidor text,
  activo boolean not null default true
);

alter table plan_riego_producto
  add constraint fk_plan_riego_producto_producto
  foreign key (producto_id) references catalogo_productos(id) on delete restrict;

create table inventario_agroquimicos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references catalogo_productos(id) on delete restrict,
  campo_id uuid not null references campos(id) on delete restrict,
  stock_actual numeric(14,3) not null default 0,
  unique (producto_id, campo_id)
);

create table movimientos_inventario_agroquimicos (
  id uuid primary key default gen_random_uuid(),
  folio text,
  producto_id uuid not null references catalogo_productos(id) on delete restrict,
  campo_id uuid not null references campos(id) on delete restrict,
  fecha date not null,
  tipo text not null check (tipo in ('entrada','salida')),
  cantidad numeric(14,3) not null,
  observaciones text,
  origen_tipo text,                     -- 'aplicacion' | 'aplicacion_foliar' | 'solicitud' | 'ajuste_manual'
  origen_id uuid,
  created_at timestamptz not null default now()
);

create table solicitudes_producto (
  id uuid primary key default gen_random_uuid(),
  numero_solicitud text,
  producto_id uuid not null references catalogo_productos(id) on delete restrict,
  presentacion text,
  unidad text,
  cantidad_solicitada numeric(14,3) not null,
  fecha date not null,
  campo_id uuid references campos(id),
  cantidad_recibida numeric(14,3),
  diferencia numeric(14,3) generated always as (coalesce(cantidad_recibida,0) - cantidad_solicitada) stored,
  observacion text
);

-- aplicaciones vía fertirriego (se generan desde plan_riego_producto) +
-- aplicaciones foliares/aspersión, unificadas para efectos de acumulado
create table aplicaciones (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references catalogo_productos(id) on delete restrict,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  ciclo_id uuid not null references ciclos(id) on delete restrict,
  fecha date not null,
  cantidad numeric(14,3) not null,
  unidad text not null,
  tipo text not null check (tipo in ('fertirriego','foliar')),
  metodo text,                          -- aspersora manual, aspersora de tractor...
  origen_tipo text,                     -- 'plan_riego_producto' | 'aplicacion_foliar_producto'
  origen_id uuid
);

create table aplicacion_foliar (
  id uuid primary key default gen_random_uuid(),
  folio text unique,
  campo_id uuid not null references campos(id) on delete restrict,
  cultivo_id uuid references cultivos(id),
  variedad_id uuid references variedades(id),
  superficie_has numeric(10,4),
  fecha_aplicacion date not null,
  fecha_reingreso date,
  triple_lavado boolean,
  operador text,
  no_tractor text,
  no_aspersora text,
  lts_por_tanque numeric(10,2),
  has_por_tanque numeric(10,2),
  no_cargas int,
  se_calibro_equipo boolean,
  hora_inicio time,
  hora_termino time,
  gerente_campo text,
  encargado_aplicaciones text,
  created_at timestamptz not null default now()
);

create table aplicacion_foliar_cuadro (
  id uuid primary key default gen_random_uuid(),
  aplicacion_foliar_id uuid not null references aplicacion_foliar(id) on delete cascade,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  hectareas numeric(10,4) not null       -- para prorratear el total de producto
);

create table aplicacion_foliar_producto (
  id uuid primary key default gen_random_uuid(),
  aplicacion_foliar_id uuid not null references aplicacion_foliar(id) on delete cascade,
  producto_id uuid not null references catalogo_productos(id) on delete restrict,
  ingrediente_activo text,
  dosis_ha numeric(12,4),
  dosis_tanque numeric(12,4),
  para_control_de text,
  total_utilizado numeric(14,3),
  observaciones text
);

-- =====================================================================
-- 6. INVENTARIO DE MATERIALES DE EMPAQUE
-- =====================================================================

create table materiales_empaque (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,          -- Caja Dulcinea Manual, Separador Star, Fleje...
  cultivo_id uuid references cultivos(id),
  proveedor text,
  precio numeric(12,2),
  campo_id uuid references campos(id),
  activo boolean not null default true
);

create table inventario_materiales_empaque (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiales_empaque(id) on delete restrict,
  campo_id uuid not null references campos(id) on delete restrict,
  stock_actual numeric(14,3) not null default 0,
  unique (material_id, campo_id)
);

create table movimiento_material_empaque (
  id uuid primary key default gen_random_uuid(),
  folio text,
  material_id uuid not null references materiales_empaque(id) on delete restrict,
  campo_id uuid not null references campos(id) on delete restrict,
  fecha date not null,
  tipo text not null check (tipo in ('entrada','salida')),
  cantidad numeric(14,3) not null,
  observaciones text,
  origen_tipo text,                     -- 'corte_diario' | 'vale_material' | 'ajuste_manual'
  origen_id uuid
);

-- vale general de entrada/salida (formato físico usado en campo; puede
-- registrar movimientos que no vienen de producción, ej. venta de merma)
create table vale_material (
  id uuid primary key default gen_random_uuid(),
  folio text unique,
  tipo text not null check (tipo in ('entrada','salida')),
  campo_id uuid references campos(id),
  cuadro_id uuid references cuadros(id),
  cultivo_id uuid references cultivos(id),
  fecha date not null,
  numero_salida_entrada text,
  recibio_mercancia text,
  entrego_mercancia text,
  autorizado_por text,
  notas_devolucion text
);

create table vale_material_detalle (
  id uuid primary key default gen_random_uuid(),
  vale_id uuid not null references vale_material(id) on delete cascade,
  partida int,
  cantidad numeric(14,3),
  unidad text,
  descripcion text not null,
  precio numeric(12,2),
  importe numeric(14,2)
);

-- =====================================================================
-- 7. COSECHA / EMPAQUE
-- =====================================================================

create table distribuidores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,          -- Dulcinea, Giumarra, Robinson Fresh, Divine Flavor, Nacional...
  porcentaje_asignado numeric(6,4),
  activo boolean not null default true
);

create table calibres (
  id uuid primary key default gen_random_uuid(),
  cultivo_id uuid references cultivos(id),
  nombre text not null,                 -- 6, 8, 9, M9, 11, 8COS, FT8C, 6J, 6JXL, 4DCos, 4D, Otras
  cajas_por_pallet numeric(8,2),
  cajas_por_bin numeric(8,2),
  unique (cultivo_id, nombre)
);

create table tipo_empaque (
  id uuid primary key default gen_random_uuid(),
  distribuidor_id uuid references distribuidores(id),
  nombre text not null                  -- "Exportación 5 Down Calibre 6", "Malla 8", "Caja 4 Down"...
);

create table receta_empaque (
  id uuid primary key default gen_random_uuid(),
  tipo_empaque_id uuid not null references tipo_empaque(id) on delete cascade,
  material_id uuid not null references materiales_empaque(id) on delete restrict,
  cantidad_por_caja numeric(10,4) not null   -- ej. 1 caja, 1 separador, 6 etiquetas, 0.02 tarima
);

create table estimado_cosecha (
  id uuid primary key default gen_random_uuid(),
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  ciclo_id uuid not null references ciclos(id) on delete restrict,
  variedad_id uuid references variedades(id),
  fecha_siembra date,
  fecha_inicio_cosecha_estimada date,   -- calculado: fecha_siembra + dias_a_cosecha_estimado
  fecha date,                           -- día específico dentro de la curva
  cajas_estimadas numeric(12,2)
);

create table corte_diario (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  campo_id uuid not null references campos(id) on delete restrict,
  cuadro_id uuid not null references cuadros(id) on delete restrict,
  cultivo_id uuid references cultivos(id),
  distribuidor_id uuid not null references distribuidores(id) on delete restrict,
  calibre_id uuid not null references calibres(id) on delete restrict,
  tipo_empaque_id uuid references tipo_empaque(id),
  tipo_unidad text not null check (tipo_unidad in ('pallet','bins')),
  cantidad_unidades numeric(10,2) not null,   -- pallets o bins
  cajas numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 8. EMBARQUES
-- =====================================================================

create table remision_envio (
  id uuid primary key default gen_random_uuid(),
  productor text not null default 'Agroexport',
  distribuidor_id uuid not null references distribuidores(id) on delete restrict,
  fecha_empaque date not null,
  manifiesto text,                      -- debe coincidir con número de factura
  cuadro_id uuid references cuadros(id),-- "Work Orden"/"Lote"
  caja_transporte text,                 -- unidad/trailer, no confundir con "caja" producto
  campo_id uuid references campos(id),
  empaque text check (empaque in ('Convencional','Orgánico','Regular','REOrgánico','Amarilla')),
  created_at timestamptz not null default now()
);

create table remision_detalle (
  id uuid primary key default gen_random_uuid(),
  remision_id uuid not null references remision_envio(id) on delete cascade,
  calibre_id uuid references calibres(id),
  etiqueta_libre text,                  -- para tipos especiales: "Jumbo 6", "Costco 8", "FT Costco 8"
  cantidad_cajas numeric(10,2) default 0,
  cantidad_bins numeric(10,2) default 0
);

-- =====================================================================
-- FIN DEL ESQUEMA BASE
-- Siguiente paso sugerido: políticas de RLS (row level security) por
-- rol de usuario, vistas de reportes (costo por cuadro, utilidad por
-- máquina, acumulado de agroquímicos, etc.), y triggers para automatizar
-- las salidas de inventario descritas en el diseño.
-- =====================================================================
