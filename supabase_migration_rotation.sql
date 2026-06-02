-- ============================================================================
--  Migración incremental — política RLS de `rotation` (Bloque 5: turnos)
--  Si YA ejecutaste supabase_schema_v2.sql antes de este cambio, corre esto.
--  (Si vuelves a ejecutar el schema_v2 completo, ya viene incluido.)
-- ============================================================================
drop policy if exists rotation_update on public.rotation;
create policy rotation_update on public.rotation for update
  using (public.is_admin() or public.my_player_id() = current_player_id)
  with check (true);

-- Lineups: además del admin, el jugador al que le toca el turno puede CONFIRMAR,
-- y el autor (data->>'madeBy') puede re-editar la suya.
drop policy if exists lineups_insert on public.lineups;
drop policy if exists lineups_update on public.lineups;
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
