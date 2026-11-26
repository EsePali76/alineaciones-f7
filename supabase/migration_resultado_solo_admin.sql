-- ============================================================================
--  Migración incremental — resultados solo admin (2026-11-26)
--
--  Sustituye la regla 3 de migration_seguridad.sql. Antes la tenían admin Y
--  superuser; ahora solo el admin real (is_full_admin):
--   - Resultado y K del partido: solo admin.
--   - Partido con resultado: solo el admin lo edita o lo borra.
--   - Autor y fecha del partido: solo los cambia el admin.
--  El superuser y el del turno siguen creando/editando/borrando alineaciones
--  SIN resultado como hasta ahora.
--
--  Ejecutar en Supabase → SQL Editor (después de migration_seguridad.sql).
-- ============================================================================

create or replace function public.lineups_guard()
returns trigger language plpgsql set search_path = public as $$
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

  -- UPDATE de una alineación sin resultado.
  new.id := old.id;
  new.data := (new.data - 'resultado' - 'eloK' - 'madeBy' - 'fecha')
              || jsonb_strip_nulls(jsonb_build_object(
                   'eloK', old.data -> 'eloK',
                   'madeBy', old.data -> 'madeBy',
                   'fecha', old.data -> 'fecha'));
  return new;
end; $$;

drop trigger if exists lineups_guard on public.lineups;
create trigger lineups_guard before insert or update or delete on public.lineups
  for each row execute function public.lineups_guard();
