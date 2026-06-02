import { useMemo, useState } from 'react'
import { useLineupsStore } from '../store/lineupsStore'
import { useEffectivePlayers } from '../hooks/useEffectivePlayers'
import { statsPorEquipo, statsPorJugador, type TeamStats } from '../domain/stats'
import { animoLabel } from '../domain/animo'

type Sub = 'equipo' | 'jugador'

export function StatsPanel() {
  const lineups = useLineupsStore((s) => s.lineups)
  const players = useEffectivePlayers()
  const [sub, setSub] = useState<Sub>('jugador')

  const conResultado = useMemo(() => lineups.filter((l) => l.resultado), [lineups])
  const equipos = useMemo(() => statsPorEquipo(lineups), [lineups])
  const porJugador = useMemo(() => statsPorJugador(lineups), [lineups])

  const nombre = (id: string) => players.find((p) => p.id === id)?.nombre ?? '(?)'

  const filas = useMemo(() => {
    return [...porJugador.values()].sort(
      (a, b) => b.pctVictorias - a.pctVictorias || b.partidos - a.partidos,
    )
  }, [porJugador])

  if (conResultado.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
        Aún no hay partidos con resultado. Cuando el admin registre marcadores, aquí saldrán las
        estadísticas.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        <SubTab active={sub === 'jugador'} onClick={() => setSub('jugador')}>
          Por jugador
        </SubTab>
        <SubTab active={sub === 'equipo'} onClick={() => setSub('equipo')}>
          Por equipo
        </SubTab>
      </div>

      {sub === 'equipo' && (
        <div className="grid gap-3 md:grid-cols-2">
          <TeamCard titulo="⚪ Blanco" stats={equipos.blanco} acento="text-slate-100" />
          <TeamCard titulo="🔴 Rojo" stats={equipos.rojo} acento="text-red-400" />
        </div>
      )}

      {sub === 'jugador' && (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-left text-slate-400">
                <th className="px-3 py-2 font-medium">Jugador</th>
                <th className="px-2 py-2 text-center font-medium" title="Partidos jugados">PJ</th>
                <th className="px-2 py-2 text-center font-medium" title="Victorias-Empates-Derrotas">V-E-D</th>
                <th className="px-2 py-2 text-center font-medium" title="% de victorias">%V</th>
                <th className="px-2 py-2 text-center font-medium" title="Racha actual">Racha</th>
                <th className="px-2 py-2 text-center font-medium" title="Goles">⚽</th>
                <th className="px-2 py-2 text-center font-medium" title="Asistencias">🅰️</th>
                <th className="px-2 py-2 text-center font-medium" title="Veces de blanco / de rojo">⚪/🔴</th>
                <th className="px-2 py-2 text-center font-medium" title="Ánimo">Ánimo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((s) => {
                const animo = players.find((p) => p.id === s.playerId)?.animoCalculado
                return (
                  <tr key={s.playerId} className="border-t border-slate-700/60">
                    <td className="px-3 py-2 font-medium">{nombre(s.playerId)}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.partidos}</td>
                    <td className="px-2 py-2 text-center text-slate-300">
                      {s.victorias}-{s.empates}-{s.derrotas}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.pctVictorias}%</td>
                    <td className="px-2 py-2 text-center">{rachaTexto(s.racha)}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.goles || '—'}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.asistencias || '—'}</td>
                    <td className="px-2 py-2 text-center text-slate-400">
                      {s.vecesBlanco}/{s.vecesRojo}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-center text-slate-300" title={animo != null ? animoLabel(animo).texto : ''}>
                      {animo != null ? `${animoLabel(animo).emoji} ${animo.toFixed(1)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function rachaTexto(racha: number) {
  if (racha > 0) return <span className="font-medium text-emerald-400">{racha}V 🔥</span>
  if (racha < 0) return <span className="font-medium text-red-400">{-racha}D</span>
  return <span className="text-slate-500">—</span>
}

function TeamCard({ titulo, stats, acento }: { titulo: string; stats: TeamStats; acento: string }) {
  const dg = stats.golesFavor - stats.golesContra
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <h3 className={`text-base font-semibold ${acento}`}>{titulo}</h3>
      <Dato label="Partidos" valor={stats.partidos} />
      <Dato label="Victorias" valor={stats.victorias} />
      <Dato label="Empates" valor={stats.empates} />
      <Dato label="Derrotas" valor={stats.derrotas} />
      <Dato
        label="% victorias"
        valor={stats.partidos ? `${Math.round((stats.victorias / stats.partidos) * 100)}%` : '—'}
      />
      <Dato label="Goles a favor" valor={stats.golesFavor} />
      <Dato label="Goles en contra" valor={stats.golesContra} />
      <Dato label="Diferencia" valor={dg > 0 ? `+${dg}` : dg} />
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-700/40 pb-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-200">{valor}</span>
    </div>
  )
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-t border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ' +
        (active
          ? 'border-emerald-500 text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200')
      }
    >
      {children}
    </button>
  )
}
