-- Dirección de Divine Flavor LLC para el manifiesto.
-- Si ya existe un distribuidor "Divine" (como sea que esté escrito), solo le
-- actualiza dirección/ciudad. Si no existe ninguno, lo crea.

update distribuidores
set direccion = '766 N TARGET RANGE RD',
    ciudad = 'NOGALES, ARIZONA, 85621'
where nombre ilike '%divine%';

insert into distribuidores (nombre, direccion, ciudad, activo)
select 'Divine Flavor LLC', '766 N TARGET RANGE RD', 'NOGALES, ARIZONA, 85621', true
where not exists (select 1 from distribuidores where nombre ilike '%divine%');

NOTIFY pgrst, 'reload schema';

-- Verifica el resultado:
-- select id, nombre, direccion, ciudad from distribuidores where nombre ilike '%divine%';
