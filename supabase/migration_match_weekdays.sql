-- ---------------------------------------------------------------------------
-- MIGRACIÓN: varios días de partido por semana
--
-- `match_weekday` guardaba UN día fijo. Alguna semana se juega dos veces y había
-- que cambiar el día a mano entre partido y partido, así que pasa a ser una
-- lista: `rotation.match_weekdays` (misma numeración que `Date.getDay()` de JS,
-- 0 domingo … 6 sábado). Cada día de la lista es una jornada propia.
--
-- `match_weekday` se deja en la tabla (la app ya no la lee) para poder volver
-- atrás sin perder el dato.
--
-- EJECUTAR ANTES de subir la versión de la app que lee `match_weekdays`, o la
-- carga de la rotación fallará al pedir una columna que no existe.
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

alter table public.rotation
  add column if not exists match_weekdays smallint[] not null default '{4}';

-- Arranca con el día que hubiera configurado.
update public.rotation set match_weekdays = array[match_weekday] where id = 1;

alter table public.rotation
  drop constraint if exists rotation_match_weekdays_check;
alter table public.rotation
  add constraint rotation_match_weekdays_check check (
    cardinality(match_weekdays) between 1 and 7
    and match_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );

-- Lo cambian admin Y superuser, por RPC (igual que `admin_set_match_weekday`):
-- la política RLS de `rotation` también deja escribir al jugador de turno.
create or replace function public.admin_set_match_weekdays(p_dows smallint[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo admin/superuser'; end if;
  if p_dows is null or cardinality(p_dows) = 0
     or not (p_dows <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]) then
    raise exception 'Días inválidos';
  end if;
  update public.rotation
     set match_weekdays = (select array_agg(distinct d order by d) from unnest(p_dows) d),
         updated_at = now()
   where id = 1;
end; $$;
