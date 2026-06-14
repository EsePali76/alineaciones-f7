-- ============================================================================
--  Migración — Convocatoria desde la app (apuntarse al partido)
--  Ejecutar en el SQL Editor de Supabase. Idempotente.
--
--  Añade:
--    - rotation.match_date  → override de fecha del próximo partido (admin
--      "este lunes no hay partido"). NULL = se calcula automáticamente en el front.
--    - tabla signups        → cada usuario se apunta a la convocatoria de una
--      jornada. status 'in' = "Me apunto" (titular); 'maybe' = "Si falta gente voy".
--      created_at da el ORDEN DE LLEGADA. RLS: cada uno gestiona su fila; admin todo;
--      lectura pública.
-- ============================================================================

-- 1) Override de fecha del próximo partido en el singleton de rotación.
alter table public.rotation add column if not exists match_date date;

-- 2) Apuntes a la convocatoria.
create table if not exists public.signups (
  player_id  text primary key references public.players(id) on delete cascade,
  status     text not null check (status in ('in', 'maybe')),
  match_date date not null,
  created_at timestamptz not null default now()
);

alter table public.signups enable row level security;

-- Lectura pública (la lista la ve el del turno/admin en la app; el resto, su propio estado).
drop policy if exists signups_select on public.signups;
create policy signups_select on public.signups for select using (true);

-- Cada usuario gestiona SU propio apunte (insert/update/delete); el admin, cualquiera.
drop policy if exists signups_insert on public.signups;
create policy signups_insert on public.signups for insert with check (
  public.is_admin() or player_id = public.my_player_id()
);

drop policy if exists signups_update on public.signups;
create policy signups_update on public.signups for update
  using (public.is_admin() or player_id = public.my_player_id())
  with check (public.is_admin() or player_id = public.my_player_id());

drop policy if exists signups_delete on public.signups;
create policy signups_delete on public.signups for delete
  using (public.is_admin() or player_id = public.my_player_id());
