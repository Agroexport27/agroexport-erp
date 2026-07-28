-- =====================================================================
-- ROW LEVEL SECURITY
-- Activa RLS en todas las tablas y da acceso completo (select/insert/
-- update/delete) a cualquier usuario autenticado (que haya iniciado
-- sesion). Bloquea por completo el acceso anonimo/publico.
-- Correr este script DESPUES de 001_schema.sql
-- =====================================================================

alter table campos enable row level security;
create policy "campos_authenticated_all" on campos
  for all
  to authenticated
  using (true)
  with check (true);

alter table cuadros enable row level security;
create policy "cuadros_authenticated_all" on cuadros
  for all
  to authenticated
  using (true)
  with check (true);

alter table ciclos enable row level security;
create policy "ciclos_authenticated_all" on ciclos
  for all
  to authenticated
  using (true)
  with check (true);

alter table cultivos enable row level security;
create policy "cultivos_authenticated_all" on cultivos
  for all
  to authenticated
  using (true)
  with check (true);

alter table variedades enable row level security;
create policy "variedades_authenticated_all" on variedades
  for all
  to authenticated
  using (true)
  with check (true);

alter table cuadro_ciclo enable row level security;
create policy "cuadro_ciclo_authenticated_all" on cuadro_ciclo
  for all
  to authenticated
  using (true)
  with check (true);

alter table viveros enable row level security;
create policy "viveros_authenticated_all" on viveros
  for all
  to authenticated
  using (true)
  with check (true);

alter table proveedores_semilla enable row level security;
create policy "proveedores_semilla_authenticated_all" on proveedores_semilla
  for all
  to authenticated
  using (true)
  with check (true);

alter table programa_plantula enable row level security;
create policy "programa_plantula_authenticated_all" on programa_plantula
  for all
  to authenticated
  using (true)
  with check (true);

alter table solarizado enable row level security;
create policy "solarizado_authenticated_all" on solarizado
  for all
  to authenticated
  using (true)
  with check (true);

alter table ordenes_compra_semilla enable row level security;
create policy "ordenes_compra_semilla_authenticated_all" on ordenes_compra_semilla
  for all
  to authenticated
  using (true)
  with check (true);

alter table orden_compra_semilla_items enable row level security;
create policy "orden_compra_semilla_items_authenticated_all" on orden_compra_semilla_items
  for all
  to authenticated
  using (true)
  with check (true);

alter table empleados enable row level security;
create policy "empleados_authenticated_all" on empleados
  for all
  to authenticated
  using (true)
  with check (true);

alter table actividades enable row level security;
create policy "actividades_authenticated_all" on actividades
  for all
  to authenticated
  using (true)
  with check (true);

alter table centros_costo enable row level security;
create policy "centros_costo_authenticated_all" on centros_costo
  for all
  to authenticated
  using (true)
  with check (true);

alter table plan_semanal_labores enable row level security;
create policy "plan_semanal_labores_authenticated_all" on plan_semanal_labores
  for all
  to authenticated
  using (true)
  with check (true);

alter table apuntador_diario enable row level security;
create policy "apuntador_diario_authenticated_all" on apuntador_diario
  for all
  to authenticated
  using (true)
  with check (true);

alter table catalogo_puestos enable row level security;
create policy "catalogo_puestos_authenticated_all" on catalogo_puestos
  for all
  to authenticated
  using (true)
  with check (true);

alter table censo_diario enable row level security;
create policy "censo_diario_authenticated_all" on censo_diario
  for all
  to authenticated
  using (true)
  with check (true);

alter table censo_diario_detalle enable row level security;
create policy "censo_diario_detalle_authenticated_all" on censo_diario_detalle
  for all
  to authenticated
  using (true)
  with check (true);

alter table vehiculos enable row level security;
create policy "vehiculos_authenticated_all" on vehiculos
  for all
  to authenticated
  using (true)
  with check (true);

alter table catalogo_actividades_preparacion enable row level security;
create policy "catalogo_actividades_preparacion_authenticated_all" on catalogo_actividades_preparacion
  for all
  to authenticated
  using (true)
  with check (true);

alter table plan_preparacion_terreno enable row level security;
create policy "plan_preparacion_terreno_authenticated_all" on plan_preparacion_terreno
  for all
  to authenticated
  using (true)
  with check (true);

alter table preparacion_terreno_estatus enable row level security;
create policy "preparacion_terreno_estatus_authenticated_all" on preparacion_terreno_estatus
  for all
  to authenticated
  using (true)
  with check (true);

alter table uso_maquinaria enable row level security;
create policy "uso_maquinaria_authenticated_all" on uso_maquinaria
  for all
  to authenticated
  using (true)
  with check (true);

alter table mantenimiento_maquinaria enable row level security;
create policy "mantenimiento_maquinaria_authenticated_all" on mantenimiento_maquinaria
  for all
  to authenticated
  using (true)
  with check (true);

alter table tanque_combustible enable row level security;
create policy "tanque_combustible_authenticated_all" on tanque_combustible
  for all
  to authenticated
  using (true)
  with check (true);

alter table consumo_combustible enable row level security;
create policy "consumo_combustible_authenticated_all" on consumo_combustible
  for all
  to authenticated
  using (true)
  with check (true);

alter table horometro enable row level security;
create policy "horometro_authenticated_all" on horometro
  for all
  to authenticated
  using (true)
  with check (true);

alter table estaciones_humedad enable row level security;
create policy "estaciones_humedad_authenticated_all" on estaciones_humedad
  for all
  to authenticated
  using (true)
  with check (true);

alter table estacion_cuadro_ciclo enable row level security;
create policy "estacion_cuadro_ciclo_authenticated_all" on estacion_cuadro_ciclo
  for all
  to authenticated
  using (true)
  with check (true);

alter table lectura_humedad enable row level security;
create policy "lectura_humedad_authenticated_all" on lectura_humedad
  for all
  to authenticated
  using (true)
  with check (true);

alter table plan_riego enable row level security;
create policy "plan_riego_authenticated_all" on plan_riego
  for all
  to authenticated
  using (true)
  with check (true);

alter table plan_riego_producto enable row level security;
create policy "plan_riego_producto_authenticated_all" on plan_riego_producto
  for all
  to authenticated
  using (true)
  with check (true);

alter table riego_diario enable row level security;
create policy "riego_diario_authenticated_all" on riego_diario
  for all
  to authenticated
  using (true)
  with check (true);

alter table sistema_riego_cuadro enable row level security;
create policy "sistema_riego_cuadro_authenticated_all" on sistema_riego_cuadro
  for all
  to authenticated
  using (true)
  with check (true);

alter table catalogo_productos enable row level security;
create policy "catalogo_productos_authenticated_all" on catalogo_productos
  for all
  to authenticated
  using (true)
  with check (true);

alter table inventario_agroquimicos enable row level security;
create policy "inventario_agroquimicos_authenticated_all" on inventario_agroquimicos
  for all
  to authenticated
  using (true)
  with check (true);

alter table movimientos_inventario_agroquimicos enable row level security;
create policy "movimientos_inventario_agroquimicos_authenticated_all" on movimientos_inventario_agroquimicos
  for all
  to authenticated
  using (true)
  with check (true);

alter table solicitudes_producto enable row level security;
create policy "solicitudes_producto_authenticated_all" on solicitudes_producto
  for all
  to authenticated
  using (true)
  with check (true);

alter table aplicaciones enable row level security;
create policy "aplicaciones_authenticated_all" on aplicaciones
  for all
  to authenticated
  using (true)
  with check (true);

alter table aplicacion_foliar enable row level security;
create policy "aplicacion_foliar_authenticated_all" on aplicacion_foliar
  for all
  to authenticated
  using (true)
  with check (true);

alter table aplicacion_foliar_cuadro enable row level security;
create policy "aplicacion_foliar_cuadro_authenticated_all" on aplicacion_foliar_cuadro
  for all
  to authenticated
  using (true)
  with check (true);

alter table aplicacion_foliar_producto enable row level security;
create policy "aplicacion_foliar_producto_authenticated_all" on aplicacion_foliar_producto
  for all
  to authenticated
  using (true)
  with check (true);

alter table materiales_empaque enable row level security;
create policy "materiales_empaque_authenticated_all" on materiales_empaque
  for all
  to authenticated
  using (true)
  with check (true);

alter table inventario_materiales_empaque enable row level security;
create policy "inventario_materiales_empaque_authenticated_all" on inventario_materiales_empaque
  for all
  to authenticated
  using (true)
  with check (true);

alter table movimiento_material_empaque enable row level security;
create policy "movimiento_material_empaque_authenticated_all" on movimiento_material_empaque
  for all
  to authenticated
  using (true)
  with check (true);

alter table vale_material enable row level security;
create policy "vale_material_authenticated_all" on vale_material
  for all
  to authenticated
  using (true)
  with check (true);

alter table vale_material_detalle enable row level security;
create policy "vale_material_detalle_authenticated_all" on vale_material_detalle
  for all
  to authenticated
  using (true)
  with check (true);

alter table distribuidores enable row level security;
create policy "distribuidores_authenticated_all" on distribuidores
  for all
  to authenticated
  using (true)
  with check (true);

alter table calibres enable row level security;
create policy "calibres_authenticated_all" on calibres
  for all
  to authenticated
  using (true)
  with check (true);

alter table tipo_empaque enable row level security;
create policy "tipo_empaque_authenticated_all" on tipo_empaque
  for all
  to authenticated
  using (true)
  with check (true);

alter table receta_empaque enable row level security;
create policy "receta_empaque_authenticated_all" on receta_empaque
  for all
  to authenticated
  using (true)
  with check (true);

alter table estimado_cosecha enable row level security;
create policy "estimado_cosecha_authenticated_all" on estimado_cosecha
  for all
  to authenticated
  using (true)
  with check (true);

alter table corte_diario enable row level security;
create policy "corte_diario_authenticated_all" on corte_diario
  for all
  to authenticated
  using (true)
  with check (true);

alter table remision_envio enable row level security;
create policy "remision_envio_authenticated_all" on remision_envio
  for all
  to authenticated
  using (true)
  with check (true);

alter table remision_detalle enable row level security;
create policy "remision_detalle_authenticated_all" on remision_detalle
  for all
  to authenticated
  using (true)
  with check (true);
