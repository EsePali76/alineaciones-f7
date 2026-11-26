-- ============================================================================
--  Migración incremental — resultados, K, fecha y nombre reconocible (2026-11-26)
--
--  Ajusta las reglas 3 y 4 de migration_seguridad.sql:
--   - Resultado: lo meten la primera vez admin y superuser. Una vez metido, solo
--     el admin lo corrige, lo resetea o borra el partido.
--   - K: solo el admin. Si el superuser mete el resultado, la K del partido es
--     la que tenga configurada la rotación (no la que mande el navegador).
--   - Fecha y autor del partido: solo el admin.
--   - Nombre reconocible: solo el admin (ni el jugador en su ficha ni el superuser).
--  El del turno sigue creando/editando/borrando alineaciones sin resultado.
--
--  Ejecutar en Supabase → SQL Editor (después de migration_seguridad.sql).
-- ============================================================================

-- ---- Alineaciones ----
create or replace function public.lineups_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  k_actual numeric;
begin
  -- SQL Editor (postgres) y admin real: sin restricciones.
  if current_user not in ('anon', 'authenticated') or public.is_full_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    new.data := new.data - 'resultado' - 'eloK';
    -- El del turno la crea a su nombre; el superuser puede crearla a nombre de otro.
    if not public.is_admin() then
      new.data := new.data || jsonb_build_object('madeBy', public.my_player_id());
    end if;
    return new;
  end if;

  if jsonb_typeof(old.data -> 'resultado') = 'object' then
    raise exception 'Este partido ya tiene resultado: solo el admin puede cambiarlo';
  end if;

  if tg_op = 'DELETE' then return old; end if;

  -- UPDATE de una alineación sin resultado: autor y fecha no se tocan.
  new.id := old.id;
  if public.is_admin() and jsonb_typeof(new.data -> 'resultado') = 'object' then
    -- Superuser metiendo el resultado: se queda, con la K oficial (si el partido
    -- cuenta para el ajuste, que es cuando la app manda K).
    select elo_k into k_actual from public.rotation where id = 1;
    new.data := (new.data - 'eloK' - 'madeBy' - 'fecha')
                || jsonb_strip_nulls(jsonb_build_object(
                     'eloK', coalesce(old.data -> 'eloK',
                                      case when new.data ? 'eloK' then to_jsonb(k_actual) end),
                     'madeBy', old.data -> 'madeBy',
                     'fecha', old.data -> 'fecha'));
  else
    new.data := (new.data - 'resultado' - 'eloK' - 'madeBy' - 'fecha')
                || jsonb_strip_nulls(jsonb_build_object(
                     'eloK', old.data -> 'eloK',
                     'madeBy', old.data -> 'madeBy',
                     'fecha', old.data -> 'fecha'));
  end if;
  return new;
end; $$;

drop trigger if exists lineups_guard on public.lineups;
create trigger lineups_guard before insert or update or delete on public.lineups
  for each row execute function public.lineups_guard();

-- ---- K global: solo admin real ----
create or replace function public.admin_set_elo_k(p_k numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.rotation set elo_k = p_k, updated_at = now() where id = 1;
end; $$;

revoke execute on function public.admin_set_elo_k(numeric) from public, anon;

-- ---- Jugadores: nombre reconocible solo admin ----
create or replace function public.players_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['nombre', 'edad', 'edadTemporada',
                             'posiciones', 'pierna', 'excluidoRotacion', 'fotoUrl'];
  propias jsonb;
  foto text;
begin
  if current_user not in ('anon', 'authenticated') or public.is_full_admin() then
    return new;
  end if;

  -- Superuser: todo menos el nombre reconocible.
  if public.is_admin() then
    if tg_op = 'INSERT' then
      new.data := new.data - 'nombreReconocible';
    else
      new.data := (new.data - 'nombreReconocible')
                  || jsonb_strip_nulls(jsonb_build_object('nombreReconocible', old.data -> 'nombreReconocible'));
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then return new; end if;  -- la RLS ya decide quién da altas

  -- Jugador en su ficha: solo sus datos personales.
  new.id := old.id;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into propias
    from jsonb_each(new.data) where key = any(permitidas);
  -- La foto solo puede ser la suya, subida al bucket de la app.
  foto := propias ->> 'fotoUrl';
  if foto is not null and foto not like
     'https://jxwxnibctfhiibrpfbvh.supabase.co/storage/v1/object/public/player-photos/' || old.id || '/%' then
    propias := propias - 'fotoUrl';
    if old.data ? 'fotoUrl' then propias := propias || jsonb_build_object('fotoUrl', old.data -> 'fotoUrl'); end if;
  end if;
  new.data := (old.data - permitidas) || propias;
  return new;
end; $$;

drop trigger if exists players_guard on public.players;
create trigger players_guard before insert or update on public.players
  for each row execute function public.players_guard();
