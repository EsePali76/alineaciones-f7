-- ---------------------------------------------------------------------------
-- MIGRACIÓN: ajuste por tramos de goles, K 0,70 en toda la temporada 26/27
--
-- La fórmula del ajuste cambia (ver `src/domain/ajuste.ts`): el resultado vale por
-- tramos de diferencia de goles en vez de 1/0,5/0 multiplicado por un factor de
-- goles. Con la fórmula nueva, la K equivalente a la 0,35 de antes es 0,70. Esto
-- deja K 0,70 guardada en todos los partidos de la temporada con resultado (para
-- que se recalculen con la fórmula nueva en su escala) y como K vigente.
--
-- 1788213600000 = 2026-09-01 00:00 hora de Madrid, en ms (`fecha` del partido).
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

update public.lineups
set data = jsonb_set(data, '{eloK}', '0.7'::jsonb),
    updated_at = now()
where (data->>'fecha')::bigint >= 1788213600000
  and data ? 'resultado'
  and data->'resultado' <> 'null'::jsonb;

update public.rotation set elo_k = 0.7, updated_at = now() where id = 1;
