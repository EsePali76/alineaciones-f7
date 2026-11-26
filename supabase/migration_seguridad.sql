-- ============================================================================
--  Migración incremental — endurecimiento de seguridad (2026-11-26)
--
--  Cierra lo que un jugador vinculado podía hacer llamando a Supabase a mano
--  (consola del navegador), aunque la app no le enseñe el botón:
--
--   1) Votos: solo números de 0 a 10 en las 7 notas (un texto rompía las medias).
--   2) Rotación: el del turno solo mueve el turno y la cola; la configuración
--      (votaciones abiertas, K, «todos parten de 5», filtro, fechas) es del admin.
--   3) Alineaciones: resultado y K solo los ponen admin/superuser; una alineación
--      con resultado ya no la toca nadie más; el autor y la fecha no se cambian.
--   4) Ficha propia: el jugador solo cambia nombre, nombre reconocible, edad,
--      posiciones (y su orden), perfil, foto (la suya, del bucket) y «excluido de
--      la rotación». El resto de campos se ignoran si no es admin/superuser.
--   5) Inscripciones: cada uno la suya. Admin/superuser, la de cualquiera. El del
--      turno además puede apuntar/quitar a reservas e invitados, y pasar a «Me
--      apunto» a quien dijo «Si falta gente voy». Nada más.
--   6) Fotos: máximo 1 MB y solo imágenes.
--   7) Higiene: las funciones de admin ya no se pueden llamar sin sesión;
--      search_path fijo en trimmed_mean.
--
--  Los cambios hechos desde el SQL Editor (rol postgres) no se ven afectados.
--  Ejecutar en Supabase → SQL Editor.
-- ============================================================================

-- ---- Utilidad: ¿la petición viene de la API (anon/authenticated) sin ser admin? ----
create or replace function public.es_peticion_no_admin()
returns boolean language sql stable set search_path = public as $$
  select current_user in ('anon', 'authenticated') and not public.is_admin();
$$;

-- ---- 1) Votos: valores válidos ----
create or replace function public.ratings_values_ok(v jsonb)
returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'object' and not exists (
    select 1 from jsonb_each(v) e
    where e.key not in ('general', 'definicion', 'criterio', 'tecnica', 'defensa', 'velocidad', 'fisico')
       or not (
         jsonb_typeof(e.value) = 'null'
         or (jsonb_typeof(e.value) = 'number' and (e.value #>> '{}')::numeric between 0 and 10)
       )
  );
$$;

alter table public.ratings add constraint ratings_values_check check (public.ratings_values_ok("values"));

-- ---- 2) Rotación: el que no es admin solo toca turno y cola ----
create or replace function public.rotation_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.es_peticion_no_admin() then return new; end if;
  new.id               := old.id;
  new.ratings_open     := old.ratings_open;
  new.match_date       := old.match_date;
  new.require_ratings  := old.require_ratings;
  new.ratings_deadline := old.ratings_deadline;
  new.match_weekday    := old.match_weekday;
  new.match_weekdays   := old.match_weekdays;
  new.elo_k            := old.elo_k;
  new.base_cinco_desde := old.base_cinco_desde;
  return new;
end; $$;

create or replace trigger rotation_guard before update on public.rotation
  for each row execute function public.rotation_guard();

-- ---- 3) Alineaciones: resultado/K solo admin; con resultado, bloqueada ----
create or replace function public.lineups_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.es_peticion_no_admin() then return new; end if;
  if tg_op = 'INSERT' then
    -- El del turno crea la alineación a su nombre y sin resultado.
    new.data := (new.data - 'resultado' - 'eloK') || jsonb_build_object('madeBy', public.my_player_id());
    return new;
  end if;
  -- UPDATE
  if jsonb_typeof(old.data -> 'resultado') = 'object' then
    raise exception 'Este partido ya tiene resultado: solo admin o superuser pueden cambiarlo';
  end if;
  new.id := old.id;
  new.data := (new.data - 'resultado' - 'eloK' - 'madeBy' - 'fecha')
              || jsonb_strip_nulls(jsonb_build_object(
                   'eloK', old.data -> 'eloK',
                   'madeBy', old.data -> 'madeBy',
                   'fecha', old.data -> 'fecha'));
  return new;
end; $$;

create or replace trigger lineups_guard before insert or update on public.lineups
  for each row execute function public.lineups_guard();

-- ---- 4) Ficha propia: solo los datos personales ----
create or replace function public.players_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['nombre', 'nombreReconocible', 'edad', 'edadTemporada',
                             'posiciones', 'pierna', 'excluidoRotacion', 'fotoUrl'];
  propias jsonb;
  foto text;
begin
  if not public.es_peticion_no_admin() then return new; end if;
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

create or replace trigger players_guard before update on public.players
  for each row execute function public.players_guard();

-- ---- 5) Inscripciones ----
create or replace function public.signups_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  me text := public.my_player_id();
  pid text := coalesce(new.player_id, old.player_id);
  especial boolean;
  previo text;
begin
  if not public.es_peticion_no_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.player_id <> old.player_id then
    raise exception 'No permitido';
  end if;
  -- La propia inscripción, siempre.
  if me is not null and pid = me then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- El del turno: reservas e invitados, y pasar de «Si falta gente voy» a «Me apunto».
  if me is not null and me = public.turno_efectivo() then
    select coalesce((data ->> 'reserva')::boolean, false) or coalesce((data ->> 'invitado')::boolean, false)
      into especial from public.players where id = pid;
    if coalesce(especial, false) then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
    if tg_op <> 'DELETE' and new.status = 'in' then
      select status into previo from public.signups where player_id = pid;
      if previo = 'maybe' then return new; end if;
    end if;
  end if;
  raise exception 'Solo puedes cambiar tu propia inscripción';
end; $$;

create or replace trigger signups_guard before insert or update or delete on public.signups
  for each row execute function public.signups_guard();

-- ---- 6) Fotos: tamaño y tipo ----
update storage.buckets
   set file_size_limit = 1048576,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'player-photos';

-- ---- 7) Higiene ----
alter function public.trimmed_mean(numeric[]) set search_path = public;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
revoke execute on function public.admin_link_player(uuid, text) from public, anon;
revoke execute on function public.admin_reset_ratings(uuid) from public, anon;
revoke execute on function public.admin_set_base_cinco_desde(bigint) from public, anon;
revoke execute on function public.admin_set_elo_k(numeric) from public, anon;
revoke execute on function public.admin_set_match_weekday(smallint) from public, anon;
revoke execute on function public.admin_set_match_weekdays(smallint[]) from public, anon;
revoke execute on function public.admin_set_ratings_deadline(date) from public, anon;
revoke execute on function public.admin_set_ratings_finalized(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_ratings_open(boolean) from public, anon;
revoke execute on function public.admin_set_require_ratings(boolean) from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
revoke execute on function public.finalize_my_ratings() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
