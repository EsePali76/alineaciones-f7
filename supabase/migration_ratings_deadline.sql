-- ---------------------------------------------------------------------------
-- MIGRACIÓN: fecha de cierre del plazo de reevaluación
--
-- El admin puede poner una fecha límite al plazo de reevaluación. Llegada esa
-- fecha (al acabar el día), el plazo deja de estar vigente por sí solo.
--
-- NO hay tarea programada ni cron: el cierre es DERIVADO. `ratings_open` sigue
-- siendo la intención del admin ("lo he abierto") y la fecha es su caducidad;
-- la app calcula el plazo vigente como "abierto Y no vencido" (ver
-- `domain/ratingsWindow.ts`). Así no hay estado que se pueda quedar a medias si
-- nadie entra en la app el día del vencimiento — es el mismo criterio con el que
-- caduca el override de fecha de partido.
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

-- Fecha límite del plazo (inclusive). null = plazo sin fecha de fin.
alter table public.rotation
  add column if not exists ratings_deadline date;

create or replace function public.admin_set_ratings_deadline(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.rotation set ratings_deadline = p_date, updated_at = now() where id = 1;
end; $$;
