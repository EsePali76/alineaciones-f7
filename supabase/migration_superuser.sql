-- ============================================================================
--  Migración — Rol "Superuser"
--  Ejecutar en el SQL Editor de Supabase. Idempotente.
--
--  Un superuser tiene TODOS los privilegios operativos del admin (editar plantel,
--  alineaciones, convocatoria, resultados, turnos…) MENOS el menú "Usuarios":
--  gestión de cuentas (vincular/rol/borrar/reabrir valoraciones), edición-proxy de
--  votos y apertura del plazo de reevaluación. Eso queda solo para el admin real.
--
--  Estrategia:
--   - is_admin()      → ahora true para 'admin' y 'superuser' (privilegios operativos
--     vía RLS de players/lineups/rotation/signups).
--   - is_full_admin() → solo 'admin' real. Lo usan las RPC y RLS sensibles (usuarios,
--     proxy de votos, ventana de reevaluación, lectura de todos los perfiles).
-- ============================================================================

-- 1) Permitir el rol 'superuser'.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'player', 'superuser'));

-- 2) Helpers de rol.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role in ('admin', 'superuser'));
$$;

create or replace function public.is_full_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin');
$$;

-- 3) RPCs sensibles (gestión de usuarios + ventana de reevaluación) → solo admin real.
create or replace function public.admin_link_player(target uuid, p_player_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.profiles set player_id = p_player_id where id = target;
end; $$;

create or replace function public.admin_set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  if new_role not in ('admin', 'player', 'superuser') then raise exception 'Rol inválido'; end if;
  update public.profiles set role = new_role where id = target;
end; $$;

create or replace function public.admin_reset_ratings(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.profiles set ratings_finalized = false where id = target;
end; $$;

create or replace function public.admin_set_ratings_open(p_open boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.rotation set ratings_open = p_open, updated_at = now() where id = 1;
end; $$;

create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  if target = auth.uid() then raise exception 'No puedes borrarte a ti mismo'; end if;
  delete from auth.users where id = target;
end; $$;

-- 4) RLS sensibles → solo admin real (el superuser NO ve todos los perfiles ni edita
--    votos de otros vía proxy).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_full_admin());

-- ratings: el admin real puede ver/editar cualquier voto (proxy); el resto, solo el suyo.
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings
  for select using (rater_id = auth.uid() or public.is_full_admin());

drop policy if exists ratings_insert on public.ratings;
create policy ratings_insert on public.ratings
  for insert with check (
    public.is_full_admin()
    or (
      rater_id = auth.uid()
      and ratee_player_id <> public.my_player_id()
      and (
        public.ratings_open()
        or not coalesce((select ratings_finalized from public.profiles where id = auth.uid()), false)
      )
    )
  );

drop policy if exists ratings_update on public.ratings;
create policy ratings_update on public.ratings
  for update using (rater_id = auth.uid() or public.is_full_admin())
  with check (
    public.is_full_admin()
    or (
      rater_id = auth.uid()
      and ratee_player_id <> public.my_player_id()
      and (
        public.ratings_open()
        or not coalesce((select ratings_finalized from public.profiles where id = auth.uid()), false)
      )
    )
  );

drop policy if exists ratings_delete on public.ratings;
create policy ratings_delete on public.ratings
  for delete using (rater_id = auth.uid() or public.is_full_admin());
