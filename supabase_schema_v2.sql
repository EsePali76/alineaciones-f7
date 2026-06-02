-- ============================================================================
--  alineaciones_F7 — Esquema v2 (app colaborativa multiusuario)
--  Ejecutar en Supabase → SQL Editor (una sola vez).
--
--  Resumen del modelo:
--   - profiles: cada usuario (auth) vinculado a un jugador + rol (admin/player).
--   - ratings : votos colaborativos ANÓNIMOS (cada uno vota a los demás).
--   - players : identidad + flags (las valoraciones mostradas = medias de ratings).
--   - rotation: estado del turno rotativo (a quién le toca hacer la alineación).
--
--  Seguridad (RLS):
--   - Lectura de players/lineups/rotation: pública.
--   - ratings: cada uno SOLO ve/edita sus propios votos; el admin todos.
--   - Las MEDIAS se exponen por la vista player_rating_averages (sin identidad).
--   - Mutaciones sensibles (vincular jugador, rol, reset, finalizar) vía RPC.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) PROFILES  (1 fila por usuario de Supabase Auth)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  display_name      text,
  role              text not null default 'player' check (role in ('admin','player')),
  -- jugador del plantel al que está vinculado (lo asigna el Admin). null = sin vincular.
  player_id         text references public.players(id) on delete set null,
  -- true cuando el usuario pulsa "Finalizar mis valoraciones" (se bloquean).
  ratings_finalized boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Crea automáticamente el profile al registrarse un usuario nuevo.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', new.email), 'player')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2) HELPERS (security definer → no recursión con las RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.my_player_id()
returns text language sql security definer stable set search_path = public as $$
  select player_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 3) RATINGS  (votos colaborativos anónimos)
--    1 fila por (valorador, valorado). values = jsonb con los 7 parámetros.
-- ---------------------------------------------------------------------------
create table if not exists public.ratings (
  rater_id        uuid not null references public.profiles(id) on delete cascade,
  ratee_player_id text not null references public.players(id)  on delete cascade,
  values          jsonb not null default '{}'::jsonb,  -- {general, definicion, criterio, tecnica, defensa, velocidad, fisico}
  updated_at      timestamptz not null default now(),
  primary key (rater_id, ratee_player_id)
);

-- ---------------------------------------------------------------------------
-- 4) ROTATION  (estado del turno rotativo — singleton)
--    NOTA: se afinará en el bloque de turnos; estructura base.
-- ---------------------------------------------------------------------------
create table if not exists public.rotation (
  id                int primary key default 1 check (id = 1),
  current_player_id text references public.players(id) on delete set null,
  order_ids         jsonb not null default '[]'::jsonb,  -- orden de la cola (ids)
  skipped_ids       jsonb not null default '[]'::jsonb,  -- pasaron turno (conservan sitio)
  updated_at        timestamptz not null default now()
);
insert into public.rotation (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5) VISTA DE MEDIAS  (expone solo agregados → preserva el anonimato)
--    Se ejecuta con privilegios del propietario (definer) → ve todos los votos.
-- ---------------------------------------------------------------------------
create or replace view public.player_rating_averages as
select
  ratee_player_id                              as player_id,
  count(*)                                     as num_votos,
  avg((values->>'general')::numeric)           as general,
  avg((values->>'definicion')::numeric)        as definicion,
  avg((values->>'criterio')::numeric)          as criterio,
  avg((values->>'tecnica')::numeric)           as tecnica,
  avg((values->>'defensa')::numeric)           as defensa,
  avg((values->>'velocidad')::numeric)         as velocidad,
  avg((values->>'fisico')::numeric)            as fisico
from public.ratings
group by ratee_player_id;

grant select on public.player_rating_averages to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) RPCs para mutaciones sensibles
-- ---------------------------------------------------------------------------
-- El propio usuario finaliza sus valoraciones (se bloquean).
create or replace function public.finalize_my_ratings()
returns void language sql security definer set search_path = public as $$
  update public.profiles set ratings_finalized = true where id = auth.uid();
$$;

-- Admin vincula un usuario a un jugador del plantel.
create or replace function public.admin_link_player(target uuid, p_player_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo admin'; end if;
  update public.profiles set player_id = p_player_id where id = target;
end; $$;

-- Admin cambia el rol de un usuario.
create or replace function public.admin_set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo admin'; end if;
  if new_role not in ('admin','player') then raise exception 'Rol inválido'; end if;
  update public.profiles set role = new_role where id = target;
end; $$;

-- Admin resetea el proceso de valoración de un usuario (desbloquea para rehacerlo).
create or replace function public.admin_reset_ratings(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo admin'; end if;
  update public.profiles set ratings_finalized = false where id = target;
end; $$;

grant execute on function
  public.finalize_my_ratings(),
  public.admin_link_player(uuid, text),
  public.admin_set_role(uuid, text),
  public.admin_reset_ratings(uuid)
to authenticated;

-- ============================================================================
--  RLS — POLÍTICAS
-- ============================================================================

-- ---- profiles: cada uno ve el suyo; el admin todos. Sin DML directo (vía RPC/trigger).
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- ---- players: lectura pública; escribe el admin; el dueño edita SU jugador (identidad).
alter table public.players enable row level security;
drop policy if exists players_read     on public.players;
drop policy if exists players_write    on public.players;  -- (limpia política v1 si existía)
drop policy if exists "players read"   on public.players;
drop policy if exists "players write"  on public.players;
drop policy if exists players_select   on public.players;
drop policy if exists players_insert   on public.players;
drop policy if exists players_update   on public.players;
drop policy if exists players_delete   on public.players;
create policy players_select on public.players for select using (true);
create policy players_insert on public.players for insert with check (public.is_admin());
create policy players_update on public.players for update
  using (public.is_admin() or id = public.my_player_id())
  with check (public.is_admin() or id = public.my_player_id());
create policy players_delete on public.players for delete using (public.is_admin());

-- ---- lineups: lectura pública; escribe el admin (el turno-holder se habilitará en bloque de turnos).
alter table public.lineups enable row level security;
drop policy if exists lineups_read    on public.lineups;
drop policy if exists lineups_write   on public.lineups;
drop policy if exists "lineups read"  on public.lineups;
drop policy if exists "lineups write" on public.lineups;
drop policy if exists lineups_select  on public.lineups;
drop policy if exists lineups_insert  on public.lineups;
drop policy if exists lineups_update  on public.lineups;
drop policy if exists lineups_delete  on public.lineups;
create policy lineups_select on public.lineups for select using (true);
-- Confirma el admin o el jugador al que le toca el turno; el autor puede re-editar la suya.
create policy lineups_insert on public.lineups for insert with check (
  public.is_admin()
  or public.my_player_id() = (select current_player_id from public.rotation where id = 1)
);
create policy lineups_update on public.lineups for update
  using (
    public.is_admin()
    or (data->>'madeBy') = public.my_player_id()
    or public.my_player_id() = (select current_player_id from public.rotation where id = 1)
  )
  with check (true);
create policy lineups_delete on public.lineups for delete using (public.is_admin());

-- ---- ratings: cada uno solo ve/edita sus votos; no se vota a sí mismo; bloqueo al finalizar.
alter table public.ratings enable row level security;
drop policy if exists ratings_select on public.ratings;
drop policy if exists ratings_insert on public.ratings;
drop policy if exists ratings_update on public.ratings;
drop policy if exists ratings_delete on public.ratings;
create policy ratings_select on public.ratings
  for select using (rater_id = auth.uid() or public.is_admin());
create policy ratings_insert on public.ratings
  for insert with check (
    public.is_admin()
    or (
      rater_id = auth.uid()
      and ratee_player_id <> public.my_player_id()
      and not coalesce((select ratings_finalized from public.profiles where id = auth.uid()), false)
    )
  );
create policy ratings_update on public.ratings
  for update using (rater_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      rater_id = auth.uid()
      and ratee_player_id <> public.my_player_id()
      and not coalesce((select ratings_finalized from public.profiles where id = auth.uid()), false)
    )
  );
create policy ratings_delete on public.ratings for delete using (public.is_admin());

-- ---- rotation: lectura pública; actualiza el admin o el del turno actual.
alter table public.rotation enable row level security;
drop policy if exists rotation_select on public.rotation;
drop policy if exists rotation_update on public.rotation;
create policy rotation_select on public.rotation for select using (true);
-- USING limita QUIÉN puede tocar la rotación (admin o el del turno actual);
-- WITH CHECK abierto para que al pasar turno pueda fijar al SIGUIENTE como current.
create policy rotation_update on public.rotation for update
  using (public.is_admin() or public.my_player_id() = current_player_id)
  with check (true);

-- ============================================================================
--  BOOTSTRAP DEL ADMIN  (ejecutar UNA vez; ajusta el email si hace falta)
--  Tu cuenta ya existe en Auth, así que el trigger no la creó: la insertamos
--  y la marcamos como admin a mano.
-- ============================================================================
insert into public.profiles (id, email, display_name, role)
select id, email, coalesce(raw_user_meta_data->>'display_name', email), 'admin'
from auth.users
where email = 'spalencia76@gmail.com'
on conflict (id) do update set role = 'admin';
