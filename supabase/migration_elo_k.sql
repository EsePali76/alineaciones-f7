-- ---------------------------------------------------------------------------
-- MIGRACIÓN: K del ajuste por resultados
--
-- La nota de cada jugador es su valoración más un ajuste que sube o baja con los
-- partidos que gana o pierde (ver `src/domain/ajuste.ts`). La K (cuánto se mueve
-- por partido) la configura el admin desde «Usuarios» y se guarda aquí. Cada
-- partido guarda en su `data` la K vigente al registrar su resultado, así que
-- cambiarla NO afecta a los partidos ya jugados.
--
-- La app tolera que esta columna no exista (usa K 0,5), pero hasta ejecutar esto
-- el admin no puede cambiarla.
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

alter table public.rotation
  add column if not exists elo_k numeric not null default 0.5;

alter table public.rotation
  drop constraint if exists rotation_elo_k_check;
alter table public.rotation
  add constraint rotation_elo_k_check check (elo_k > 0 and elo_k <= 2);

-- Solo admin/superuser, por RPC: la política RLS de `rotation` también deja
-- escribir al jugador de turno, y este dato es de todo el grupo.
create or replace function public.admin_set_elo_k(p_k numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo admin/superuser'; end if;
  if p_k is null or p_k <= 0 or p_k > 2 then raise exception 'K inválida'; end if;
  update public.rotation set elo_k = p_k, updated_at = now() where id = 1;
end; $$;
