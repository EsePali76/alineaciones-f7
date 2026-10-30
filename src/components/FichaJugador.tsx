import { useEffect, useMemo, useState } from 'react'
import { useLineupsStore } from '../store/lineupsStore'
import { useEffectivePlayers, useSimulacionAjustes } from '../hooks/useEffectivePlayers'
import { playerScore, weightedRatings } from '../domain/scoring'
import { temporadaDe } from '../domain/season'
import { fotoVisible, nombreVisible } from '../domain/types'
import { Avatar } from './Avatar'
import { AjusteFlecha } from './AjusteFlecha'
import { SeasonPicker } from './SeasonPicker'
import { Delta, TablaAjuste } from './TablaAjuste'
import { MatchCard } from './HistoryList'

/**
 * Ficha de un jugador (se abre pinchando en él en Estadísticas → Por jugador): su
 * Valoración (la del grupo) y su ajuste, con el Nivel (la nota de reparto) en grande;
 * y, por temporada y en orden cronológico, cada partido con el nivel medio de los dos
 * equipos, la probabilidad de victoria que tenía, el marcador, el ajuste que le dio y
 * su Nivel después. Tocar un partido despliega su ficha, igual que en Partidos.
 * Encima del historial, «¿Cómo se calcula el ajuste?» con la tabla editable.
 */
export function FichaJugador({
  playerId,
  temporadaInicial,
  onClose,
}: {
  playerId: string
  temporadaInicial?: string
  onClose: () => void
}) {
  const lineups = useLineupsStore((s) => s.lineups)
  const players = useEffectivePlayers()
  const sim = useSimulacionAjustes()
  const [verTabla, setVerTabla] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  const p = players.find((pl) => pl.id === playerId)
  const nombre = (id: string) => nombreVisible(players.find((pl) => pl.id === id)) || '(jugador eliminado)'

  // Sus partidos con resultado, del más viejo al más nuevo: así el Nivel se lee de
  // arriba abajo como una trayectoria.
  const partidos = useMemo(
    () =>
      lineups
        .filter((l) => l.resultado && (l.teamA.includes(playerId) || l.teamB.includes(playerId)))
        .sort((a, b) => a.fecha - b.fecha),
    [lineups, playerId],
  )
  // Temporadas de la más reciente a la más antigua (la primera es la que se abre).
  const temporadas = useMemo(
    () => [...new Set(partidos.map((l) => temporadaDe(l.fecha)))].reverse(),
    [partidos],
  )
  const [temporada, setTemporada] = useState<string | undefined>(temporadaInicial)
  const temporadaSel = temporada && temporadas.includes(temporada) ? temporada : temporadas[0]
  const filas = partidos.filter((l) => temporadaDe(l.fecha) === temporadaSel)
  const totalTemporada = temporadaSel ? sim.jugadores.get(playerId)?.porTemporada.get(temporadaSel) : undefined

  // Esc cierra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!p) return null
  const ajuste = sim.jugadores.get(playerId)?.total ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-2 sm:p-6" onClick={onClose}>
      <div
        className="relative flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-slate-700 bg-slate-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-2 text-2xl leading-none text-slate-400 hover:text-white"
          aria-label="Cerrar"
        >
          ×
        </button>

        {/* Cabecera: foto, nombre, Valoración y ajuste; el Nivel en grande */}
        <div className="flex items-center gap-4 pr-6">
          <Avatar src={fotoVisible(p)} alt={nombreVisible(p)} className="h-16 w-16" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xl font-semibold text-white">{nombreVisible(p)}</span>
            <span className="text-sm text-slate-400">
              Valoración <b className="text-slate-200 tabular-nums">{weightedRatings(p).toFixed(2)}</b>
            </span>
            <span className="text-sm text-slate-400">
              Ajuste <AjusteFlecha valor={ajuste} />
            </span>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-4xl font-bold leading-none text-white tabular-nums">
              {playerScore(p).toFixed(2)}
            </span>
            <span className="mt-1 text-xs text-slate-400">Nivel</span>
          </div>
        </div>

        {temporadas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
            Aún no ha jugado ningún partido con resultado.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SeasonPicker
                temporadas={temporadas}
                valor={temporadaSel ?? ''}
                onChange={(t) => {
                  setTemporada(t)
                  setAbierto(null)
                }}
                incluirTotales={false}
                siempreVisible
              />
              <button
                onClick={() => setVerTabla((v) => !v)}
                className="ml-auto rounded border border-sky-600 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-600/10"
              >
                {verTabla ? '✕ Cerrar' : '¿Cómo se calcula el ajuste?'}
              </button>
            </div>

            {verTabla && <TablaAjuste />}

            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800 text-left text-slate-400">
                    <th className="px-2 py-2 font-medium">Fecha</th>
                    <th className="px-2 py-2 font-medium" title="Su equipo y nivel medio: el suyo vs el rival">
                      Partido (medias)
                    </th>
                    <th className="px-2 py-2 text-center font-medium" title="Probabilidad de victoria de su equipo">
                      Prob.
                    </th>
                    <th className="px-2 py-2 text-center font-medium">Resultado</th>
                    <th className="px-2 py-2 text-right font-medium" title="Lo que le dio el partido (con el +0,02 por jugar)">
                      Ajuste
                    </th>
                    <th className="px-2 py-2 text-right font-medium" title="Su Nivel justo después del partido">
                      Nivel
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((l) => {
                    const r = l.resultado!
                    const enA = l.teamA.includes(playerId)
                    const info = sim.partidos.get(l.id)
                    const delta = info?.delta?.get(playerId)
                    const nota = info?.notaDespues?.get(playerId)
                    const prob = info ? (enA ? info.probA : 1 - info.probA) : undefined
                    const mio = enA ? info?.mediaA : info?.mediaB
                    const rival = enA ? info?.mediaB : info?.mediaA
                    const gf = enA ? r.golesA : r.golesB
                    const gc = enA ? r.golesB : r.golesA
                    const letra = gf > gc ? 'V' : gf < gc ? 'D' : 'E'
                    const color = gf > gc ? 'bg-emerald-600' : gf < gc ? 'bg-red-600' : 'bg-slate-600'
                    const desplegado = abierto === l.id
                    return (
                      <FilaPartido
                        key={l.id}
                        onClick={() => setAbierto(desplegado ? null : l.id)}
                        desplegado={desplegado}
                        celdas={
                          <>
                            <td className="whitespace-nowrap px-2 py-2 text-slate-300">
                              {new Date(l.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-slate-300">
                              {enA ? '⚪' : '🔴'}{' '}
                              {mio != null && rival != null && (
                                <span className="text-xs text-slate-400 tabular-nums">
                                  {mio.toFixed(2)} vs {rival.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center text-slate-300 tabular-nums">
                              {delta != null && prob != null ? `${Math.round(prob * 100)}%` : '—'}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-center">
                              <span className={`mr-1.5 inline-block w-5 rounded text-center text-xs font-bold text-white ${color}`}>
                                {letra}
                              </span>
                              <span className="font-semibold text-slate-100 tabular-nums">
                                {gf}-{gc}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right">{delta != null ? <Delta v={delta} /> : '—'}</td>
                            <td className="px-2 py-2 text-right text-slate-200 tabular-nums">
                              {nota != null ? nota.toFixed(2) : '—'}
                            </td>
                          </>
                        }
                        detalle={
                          // La ficha del partido tal cual sale en Partidos, ya desplegada y
                          // sin controles de admin (aquí solo se consulta).
                          <MatchCard
                            lineup={l}
                            isAdmin={false}
                            nombre={nombre}
                            probA={info?.probA}
                            abiertaInicial
                          />
                        }
                      />
                    )
                  })}
                </tbody>
                {totalTemporada != null && (
                  <tfoot>
                    <tr className="border-t border-slate-600 bg-slate-800/60">
                      <td colSpan={4} className="px-2 py-2 text-right text-slate-400">
                        Total de la temporada
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Delta v={totalTemporada} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {filas.some((l) => !sim.partidos.get(l.id)?.delta) && (
              <p className="text-xs text-slate-500">
                «—»: partidos de antes de que existiera el ajuste por resultados (empezó a contar en la temporada
                26/27).
              </p>
            )}
            <p className="text-xs text-slate-500">Toca un partido para ver su detalle.</p>
          </>
        )}
      </div>
    </div>
  )
}

function FilaPartido({
  celdas,
  detalle,
  desplegado,
  onClick,
}: {
  celdas: React.ReactNode
  detalle: React.ReactNode
  desplegado: boolean
  onClick: () => void
}) {
  return (
    <>
      <tr
        onClick={onClick}
        className={`cursor-pointer border-t border-slate-700/60 hover:bg-slate-800/50 ${desplegado ? 'bg-slate-800/50' : ''}`}
      >
        {celdas}
      </tr>
      {desplegado && (
        <tr className="bg-slate-800/50">
          <td colSpan={6} className="px-2 pb-2">
            {detalle}
          </td>
        </tr>
      )}
    </>
  )
}
