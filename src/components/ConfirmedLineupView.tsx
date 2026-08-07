import { useMemo } from 'react'
import { useEffectivePlayers } from '../hooks/useEffectivePlayers'
import { useLineupsStore } from '../store/lineupsStore'
import { useAuthStore } from '../store/authStore'
import { evaluatePartition } from '../domain/balancer'
import { formacionPorNombre } from '../domain/formation'
import { FieldView } from './FieldView'
import type { ConfirmedLineup, Player } from '../domain/types'
import { nombreVisible } from '../domain/types'

/**
 * Vista de solo lectura de la alineación confirmada de la semana (sin resultado aún),
 * visible para TODOS. Cabecera personalizada: blanco / rojo / no convocado.
 */
export function ConfirmedLineupView({ lineup }: { lineup: ConfirmedLineup }) {
  const players = useEffectivePlayers()
  const lineups = useLineupsStore((s) => s.lineups)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const teamA = lineup.teamA.map((id) => byId.get(id)).filter((p): p is Player => !!p)
  const teamB = lineup.teamB.map((id) => byId.get(id)).filter((p): p is Player => !!p)

  const balance = useMemo(
    () => evaluatePartition(teamA, teamB, { history: lineups }),
    [teamA, teamB, lineups],
  )

  const porEquipo = teamA.length
  const formacionA = formacionPorNombre(porEquipo, lineup.formacionA ?? '')
  const formacionB = formacionPorNombre(porEquipo, lineup.formacionB ?? '')

  const enA = !!myPlayerId && lineup.teamA.includes(myPlayerId)
  const enB = !!myPlayerId && lineup.teamB.includes(myPlayerId)

  if (!formacionA || !formacionB) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
        Hay una alineación confirmada, pero no se puede dibujar el campo.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      {/* Cabecera */}
      <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-center">
        <p className="text-lg font-semibold text-emerald-300">¡Alineación confirmada!</p>
        <p className="text-sm text-slate-200">
          {enA ? (
            <>
              Juegas de <b className="text-white">⚪ BLANCO</b>
            </>
          ) : enB ? (
            <>
              Juegas de <b className="text-red-400">🔴 ROJO</b>
            </>
          ) : (
            'Esta semana no estás convocado.'
          )}
        </p>
      </div>

      {/* Campo (solo lectura) */}
      <FieldView
        balance={balance}
        formacionA={formacionA}
        formacionB={formacionB}
        onCrossSwap={() => {}}
        readOnly
        placementA={lineup.placementA ?? null}
        placementB={lineup.placementB ?? null}
      />

      {/* Listado por equipos */}
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <TeamCol titulo="⚪ Blanco" tituloClass="text-slate-200" borde="border-slate-400" team={teamA} />
        <TeamCol titulo="🔴 Rojo" tituloClass="text-red-400" borde="border-red-900" team={teamB} />
      </div>
    </section>
  )
}

function TeamCol({
  titulo,
  tituloClass,
  borde,
  team,
}: {
  titulo: string
  tituloClass: string
  borde: string
  team: Player[]
}) {
  return (
    <div className={`rounded-lg border ${borde} bg-slate-900/60 p-3`}>
      <span className={`text-xs font-semibold ${tituloClass}`}>{titulo}</span>
      <ul className="mt-1 flex flex-col gap-0.5">
        {team.map((p) => (
          <li key={p.id} className="text-slate-200">
            {nombreVisible(p)}
            {p.invitado && <span className="text-amber-300"> *</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
