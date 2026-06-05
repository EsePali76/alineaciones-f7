-- Fotos de jugadores (avatares). Bucket público de Storage + políticas RLS.
-- Ejecutar UNA vez en Supabase (SQL Editor). Reutiliza los helpers is_admin() y
-- my_player_id() del schema v2.
--
-- Las fotos se guardan en   player-photos/<playerId>/avatar.jpg
-- → la primera carpeta del nombre es el id del jugador, lo que permite que cada
--   usuario solo pueda escribir la suya (o el admin cualquiera).

-- Bucket público (lectura abierta por URL).
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- Lectura pública de las fotos.
drop policy if exists player_photos_read on storage.objects;
create policy player_photos_read on storage.objects
  for select
  using (bucket_id = 'player-photos');

-- Escritura (subir): admin, o el dueño del jugador (carpeta = su player_id).
drop policy if exists player_photos_insert on storage.objects;
create policy player_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'player-photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_player_id())
  );

-- Actualizar (upsert sobre la misma ruta): mismas condiciones.
drop policy if exists player_photos_update on storage.objects;
create policy player_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'player-photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_player_id())
  );

-- Borrar: mismas condiciones.
drop policy if exists player_photos_delete on storage.objects;
create policy player_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'player-photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_player_id())
  );
