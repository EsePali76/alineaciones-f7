-- ---------------------------------------------------------------------------
-- MIGRACIÓN: media recortada (trimmed mean) en player_rating_averages
--
-- Sustituye la media simple por una media recortada proporcional al nº de votos,
-- para que votos extremos (0-1 maliciosos, 10 poco realistas) no descuadren el
-- reparto. Totalmente transparente para el usuario: la vista expone el mismo
-- contrato (mismas columnas), solo cambia cómo se calcula cada número.
--
-- Recorte por parámetro, según cuántos votos NO nulos tenga ese parámetro:
--   <5 votos  → sin recorte (poca muestra, se usa todo)
--   5-9 votos → se quita 1 por cada extremo
--   ≥10 votos → se quita el 15% (floor) por cada extremo
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

-- Helper: media recortada de un array de numerics (ignora nulos).
create or replace function public.trimmed_mean(vals numeric[])
returns numeric language plpgsql immutable as $$
declare
  arr numeric[];
  n   int;
  k   int;
begin
  -- Ordena de menor a mayor y descarta nulos.
  select array_agg(v order by v) into arr
  from unnest(vals) as v
  where v is not null;

  n := coalesce(array_length(arr, 1), 0);
  if n = 0 then
    return null;
  end if;

  -- Cuántos elementos recortar por CADA extremo.
  if n < 5 then
    k := 0;
  elsif n < 10 then
    k := 1;
  else
    k := floor(n * 0.15);
  end if;

  -- Seguridad: nunca recortar hasta dejar el array vacío.
  if 2 * k >= n then
    k := 0;
  end if;

  -- Promedia los del centro: posiciones (k+1) .. (n-k), 1-based.
  return (
    select avg(arr[i])
    from generate_series(k + 1, n - k) as i
  );
end;
$$;

grant execute on function public.trimmed_mean(numeric[]) to anon, authenticated;

-- Vista de medias: misma forma, ahora con media recortada por parámetro.
create or replace view public.player_rating_averages as
select
  ratee_player_id                                                    as player_id,
  count(*)                                                           as num_votos,
  public.trimmed_mean(array_agg((values->>'general')::numeric))      as general,
  public.trimmed_mean(array_agg((values->>'definicion')::numeric))   as definicion,
  public.trimmed_mean(array_agg((values->>'criterio')::numeric))     as criterio,
  public.trimmed_mean(array_agg((values->>'tecnica')::numeric))      as tecnica,
  public.trimmed_mean(array_agg((values->>'defensa')::numeric))      as defensa,
  public.trimmed_mean(array_agg((values->>'velocidad')::numeric))    as velocidad,
  public.trimmed_mean(array_agg((values->>'fisico')::numeric))       as fisico
from public.ratings
group by ratee_player_id;

grant select on public.player_rating_averages to anon, authenticated;
