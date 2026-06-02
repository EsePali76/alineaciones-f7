import { useMemo, useState } from 'react'
import { useLineupsStore } from '../store/lineupsStore'
import { usePlayersStore } from '../store/playersStore'
import { useRotationStore } from '../store/rotationStore'
import { useAuthStore } from '../store/authStore'
import { useTurno } from '../hooks/useTurno'
import type { ConfirmedLineup, MatchResult } from '../domain/types'

export function HistoryList() {
  const lineups = useLineupsStore((s) => s.lineups)
  const removeLineup = useLineupsStore((s) => s.removeLineup)
  const players = usePlayersStore((s) => s.players)
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of players) m.set(p.id, p.nombre)
    return m
  }, [players])

  const nombre = (id: string) => nombrePorId.get(id) ?? '(jugador eliminado)'
  const ordenadas = [...lineups].sort((a, b) => b.fecha - a.fecha)

  if (ordenadas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
        Aún no hay alineaciones confirmadas. Genera unos equipos y pulsa «Confirmar alineación».
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">
        {ordenadas.length} alineaciones confirmadas · las más recientes pesan más al evitar
        repeticiones
      </p>
      {ordenadas.map((lu) => (
        <div key={lu.id} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium">
                {new Date(lu.fecha).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
              {lu.madeBy && (
                <span className="ml-2 text-xs text-slate-500">· la hizo {nombre(lu.madeBy)}</span>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  if (confirm('¿Eliminar esta alineación del historial?')) removeLineup(lu.id)
                }}
                className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:border-red-500"
              >
                Borrar
              </button>
            )}
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div className="rounded border border-slate-400 bg-slate-900/60 p-2">
              <span className="text-xs font-semibold text-slate-200">⚪ Equipo A</span>
              <p className="text-slate-300">{lu.teamA.map(nombre).join(', ')}</p>
            </div>
            <div className="rounded border border-red-900 bg-slate-900/60 p-2">
              <span className="text-xs font-semibold text-red-400">🔴 Equipo B</span>
              <p className="text-slate-300">{lu.teamB.map(nombre).join(', ')}</p>
            </div>
          </div>
          <ResultadoRow lineup={lu} isAdmin={isAdmin} nombre={nombre} />
        </div>
      ))}
    </div>
  )
}

/** Muestra/edita el resultado de una alineación: marcador + goleadores + asistencias. */
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
  const { current: turnoActual } = useTurno()

  const r = lineup.resultado
  const [editando, setEditando] = useState(false)
  const [a, setA] = useState(String(r?.golesA ?? ''))
  const [b, setB] = useState(String(r?.golesB ?? ''))
  const [goles, setGoles] = useState<Record<string, string>>(() => mapToStr(r?.goleadores))
  const [asist, setAsist] = useState<Record<string, string>>(() => mapToStr(r?.asistencias))

  const jugadores = [...lineup.teamA, ...lineup.teamB]

  const guardar = () => {
    const eraSinResultado = !lineup.resultado
    const resultado: MatchResult = {
      golesA: Math.max(0, Math.round(Number(a) || 0)),
      golesB: Math.max(0, Math.round(Number(b) || 0)),
      goleadores: strToMap(goles),
      asistencias: strToMap(asist),
    }
    setResultado(lineup.id, resultado)
    setEditando(false)
    // Partido jugado → el turno pasa al siguiente. Solo al registrar el resultado por
    // primera vez y si la hizo quien tiene el turno actual (evita avances al rellenar antiguas).
    if (eraSinResultado && lineup.madeBy && lineup.madeBy === turnoActual?.id) {
      alConfirmar(lineup.madeBy).catch((e) => console.error('No se pudo avanzar el turno', e))
    }
  }

  // ---- Vista (con resultado, sin editar) ----
  if (r && !editando) {
    const ganaA = r.golesA > r.golesB
    const ganaB = r.golesB > r.golesA
    const goleadores = entriesPos(r.goleadores)
    const asistencias = entriesPos(r.asistencias)
    return (
      <div className="mt-2 flex flex-col gap-1 border-t border-slate-700/60 pt-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400">Resultado:</span>
          <span className={ganaA ? 'font-bold text-white' : 'text-slate-300'}>⚪ {r.golesA}</span>
          <span className="text-slate-500">-</span>
          <span className={ganaB ? 'font-bold text-red-400' : 'text-slate-300'}>{r.golesB} 🔴</span>
          <span className="text-xs text-slate-500">
            {ganaA ? '· gana Blanco' : ganaB ? '· gana Rojo' : '· empate'}
          </span>
          {isAdmin && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditando(true)}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
              >
                Editar
              </button>
              <button
                onClick={() => clearResultado(lineup.id)}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-slate-300"
              >
                Quitar
              </button>
            </div>
          )}
        </div>
        {goleadores.length > 0 && (
          <p className="text-xs text-slate-400">
            ⚽ {goleadores.map(([id, n]) => `${nombre(id)}${n > 1 ? ` (${n})` : ''}`).join(', ')}
          </p>
        )}
        {asistencias.length > 0 && (
          <p className="text-xs text-slate-400">
            🅰️ {asistencias.map(([id, n]) => `${nombre(id)}${n > 1 ? ` (${n})` : ''}`).join(', ')}
          </p>
        )}
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mt-2 border-t border-slate-700/60 pt-2 text-sm text-slate-500">
        Sin resultado aún
      </div>
    )
  }

  // ---- Edición (admin) ----
  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-slate-700/60 pt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400">Marcador:</span>
        <span className="text-slate-300">⚪</span>
        <input
          type="number"
          min={0}
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="-"
          className="w-14 rounded border border-slate-600 bg-slate-900 px-2 py-1"
        />
        <span className="text-slate-500">-</span>
        <input
          type="number"
          min={0}
          value={b}
          onChange={(e) => setB(e.target.value)}
          placeholder="-"
          className="w-14 rounded border border-slate-600 bg-slate-900 px-2 py-1"
        />
        <span className="text-slate-300">🔴</span>
      </div>

      {/* Goles y asistencias por jugador */}
      <div className="rounded border border-slate-700 p-2">
        <div className="mb-1 grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs text-slate-500">
          <span>Jugador</span>
          <span className="w-12 text-center">⚽</span>
          <span className="w-12 text-center">🅰️</span>
        </div>
        <div className="flex flex-col gap-1">
          {jugadores.map((id) => (
            <div key={id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
              <span className="truncate text-slate-300">{nombre(id)}</span>
              <input
                type="number"
                min={0}
                value={goles[id] ?? ''}
                onChange={(e) => setGoles((g) => ({ ...g, [id]: e.target.value }))}
                placeholder="0"
                className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-center"
              />
              <input
                type="number"
                min={0}
                value={asist[id] ?? ''}
                onChange={(e) => setAsist((s) => ({ ...s, [id]: e.target.value }))}
                placeholder="0"
                className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-center"
              />
            </div>
          ))}
        </div>
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
              setA(String(r.golesA))
              setB(String(r.golesB))
              setGoles(mapToStr(r.goleadores))
              setAsist(mapToStr(r.asistencias))
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

// ---- Helpers de conversión Record<string,number> ↔ Record<string,string> ----
function mapToStr(m?: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {}
  if (m) for (const [k, v] of Object.entries(m)) if (v > 0) out[k] = String(v)
  return out
}
function strToMap(m: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(m)) {
    const n = Math.max(0, Math.round(Number(v) || 0))
    if (n > 0) out[k] = n
  }
  return out
}
function entriesPos(m?: Record<string, number>): [string, number][] {
  return Object.entries(m ?? {}).filter(([, n]) => n > 0)
}
