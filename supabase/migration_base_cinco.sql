-- ---------------------------------------------------------------------------
-- MIGRACIÓN: opción "todos parten de 5"
--
-- Con la opción activa, la nota con la que se reparten los equipos es 5 + ajuste
-- para todo el mundo, en vez de valoración del grupo + ajuste. Las valoraciones de
-- los usuarios se siguen guardando y viendo (Plantel, Estadísticas), pero no
-- cuentan para el reparto. Ver `src/domain/ajuste.ts`.
--
-- Se guarda el INSTANTE en que se activa (ms, null = desactivada): los partidos
-- anteriores siguen calculando el ajuste con las valoraciones de los usuarios, así
-- que el histórico no cambia. Pensado para activarla al poner a cero el ajuste al
-- empezar temporada.
--
-- La app tolera que la columna no exista (opción desactivada), pero hasta ejecutar
-- esto el admin no puede activarla.
--
-- Pegar tal cual en el SQL Editor de Supabase y ejecutar.
-- ---------------------------------------------------------------------------

alter table public.rotation
  add column if not exists base_cinco_desde bigint;

-- Solo el admin real, por RPC (la política RLS de `rotation` también deja escribir
-- al jugador de turno, y este dato es de todo el grupo).
create or replace function public.admin_set_base_cinco_desde(p_desde bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.rotation set base_cinco_desde = p_desde, updated_at = now() where id = 1;
end; $$;
