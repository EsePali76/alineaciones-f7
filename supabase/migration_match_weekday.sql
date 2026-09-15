-- ---------------------------------------------------------------------------
-- MIGRACIÓN: día de la semana del partido configurable
--
-- Hasta ahora el día de partido estaba escrito en el código (lunes). Desde
-- septiembre de 2026 el campo se alquila los JUEVES, y nada garantiza que no
-- vuelva a cambiar, así que pasa a ser un dato: `rotation.match_weekday`, con la
-- misma numeración que `Date.getDay()` de JS y que `extract(dow …)` de Postgres
-- (0 domingo … 6 sábado).
--
-- Ojo a la diferencia con `match_date`, que ya existía y NO se toca:
--   · `match_weekday` = el día fijo de todas las semanas (jueves).
--   · `match_date`    = override de UN partido suelto (moverlo, o cancelarlo).
-- El override sigue mandando sobre el día fijo mientras no caduque.
--
-- La rotación de alineadores NO se ve afectada: esto solo mueve fechas.
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

-- Valor por defecto 4 = jueves (el día que toca ahora). El check evita que un
-- número raro deje la app calculando fechas imposibles.
alter table public.rotation
  add column if not exists match_weekday smallint not null default 4;

alter table public.rotation
  drop constraint if exists rotation_match_weekday_check;
alter table public.rotation
  add constraint rotation_match_weekday_check check (match_weekday between 0 and 6);

update public.rotation set match_weekday = 4 where id = 1;

-- Lo cambian admin Y superuser (`is_admin()` incluye a ambos), no el del turno:
-- la política RLS de `rotation` deja escribir al jugador de turno, y este dato es
-- del grupo entero. Por eso va por RPC y no por update directo.
create or replace function public.admin_set_match_weekday(p_dow smallint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo admin/superuser'; end if;
  if p_dow is null or p_dow < 0 or p_dow > 6 then raise exception 'Día inválido'; end if;
  update public.rotation set match_weekday = p_dow, updated_at = now() where id = 1;
end; $$;
