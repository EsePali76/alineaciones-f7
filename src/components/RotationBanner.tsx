import { useTurno } from '../hooks/useTurno'
import { useAuthStore } from '../store/authStore'
import { usePlayersStore } from '../store/playersStore'
import { useRotationStore } from '../store/rotationStore'
import type { PlayerInput } from '../store/playersStore'

/**
 * Banner de turno, visible para todos: "esta semana hace la alineación X".
 * Acciones según quién mira: pasar turno (el del turno), salir/entrar del listado
 * (cualquier vinculado), avanzar/reiniciar (admin).
 */
export function RotationBanner() {
  const { current, isMyTurn } = useTurno()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const isLinked = useAuthStore((s) => s.isLinked)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)
  const players = usePlayersStore((s) => s.players)
  const updatePlayer = usePlayersStore((s) => s.updatePlayer)
  const pasarTurno = useRotationStore((s) => s.pasarTurno)
  const reiniciar = useRotationStore((s) => s.reiniciar)

  const yo = myPlayerId ? players.find((p) => p.id === myPlayerId) : undefined
  const estoyExcluido = yo?.excluidoRotacion ?? false

  const setExcluido = async (value: boolean) => {
    if (!yo) return
    await updatePlayer(yo.id, { ...yo, excluidoRotacion: value } as PlayerInput)
    // Si me autoexcluyo estando de turno, paso para que avance al siguiente.
    if (value && isMyTurn) await pasarTurno()
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2 text-sm">
      <span className="text-slate-300">
        🗓️ Esta semana hace la alineación:{' '}
        <b className="text-white">{current ? current.nombre : '— sin asignar —'}</b>
        {isMyTurn && <span className="ml-1 text-emerald-400">· ¡te toca! Ve a “Equipos”.</span>}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {isMyTurn && (
          <button
            onClick={() => {
              if (confirm('¿No puedes hacerla esta semana? Pasa el turno al siguiente.')) pasarTurno()
            }}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
          >
            No puedo → pasar turno
          </button>
        )}

        {isLinked && !isAdmin && (
          estoyExcluido ? (
            <button
              onClick={() => setExcluido(false)}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
            >
              Entrar al listado de alineadores
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm('¿Salir del listado de alineadores? No te tocará hacer alineaciones.'))
                  setExcluido(true)
              }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-slate-300"
            >
              Salir del listado
            </button>
          )
        )}

        {isAdmin && (
          <>
            <button
              onClick={() => pasarTurno()}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
              title="Pasa al siguiente (p.ej. si el del turno no responde)"
            >
              Avanzar turno
            </button>
            <button
              onClick={() => {
                if (confirm('¿Reiniciar la rotación con los elegibles actuales?')) reiniciar()
              }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-slate-300"
            >
              Reiniciar rotación
            </button>
          </>
        )}
      </div>
    </div>
  )
}
