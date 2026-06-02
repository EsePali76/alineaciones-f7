-- ============================================================================
--  Sembrar la rotación de turnos en ORDEN ALEATORIO (una vez).
--  Toma los jugadores elegibles (activos y no excluidos de la rotación), los
--  baraja al azar y los mete como cola; el primero queda como turno actual.
--  Ejecutar en Supabase → SQL Editor.
-- ============================================================================
update public.rotation r
set order_ids = sub.ids,
    current_player_id = sub.ids->>0,
    skipped_ids = '[]'::jsonb,
    updated_at = now()
from (
  select jsonb_agg(id order by random()) as ids
  from public.players
  where coalesce((data->>'activo')::boolean, true) = true
    and coalesce((data->>'excluidoRotacion')::boolean, false) = false
) sub
where r.id = 1;

-- Comprobar el resultado:
select current_player_id, order_ids from public.rotation where id = 1;
