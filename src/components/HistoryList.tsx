import { useMemo, useState } from 'react'
import { useLineupsStore } from '../store/lineupsStore'
import { usePlayersStore } from '../store/playersStore'
import { useAuthStore } from '../store/authStore'
import type { ConfirmedLineup } from '../domain/types'

export function HistoryList() {
  const lineups = useLineupsStore((s) => s.lineups)
  const removeLineup = useLineupsStore((s) => s.removeLineup)
  const players = usePlayersStore((s) => s.players)
  const isAdmin = useAuthStore((s) => s.isAdmin)

  // Mapa id → nombre para mostrar las alineaciones de forma legible.
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
        Aún no hay alineaciones confirmadas. Genera unos equipos y pulsa «Confirmar alineación»
        para que el sistema empiece a evitar repeticiones.
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
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {new Date(lu.fecha).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
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
          <ResultadoRow lineup={lu} isAdmin={isAdmin} />
        </div>
      ))}
    </div>
  )
}

/** Muestra/edita el marcador de una alineación (tras el partido). */
function ResultadoRow({ lineup, isAdmin }: { lineup: ConfirmedLineup; isAdmin: boolean }) {
  const setResultado = useLineupsStore((s) => s.setResultado)
  const clearResultado = useLineupsStore((s) => s.clearResultado)

  const [editando, setEditando] = useState(false)
  const [a, setA] = useState(String(lineup.resultado?.golesA ?? ''))
  const [b, setB] = useState(String(lineup.resultado?.golesB ?? ''))

  const guardar = () => {
    const ga = Math.max(0, Math.round(Number(a) || 0))
    const gb = Math.max(0, Math.round(Number(b) || 0))
    setResultado(lineup.id, ga, gb)
    setEditando(false)
  }

  const r = lineup.resultado

  // Vista cuando hay resultado y no se está editando.
  if (r && !editando) {
    const ganaA = r.golesA > r.golesB
    const ganaB = r.golesB > r.golesA
    return (
      <div className="mt-2 flex items-center gap-3 border-t border-slate-700/60 pt-2 text-sm">
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
    )
  }

  // Sin resultado y sin permisos de admin: solo informa.
  if (!isAdmin) {
    return (
      <div className="mt-2 border-t border-slate-700/60 pt-2 text-sm text-slate-500">
        Sin resultado aún
      </div>
    )
  }

  // Vista de edición (admin).
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-700/60 pt-2 text-sm">
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
            setEditando(false)
          }}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
        >
          Cancelar
        </button>
      )}
    </div>
  )
}
