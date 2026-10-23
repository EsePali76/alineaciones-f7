-- ---------------------------------------------------------------------------
-- MIGRACIÓN: ajuste por resultados retroactivo a toda la temporada 26/27, K 0,3
--
-- El ajuste empezó a contar el 2026-10-22 con K 0,5. El 2026-10-23 el grupo
-- decidió aplicarlo desde el inicio de la temporada (2026-09-01) con K 0,3. La
-- app ya cuenta desde esa fecha (`AJUSTE_DESDE` en `src/domain/ajuste.ts`); esto
-- deja guardada K 0,3 en todos los partidos de la temporada con resultado, para
-- que no dependan de la K vigente (y corrige el del 22/10, que tenía 0,5).
--
-- 1788213600000 = 2026-09-01 00:00 hora de Madrid, en ms (`fecha` del partido).
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

update public.lineups
set data = jsonb_set(data, '{eloK}', '0.3'::jsonb),
    updated_at = now()
where (data->>'fecha')::bigint >= 1788213600000
  and data ? 'resultado'
  and data->'resultado' <> 'null'::jsonb;

update public.rotation set elo_k = 0.3, updated_at = now() where id = 1;
