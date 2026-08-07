import { useMemo, useState } from 'react'
import { useLineupsStore } from '../store/lineupsStore'
import { usePlayersStore } from '../store/playersStore'
import { useRotationStore } from '../store/rotationStore'
import { useAuthStore } from '../store/authStore'
import { useTurno } from '../hooks/useTurno'
import { useEffectivePlayers } from '../hooks/useEffectivePlayers'
import { mvpEfectivo } from '../domain/animo'
import { goleadoresDe, asistenciasDe } from '../domain/result'
import { temporadasDisponibles, filtrarPorTemporada, TODAS } from '../domain/season'
import { evaluatePartition } from '../domain/balancer'
import { formacionPorNombre } from '../domain/formation'
import { SeasonPicker } from './SeasonPicker'
import { FieldView } from './FieldView'
import type { ConfirmedLineup, GoalEvent, MatchResult, Player } from '../domain/types'
import { nombreVisible } from '../domain/types'

export function HistoryList() {
  const lineups = useLineupsStore((s) => s.lineups)
  const players = usePlayersStore((s) => s.players)
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of players) m.set(p.id, nombreVisible(p))
    return m
  }, [players])
  const nombre = (id: string) => nombrePorId.get(id) ?? '(jugador eliminado)'

  const temporadas = useMemo(() => temporadasDisponibles(lineups), [lineups])
  const [temporada, setTemporada] = useState<string>(() => temporadasDisponibles(lineups)[0] ?? TODAS)

  const ordenadas = useMemo(
    () => filtrarPorTemporada(lineups, temporada).sort((a, b) => b.fecha - a.fecha),
    [lineups, temporada],
  )

  if (lineups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
        Aún no hay partidos. Cuando se confirme una alineación, aparecerá aquí.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SeasonPicker temporadas={temporadas} valor={temporada} onChange={setTemporada} />
      <p className="text-sm text-slate-400">
        {ordenadas.length} {ordenadas.length === 1 ? 'partido' : 'partidos'}
        {temporada === TODAS ? ' (todas las temporadas)' : ` · temporada ${temporada}`}
      </p>
      {ordenadas.map((lu) => (
        <MatchCard key={lu.id} lineup={lu} isAdmin={isAdmin} nombre={nombre} />
      ))}
    </div>
  )
}

/** Tarjeta de un partido: colapsada muestra fecha + marcador + MVP; desplegada, todo. */
function MatchCard({
  lineup,
  isAdmin,
  nombre,
}: {
  lineup: ConfirmedLineup
  isAdmin: boolean
  nombre: (id: string) => string
}) {
  const removeLineup = useLineupsStore((s) => s.removeLineup)
  const setFecha = useLineupsStore((s) => s.setFecha)
  const [open, setOpen] = useState(false)
  const r = lineup.resultado
  const mvpId = r ? mvpEfectivo(lineup) : null
  const ganaA = !!r && r.golesA > r.golesB
  const ganaB = !!r && r.golesB > r.golesA

  const fechaTxt = new Date(lineup.fecha).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40">
      {/* Cabecera siempre visible (clic = desplegar) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex w-full flex-col items-center gap-1 px-3 py-2 text-center"
      >
        <span className="absolute left-3 top-2 text-xs font-medium capitalize text-slate-400">
          {fechaTxt}
        </span>
        {r ? (
          <span className="flex items-center gap-2.5 text-xl">
            <span>⚪</span>
            <span className={ganaA ? 'font-bold text-white' : 'text-slate-300'}>{r.golesA}</span>
            <span className="text-slate-500">-</span>
            <span className={ganaB ? 'font-bold text-red-400' : 'text-slate-300'}>{r.golesB}</span>
            <span>🔴</span>
          </span>
        ) : (
          <span className="text-sm text-slate-500">Sin resultado</span>
        )}
        {mvpId && (
          <span className="text-sm text-amber-400">
            🏆 MVP: <span className="font-semibold text-emerald-400">{nombre(mvpId)}</span>
          </span>
        )}
        <span
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-3xl leading-none text-slate-400 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-700/60 p-3">
          <ResultadoRow lineup={lineup} isAdmin={isAdmin} nombre={nombre} />

          {/* Alineaciones: campo gráfico (con fallback a texto en partidos antiguos) */}
          <div className="mt-3 border-t border-slate-700/60 pt-3">
            <MatchField lineup={lineup} nombre={nombre} />
          </div>

          <div className="mt-2 flex items-center justify-end">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  📅
                  <input
                    type="date"
                    value={fechaInputValue(lineup.fecha)}
                    onChange={(e) => {
                      const ts = parseFechaInput(e.target.value)
                      if (ts != null) setFecha(lineup.id, ts)
                    }}
                    className="rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-200"
                    title="Cambiar la fecha del partido"
                  />
                </label>
                <button
                  onClick={() => {
                    if (confirm('¿Eliminar este partido del historial?')) removeLineup(lineup.id)
                  }}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:border-red-500"
                >
                  Borrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Timestamp → "YYYY-MM-DD" en horario local, para el value del <input type="date">. */
function fechaInputValue(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "YYYY-MM-DD" del input → timestamp a mediodía local (evita saltos de día por zona horaria). */
function parseFechaInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0).getTime()
}

/**
 * Alineación del partido dibujada en el campo (igual que la vista de confirmada).
 * Si el partido no guardó formación/colocación (datos antiguos), cae al listado de texto.
 */
function MatchField({
  lineup,
  nombre,
}: {
  lineup: ConfirmedLineup
  nombre: (id: string) => string
}) {
  const players = useEffectivePlayers()
  const lineups = useLineupsStore((s) => s.lineups)

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const teamA = lineup.teamA.map((id) => byId.get(id)).filter((p): p is Player => !!p)
  const teamB = lineup.teamB.map((id) => byId.get(id)).filter((p): p is Player => !!p)

  const balance = useMemo(
    () => evaluatePartition(teamA, teamB, { history: lineups }),
    [teamA, teamB, lineups],
  )

  const formacionA = formacionPorNombre(teamA.length, lineup.formacionA ?? '')
  const formacionB = formacionPorNombre(teamB.length, lineup.formacionB ?? '')

  // Marcas (⚽/🅰️) por jugador a partir del resultado, para pintarlas sobre las fichas.
  const marcas = useMemo(() => {
    const m = new Map<string, { goles: number; asist: number }>()
    if (!lineup.resultado) return m
    const g = goleadoresDe(lineup.resultado)
    const a = asistenciasDe(lineup.resultado)
    for (const [id, n] of Object.entries(g)) m.set(id, { goles: n, asist: 0 })
    for (const [id, n] of Object.entries(a)) m.set(id, { goles: m.get(id)?.goles ?? 0, asist: n })
    return m
  }, [lineup.resultado])

  // Sin formación o con jugadores eliminados que descuadran el campo → listado de texto.
  const completo =
    teamA.length === lineup.teamA.length && teamB.length === lineup.teamB.length
  if (!formacionA || !formacionB || !completo) {
    return (
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded border border-slate-400 bg-slate-900/60 p-2">
          <span className="text-xs font-semibold text-slate-200">⚪ Equipo A</span>
          <p className="text-slate-300">{lineup.teamA.map(nombre).join(', ')}</p>
        </div>
        <div className="rounded border border-red-900 bg-slate-900/60 p-2">
          <span className="text-xs font-semibold text-red-400">🔴 Equipo B</span>
          <p className="text-slate-300">{lineup.teamB.map(nombre).join(', ')}</p>
        </div>
      </div>
    )
  }

  return (
    <FieldView
      balance={balance}
      formacionA={formacionA}
      formacionB={formacionB}
      onCrossSwap={() => {}}
      readOnly
      placementA={lineup.placementA ?? null}
      placementB={lineup.placementB ?? null}
      marcas={marcas}
    />
  )
}

/** Muestra/edita el resultado: marcador + goles (con asistente) por equipo. */
function ResultadoRow({
  lineup,
  isAdmin,
  nombre,
}: {
  lineup: ConfirmedLineup
  isAdmin: boolean
  nombre: (id: string) => string
}) {
  const setResultado = useLineupsStore((s) => s.setResultado)
  const clearResultado = useLineupsStore((s) => s.clearResultado)
  const alConfirmar = useRotationStore((s) => s.alConfirmar)
  // Turno REAL de la cola (no el "congelado" que se muestra en el banner): así, si se
  // borra y vuelve a registrar el resultado, la rotación no avanza dos veces.
  const { currentColaId } = useTurno()

  const r = lineup.resultado
  const [editando, setEditando] = useState(false)
  const [golesA, setGolesA] = useState<GoalRow[]>(() => rowsIniciales(r, lineup.teamA, 'A'))
  const [golesB, setGolesB] = useState<GoalRow[]>(() => rowsIniciales(r, lineup.teamB, 'B'))
  const [mvp, setMvp] = useState<string>(r?.mvp ?? '')

  const jugadores = [...lineup.teamA, ...lineup.teamB]

  const guardar = () => {
    const eraSinResultado = !lineup.resultado
    const goles: GoalEvent[] = [
      ...golesA.map((g) => mkGol('A', g)),
      ...golesB.map((g) => mkGol('B', g)),
    ]
    const resultado: MatchResult = {
      golesA: golesA.length,
      golesB: golesB.length,
      goles,
      mvp: mvp || undefined,
    }
    setResultado(lineup.id, resultado)
    setEditando(false)
    // Partido jugado → el turno pasa al siguiente. Solo al registrar el resultado por
    // primera vez y si la hizo quien tiene el turno actual (evita avances al rellenar antiguas).
    if (eraSinResultado && lineup.madeBy && lineup.madeBy === currentColaId) {
      alConfirmar(lineup.madeBy).catch((e) => console.error('No se pudo avanzar el turno', e))
    }
  }

  // ---- Vista (con resultado, sin editar) ----
  if (r && !editando) {
    return (
      <div className="text-sm">
        {isAdmin && (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditando(true)}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
            >
              Editar
            </button>
            <button
              onClick={() => {
                if (confirm('¿Resetear el resultado? Se borran goles, asistencias y MVP.'))
                  clearResultado(lineup.id)
              }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-slate-300"
            >
              Reset
            </button>
          </div>
        )}
        {/* Goles de cada equipo en su lado, con la asistencia bajo cada gol */}
        <div className="relative mt-3 text-xs">
          <div className="absolute left-0 top-0 leading-tight">
            <span className="font-semibold text-slate-300">Goleadores</span>
            <span className="block text-slate-500">(Asistentes)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ListaGoles result={r} equipo="A" teamIds={lineup.teamA} nombre={nombre} lado="der" />
            <ListaGoles result={r} equipo="B" teamIds={lineup.teamB} nombre={nombre} lado="izq" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <div className="text-sm text-slate-500">Sin resultado aún.</div>
  }

  // ---- Edición (admin) ----
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <TeamGoals
          titulo="⚪ Blanco"
          jugadores={lineup.teamA}
          rows={golesA}
          setRows={setGolesA}
          nombre={nombre}
        />
        <TeamGoals
          titulo="🔴 Rojo"
          jugadores={lineup.teamB}
          rows={golesB}
          setRows={setGolesB}
          nombre={nombre}
        />
      </div>

      <div className="text-center text-lg font-semibold text-slate-300">
        ⚪ {golesA.length} - {golesB.length} 🔴
      </div>

      {/* MVP manual (opcional; si se deja en automático, se detecta por goles+asistencias) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400">🏆 MVP:</span>
        <select
          value={mvp}
          onChange={(e) => setMvp(e.target.value)}
          className="rounded border border-slate-600 bg-slate-900 px-2 py-1"
        >
          <option value="">— automático (por goles+asist.) —</option>
          {jugadores.map((id) => (
            <option key={id} value={id}>
              {nombre(id)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={guardar}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Guardar resultado
        </button>
        {r && (
          <button
            onClick={() => {
              setGolesA(rowsIniciales(r, lineup.teamA, 'A'))
              setGolesB(rowsIniciales(r, lineup.teamB, 'B'))
              setMvp(r.mvp ?? '')
              setEditando(false)
            }}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

/** Lista de goles de un equipo para la vista de marcador (gol + asistente debajo). */
function ListaGoles({
  result,
  equipo,
  teamIds,
  nombre,
  lado,
}: {
  result: MatchResult
  equipo: 'A' | 'B'
  teamIds: string[]
  nombre: (id: string) => string
  lado: 'izq' | 'der'
}) {
  const align = lado === 'der' ? 'text-right' : 'text-left'
  const bola = (txt: string) => (equipo === 'A' ? `⚽ ${txt}` : `${txt} ⚽`)
  const asistTxt = (txt: string) => (equipo === 'A' ? `🅰️ ${txt}` : `${txt} 🅰️`)

  // Modelo nuevo: lista de goles en orden, con asistente bajo cada uno.
  if (result.goles) {
    const goles = result.goles.filter((g) => g.equipo === equipo)
    return (
      <div className={`flex flex-col gap-1 ${align} text-slate-300`}>
        {goles.map((g, i) => (
          <div key={i} className="leading-tight">
            <span className="text-amber-400">{bola(g.autor ? nombre(g.autor) : 'Gol')}</span>
            {g.asistente && (
              <span className="block text-[0.9em] text-slate-300">
                (🅰️ {nombre(g.asistente)})
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Legado: contadores agregados (sin vínculo gol↔asistencia), filtrados por equipo.
  const set = new Set(teamIds)
  const goles = Object.entries(goleadoresDe(result)).filter(([id, n]) => n > 0 && set.has(id))
  const asist = Object.entries(asistenciasDe(result)).filter(([id, n]) => n > 0 && set.has(id))
  return (
    <div className={`flex flex-col gap-0.5 ${align} text-slate-300`}>
      {goles.map(([id, n]) => (
        <span key={id} className="text-amber-400">
          {bola(`${nombre(id)}${n > 1 ? ` (${n})` : ''}`)}
        </span>
      ))}
      {asist.map(([id, n]) => (
        <span key={id} className="text-slate-300">
          {asistTxt(`${nombre(id)}${n > 1 ? ` (${n})` : ''}`)}
        </span>
      ))}
    </div>
  )
}

/** Editor de goles de un equipo: filas (autor + asistente) y botón añadir. */
function TeamGoals({
  titulo,
  jugadores,
  rows,
  setRows,
  nombre,
}: {
  titulo: string
  jugadores: string[]
  rows: GoalRow[]
  setRows: React.Dispatch<React.SetStateAction<GoalRow[]>>
  nombre: (id: string) => string
}) {
  const update = (i: number, patch: Partial<GoalRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i))
  const add = () => setRows((rs) => [...rs, { autor: '', asistente: '' }])

  return (
    <div className="rounded border border-slate-700 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-200">{titulo}</span>
        <span className="text-xs text-slate-500">
          {rows.length} {rows.length === 1 ? 'gol' : 'goles'}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            <select
              value={row.autor}
              onChange={(e) => update(i, { autor: e.target.value })}
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-xs"
            >
              <option value="">⚽ ¿quién marcó?</option>
              {jugadores.map((id) => (
                <option key={id} value={id}>
                  {nombre(id)}
                </option>
              ))}
            </select>
            <select
              value={row.asistente}
              onChange={(e) => update(i, { asistente: e.target.value })}
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-xs text-slate-400"
            >
              <option value="">🅰️ sin asistencia</option>
              {jugadores
                .filter((id) => id !== row.autor)
                .map((id) => (
                  <option key={id} value={id}>
                    {nombre(id)}
                  </option>
                ))}
            </select>
            <button
              onClick={() => remove(i)}
              className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-500 hover:border-red-600 hover:text-red-400"
              title="Quitar gol"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        className="mt-1 w-full rounded border border-dashed border-slate-600 py-1 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-200"
      >
        + Añadir gol
      </button>
    </div>
  )
}

// ---- Estado del editor: una fila por gol ----
type GoalRow = { autor: string; asistente: string }

/** Filas iniciales de goles de un equipo, a partir del resultado existente. */
function rowsIniciales(
  r: MatchResult | undefined,
  teamIds: string[],
  equipo: 'A' | 'B',
): GoalRow[] {
  if (r?.goles) {
    return r.goles
      .filter((g) => g.equipo === equipo)
      .map((g) => ({ autor: g.autor ?? '', asistente: g.asistente ?? '' }))
  }
  // Datos antiguos: expandir contadores de goleadores de este equipo y rellenar
  // hasta el marcador con goles de autor desconocido. Las asistencias antiguas no
  // se pueden vincular a un gol concreto, así que se pierden al reeditar.
  const rows: GoalRow[] = []
  const set = new Set(teamIds)
  for (const [id, n] of Object.entries(r?.goleadores ?? {})) {
    if (set.has(id)) for (let i = 0; i < n; i++) rows.push({ autor: id, asistente: '' })
  }
  const total = equipo === 'A' ? r?.golesA ?? 0 : r?.golesB ?? 0
  while (rows.length < total) rows.push({ autor: '', asistente: '' })
  return rows
}

function mkGol(equipo: 'A' | 'B', g: GoalRow): GoalEvent {
  const e: GoalEvent = { equipo }
  if (g.autor) e.autor = g.autor
  if (g.asistente) e.asistente = g.asistente
  return e
}
