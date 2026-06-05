-- Permite que el del turno (no admin) dé de alta INVITADOS PUNTUALES desde Equipos.
-- Ejecutar UNA vez en Supabase (SQL Editor).
--
-- Hasta ahora insertar en players era solo-admin. Esto lo amplía: el jugador al que
-- le toca hacer la alineación puede insertar jugadores, pero SOLO si son invitados
-- no habituales (invitado=true, habitual=false) — es decir, colados de un día. No
-- puede crear fijos ni habituales, ni tocar a nadie del plantel. El admin mantiene
-- alta libre. Editar/borrar siguen como estaban (admin o dueño).

drop policy if exists players_insert on public.players;
create policy players_insert on public.players
  for insert
  with check (
    public.is_admin()
    or (
      public.my_player_id() = (select current_player_id from public.rotation where id = 1)
      and coalesce((data->>'invitado')::boolean, false) = true
      and coalesce((data->>'habitual')::boolean, false) = false
    )
  );
