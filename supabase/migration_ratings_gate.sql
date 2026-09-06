-- ---------------------------------------------------------------------------
-- MIGRACIÓN: "solo alinea quien ha valorado a todos"
--
-- Añade un interruptor global (lo activa el admin desde el menú Usuarios) que
-- saca de la cola de alineadores a quien no haya valorado a TODOS los jugadores
-- valorables. Desactivado, la rotación funciona exactamente como hasta ahora.
--
-- OJO al criterio: es "tener voto para todos", NO "haber pulsado Finalizar".
-- Finalizar sigue siendo lo que BLOQUEA tus votos; esto solo mira si están
-- puestos. Alguien con todo valorado y sin finalizar SÍ entra en la cola.
--
-- Por qué hace falta una vista y no se calcula en el navegador: el turno lo ve
-- todo el grupo, pero `ratings` está protegido por RLS (cada uno solo lee sus
-- propios votos). Sin esto, cada usuario calcularía un turno distinto. La vista
-- expone ÚNICAMENTE el recuento (cuántos lleva de cuántos), nunca los votos.
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

-- 1) Interruptor global, en la fila singleton de rotation (id = 1).
alter table public.rotation
  add column if not exists require_ratings boolean not null default false;

-- 2) Solo el admin real lo conmuta (mismo patrón que admin_set_ratings_open).
create or replace function public.admin_set_require_ratings(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.rotation set require_ratings = p_on, updated_at = now() where id = 1;
end; $$;

-- 3) Progreso de valoraciones por jugador (SIN exponer ningún voto).
--
--    `security_invoker = false` (el valor por defecto, explícito aquí para que se
--    vea la intención): la vista corre con los permisos de su dueño, así que
--    atraviesa el RLS de `ratings` y puede contar los votos de todos. Lo único
--    que sale de aquí son dos números por jugador.
--
--    Quién es "valorable" tiene que coincidir con la lista de la pestaña Valorar
--    (ver `aValorar` en RatePlayers.tsx): activos, sin el invitado puntual (el
--    que no es habitual) y sin uno mismo.
create or replace view public.rating_progress
with (security_invoker = false) as
with valorables as (
  select p.id
  from public.players p
  where coalesce((p.data->>'activo')::boolean, true)
    and not (
      coalesce((p.data->>'invitado')::boolean, false)
      and not coalesce((p.data->>'habitual')::boolean, false)
    )
)
select
  pr.player_id,
  (select count(*) from valorables v where v.id <> pr.player_id)::int as total,
  (
    select count(*)
    from public.ratings r
    join valorables v on v.id = r.ratee_player_id
    where r.rater_id = pr.id
      and r.ratee_player_id <> pr.player_id
      -- Mismo criterio que el tick verde de la pestana Valorar
      -- (`mine.get(p.id)?.general != null`): cuenta tener puesta la GENERAL, que
      -- es el ancla. Si aqui se contara "cualquier faceta", el usuario veria un
      -- circulo vacio en su lista y el servidor lo dara por valorado.
      and (r."values"->>'general') is not null
  )::int as valorados
from public.profiles pr
where pr.player_id is not null;

grant select on public.rating_progress to authenticated;
