-- ---------------------------------------------------------------------------
-- MIGRACIÓN: el permiso de "el del turno" usa el turno EFECTIVO, no el guardado
--
-- Problema: la app calcula a quién le toca saltándose a los no elegibles y, con el
-- filtro "solo alinea quien ha valorado a todos" activo, a quien no ha valorado
-- (`useTurno` → `effectiveCurrent` + `filtrarPorValoraciones`). Pero las políticas
-- RLS miraban `rotation.current_player_id` a pelo. Si el guardado no cumple el
-- filtro, la app le da el turno a otro y la base le rechaza al confirmar
-- ("No se pudo guardar en la nube").
--
-- Solución: `turno_efectivo()` replica en SQL el cálculo de la app, y las
-- políticas de lineups / players (invitados puntuales) / rotation lo usan.
-- No cambia la congelación (autor de la alineación ya hecha): eso ya lo cubre
-- `lineups_update` con `madeBy`.
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

-- Turno efectivo. Debe coincidir con `useTurno` (sin la congelación):
--   - elegibles = esElegibleRotacion: activo, no excluido, no reserva, no invitado.
--   - filtro de valoraciones si require_ratings, salvo que no lo cumpla nadie
--     (entonces se ignora, igual que filtrarPorValoraciones).
--   - effectiveCurrent: el guardado si es elegible; si no, el primero de la cola
--     que no haya pasado; si todos pasaron, el primero de la cola.
create or replace function public.turno_efectivo()
returns text language sql security definer stable set search_path = public as $$
  with rot as (
    select current_player_id, order_ids, skipped_ids, require_ratings
    from public.rotation where id = 1
  ),
  base as (
    select p.id from public.players p
    where coalesce((p.data->>'activo')::boolean, true)
      and not coalesce((p.data->>'excluidoRotacion')::boolean, false)
      and not coalesce((p.data->>'reserva')::boolean, false)
      and not coalesce((p.data->>'invitado')::boolean, false)
  ),
  completos as (
    select b.id from base b
    join public.rating_progress rp on rp.player_id = b.id
    where rp.total > 0 and rp.valorados >= rp.total
  ),
  filtro as (
    select coalesce((select require_ratings from rot), false)
           and exists (select 1 from completos) as aplicado
  ),
  elegibles as (
    select id from completos where (select aplicado from filtro)
    union
    select id from base where not (select aplicado from filtro)
  ),
  cola as (
    select o.id, o.ord, (rot.skipped_ids ? o.id) as paso
    from rot, jsonb_array_elements_text(rot.order_ids) with ordinality as o(id, ord)
    where o.id in (select id from elegibles)
  )
  select coalesce(
    (select current_player_id from rot where current_player_id in (select id from elegibles)),
    (select id from cola where not paso order by ord limit 1),
    (select id from cola order by ord limit 1)
  );
$$;

-- Lineups: confirma el admin o el del turno efectivo; el autor puede re-editar la suya.
drop policy if exists lineups_insert on public.lineups;
drop policy if exists lineups_update on public.lineups;
create policy lineups_insert on public.lineups for insert with check (
  public.is_admin()
  or public.my_player_id() = public.turno_efectivo()
);
create policy lineups_update on public.lineups for update
  using (
    public.is_admin()
    or (data->>'madeBy') = public.my_player_id()
    or public.my_player_id() = public.turno_efectivo()
  )
  with check (true);

-- Players: el del turno efectivo puede dar de alta invitados puntuales.
drop policy if exists players_insert on public.players;
create policy players_insert on public.players
  for insert
  with check (
    public.is_admin()
    or (
      public.my_player_id() = public.turno_efectivo()
      and coalesce((data->>'invitado')::boolean, false) = true
      and coalesce((data->>'habitual')::boolean, false) = false
    )
  );

-- Rotation: pasa turno el del turno efectivo. Se mantiene también el guardado
-- (current_player_id) para que quien se autoexcluye estando de turno pueda
-- pasarlo después de haberse excluido.
drop policy if exists rotation_update on public.rotation;
create policy rotation_update on public.rotation for update
  using (
    public.is_admin()
    or public.my_player_id() = current_player_id
    or public.my_player_id() = public.turno_efectivo()
  )
  with check (true);
