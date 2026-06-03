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
  const { current, next, isMyTurn } = useTurno()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const isLinked = useAuthStore((s) => s.isLinked)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)
  const players = usePlayersStore((s) => s.players)
  const updatePlayer = usePlayersStore((s) => s.updatePlayer)
  const pasarTurno = useRotationStore((s) => s.pasarTurno)
  const reiniciar = useRotationStore((s) => s.reiniciar)
  const ratingsOpen = useRotationStore((s) => s.ratingsOpen)

  const yo = myPlayerId ? players.find((p) => p.id === myPlayerId) : undefined
  const estoyExcluido = yo?.excluidoRotacion ?? false

  const setExcluido = async (value: boolean) => {
    if (!yo) return
    try {
      await updatePlayer(yo.id, { ...yo, excluidoRotacion: value } as PlayerInput)
      // Si me autoexcluyo estando de turno, paso para que avance al siguiente.
      if (value && isMyTurn) await pasarTurno()
    } catch {
      // El store ya avisa del error.
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-emerald-500/60 bg-emerald-900/30 px-4 py-3 text-base shadow-md shadow-emerald-900/40">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-slate-200">
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_2px] shadow-red-500/70" />
          🗓️ Esta semana hace la alineación:
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-5">
          <b className="text-xl text-red-400">{current ? current.nombre : '— sin asignar —'}</b>
          {isMyTurn && (
            <span className="animate-pulse font-semibold text-emerald-300">
              ¡te toca! Ve a “Equipos”.
            </span>
          )}

          {/* Acción junto al nombre: pasar/avanzar el turno */}
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
          {isAdmin && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `¿Avanzar el turno? Pasará de ${current?.nombre ?? '—'} al siguiente${next ? ` (${next.nombre})` : ''}.`,
                  )
                )
                  pasarTurno()
              }}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500"
              title="Pasa al siguiente (p.ej. si el del turno no responde)"
            >
              Avanzar turno
            </button>
          )}

          {/* A la derecha del todo: entrar/salir del sorteo de turnos */}
          {isLinked && !isAdmin && (
            estoyExcluido ? (
              <button
                onClick={() => setExcluido(false)}
                className="ml-auto rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
              >
                Me gustaría hacer las alineaciones
              </button>
            ) : (
              <button
                onClick={() => {
                  if (
                    confirm(
                      '¿Seguro que no quieres entrar en el sorteo de turnos para hacer las alineaciones?',
                    )
                  )
                    setExcluido(true)
                }}
                className="ml-auto rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
              >
                No quiero hacer las alineaciones
              </button>
            )
          )}
        </div>
        {next && (
          <span className="pl-5 text-sm text-slate-400">
            La próxima: <b className="text-slate-300">{next.nombre}</b>
          </span>
        )}
      </div>

      {/* Aviso del plazo de re-evaluación de valoraciones (lo abre el admin). */}
      {ratingsOpen && isLinked && (
        <div className="rounded-md border border-sky-500/50 bg-sky-900/30 px-3 py-2 text-sm text-sky-200">
          📝 <b>Plazo de reevaluación abierto:</b> puedes revisar y ajustar tus valoraciones en la
          pestaña «Valorar» mientras esté activo.
        </div>
      )}

      {isAdmin && (
        <button
          onClick={() => {
            if (confirm('¿Reiniciar la rotación en ORDEN ALEATORIO con los elegibles actuales?'))
              reiniciar()
          }}
          className="ml-auto rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-slate-300"
        >
          Reiniciar rotación (aleatorio)
        </button>
      )}
    </div>
  )
}
