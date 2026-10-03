-- Tropical Honey deja de ser el cultivo "Sandía Mini Amarilla" aparte y
-- pasa a ser una variedad más de "Sandía Mini" (se distingue con
-- clasificación = 'Amarilla'). Esto:
-- 1) Mueve el cuadro 31 al cultivo Sandía Mini.
-- 2) Reasigna el corte ya capturado bajo Sandía Mini Amarilla a Sandía Mini
--    (conserva clasificacion='Amarilla' tal cual, solo cambia el cultivo).
-- 3) Desactiva el cultivo "Sandía Mini Amarilla" para que deje de aparecer
--    en los selects de captura (Corte diario, Embarques).

do $$
declare
  v_sandia_mini_id uuid;
  v_sandia_amarilla_id uuid;
begin
  select id into v_sandia_mini_id from cultivos where nombre = 'Sandía Mini';
  select id into v_sandia_amarilla_id from cultivos where nombre = 'Sandía Mini Amarilla';

  if v_sandia_mini_id is null then
    raise exception 'No se encontró el cultivo "Sandía Mini"';
  end if;
  if v_sandia_amarilla_id is null then
    raise exception 'No se encontró el cultivo "Sandía Mini Amarilla"';
  end if;

  -- 1) Mueve el cuadro "31" al cultivo Sandía Mini
  update cuadros
  set cultivo_id = v_sandia_mini_id
  where cultivo_id = v_sandia_amarilla_id
    and nombre = '31';

  -- 2) Reasigna el corte ya capturado bajo Sandía Mini Amarilla
  update corte_diario
  set cultivo_id = v_sandia_mini_id
  where cultivo_id = v_sandia_amarilla_id;

  -- 3) Desactiva el cultivo viejo (ya no debe usarse para capturar)
  update cultivos
  set activo = false
  where id = v_sandia_amarilla_id;
end $$;

NOTIFY pgrst, 'reload schema';

-- Verifica el resultado:
-- select id, nombre, cultivo_id from cuadros where nombre = '31';
-- select count(*) from corte_diario where cultivo_id = (select id from cultivos where nombre = 'Sandía Mini Amarilla');
-- select nombre, activo from cultivos where nombre like 'Sandía Mini%';
