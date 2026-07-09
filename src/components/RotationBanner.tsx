import { useState } from 'react'
import { useTurno } from '../hooks/useTurno'
import { useConvocatoria } from '../hooks/useConvocatoria'
import { useAuthStore } from '../store/authStore'
import { usePlayersStore } from '../store/playersStore'
import { useRotationStore } from '../store/rotationStore'
import { useConvocatoriaStore } from '../store/convocatoriaStore'
import { useLineupsStore } from '../store/lineupsStore'
import { ConfirmedLineupView } from './ConfirmedLineupView'
import { formatoFecha, siguienteJornada, partidoPasado } from '../domain/matchday'
import { nombreVisible } from '../domain/types'
import type { SignupRow, SignupStatus } from '../lib/convocatoriaApi'
import type { PlayerInput } from '../store/playersStore'

/**
 * Banner de turno + convocatoria, visible para todos. Contiene, en este orden:
 *  1. La fecha del próximo partido (+ botón admin "este lunes no hay partido").
 *  2. A quién le toca hacer la alineación (turno rotativo) y sus acciones.
 *  3. La cabecera "Convocatoria" con los botones para apuntarse (desde el domingo 12:00).
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
  const posponerJornada = useRotationStore((s) => s.posponerJornada)
  const fijarFecha = useRotationStore((s) => s.fijarFecha)
  const matchDate = useRotationStore((s) => s.matchDate)
  const ratingsOpen = useRotationStore((s) => s.ratingsOpen)
  const [fechaEdit, setFechaEdit] = useState('')

  const { fecha, abierta, titulares, reservas, noVienen, miEstado } = useConvocatoria()
  const apuntarse = useConvocatoriaStore((s) => s.apuntarse)
  const borrarse = useConvocatoriaStore((s) => s.borrarse)
  const lineups = useLineupsStore((s) => s.lineups)

  // Alineación confirmada pendiente de jugar (la de esta semana, sin resultado aún).
  // Caduca al día siguiente del partido: aunque no se registre resultado, deja de
  // mostrarse y vuelve la convocatoria de la próxima jornada.
  const pendingLineup = lineups
    .filter((l) => !l.resultado && !partidoPasado(l.fecha))
    .sort((a, b) => b.fecha - a.fecha)[0]

  const yo = myPlayerId ? players.find((p) => p.id === myPlayerId) : undefined
  const estoyExcluido = yo?.excluidoRotacion ?? false
  // Los usuarios "reserva" solo tienen el botón "Si falta gente voy".
  const soyReserva = yo?.reserva ?? false

  const nombreDe = (id: string) => {
    const p = players.find((x) => x.id === id)
    return p ? nombreVisible(p) : '(?)'
  }

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

  const apuntar = async (status: SignupStatus) => {
    if (!myPlayerId) return
    try {
      await apuntarse(myPlayerId, status, fecha)
    } catch {
      alert('No se pudo guardar tu apunte. Reintenta en un momento.')
    }
  }

  const desapuntar = async () => {
    if (!myPlayerId) return
    try {
      await borrarse(myPlayerId)
    } catch {
      alert('No se pudo borrar tu apunte. Reintenta en un momento.')
    }
  }

  const guardarFecha = async () => {
    const nueva = fechaEdit || fecha
    if (nueva === fecha && !matchDate) return // sin cambios
    try {
      await fijarFecha(nueva)
      setFechaEdit('')
    } catch {
      alert('No se pudo cambiar la fecha del partido.')
    }
  }

  const volverAutomatica = async () => {
    try {
      await fijarFecha(null)
      setFechaEdit('')
    } catch {
      alert('No se pudo restablecer la fecha automática.')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-emerald-500/60 bg-emerald-900/30 px-4 py-3 text-base shadow-md shadow-emerald-900/40">
      {/* 1) Fecha del próximo partido */}
      <div className="flex flex-col gap-1">
        <span className="text-slate-200">
          📅 Próximo partido:{' '}
          <b className="text-emerald-300">{formatoFecha(fecha)}</b>
        </span>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fechaEdit || fecha}
              onChange={(e) => setFechaEdit(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
              title="Fija el día del próximo partido (p.ej. moverlo de lunes a miércoles)."
            />
            <button
              onClick={guardarFecha}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
            >
              Cambiar fecha
            </button>
            {matchDate && (
              <button
                onClick={volverAutomatica}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
                title="Vuelve a la fecha automática (el lunes que toque)."
              >
                Volver a automático
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('¿Este lunes no hay partido? La convocatoria pasará al siguiente lunes (el turno NO cambia).'))
                  posponerJornada(siguienteJornada(fecha))
              }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
              title="Mueve la fecha al siguiente lunes. No altera la cola de turnos."
            >
              Este lunes no hay partido
            </button>
          </div>
        )}
      </div>

      {/* 2) Turno rotativo */}
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-slate-200">
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_2px] shadow-red-500/70" />
          La siguiente alineación es de...
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
            ... y la próxima es de... <b className="text-slate-300">{next.nombre}</b>
          </span>
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

      {/* 3) Convocatoria — o, si ya hay alineación confirmada, la alineación (sustituye
            a la convocatoria; el campo y "juegas de blanco/rojo" lo da ConfirmedLineupView). */}
      {pendingLineup ? (
        <div className="border-t border-emerald-500/30 pt-3">
          <ConfirmedLineupView lineup={pendingLineup} />
        </div>
      ) : (
      <div className="flex flex-col gap-2 border-t border-emerald-500/30 pt-3">
        <span className="flex flex-wrap items-center gap-x-2 text-slate-200">
          📝 <b>Convocatoria</b>
        </span>

        {!abierta ? (
          <span className="text-sm text-slate-400">
            La convocatoria se abre el <b>domingo a las 12:00</b>. ¡Atento!
          </span>
        ) : isLinked ? (
          <div className="flex flex-wrap items-center gap-2">
            {!soyReserva && (
              <button
                onClick={() => apuntar('in')}
                className={
                  'rounded px-3 py-1.5 text-sm font-medium transition-colors ' +
                  (miEstado === 'in'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-emerald-600 text-emerald-300 hover:bg-emerald-600/10')
                }
              >
                {miEstado === 'in' ? '✓ Apuntado' : 'Me apunto'}
              </button>
            )}
            <button
              onClick={() => apuntar('maybe')}
              className={
                'rounded px-3 py-1.5 text-sm font-medium transition-colors ' +
                (miEstado === 'maybe'
                  ? 'bg-amber-600 text-white'
                  : 'border border-amber-600 text-amber-300 hover:bg-amber-600/10')
              }
            >
              {miEstado === 'maybe' ? '✓ Si falta gente' : 'Si falta gente voy'}
            </button>
            {/* "No voy esta semana": toggle propio (se resalta con ✕). NO te mete en la
                convocatoria, así que no se convierte en "Me borro"; puedes apuntarte luego. */}
            <button
              onClick={() => (miEstado === 'out' ? desapuntar() : apuntar('out'))}
              className={
                'rounded px-3 py-1.5 text-sm font-medium transition-colors ' +
                (miEstado === 'out'
                  ? 'bg-slate-600 text-white'
                  : 'border border-slate-500 text-slate-300 hover:bg-slate-600/20')
              }
            >
              {miEstado === 'out' ? '✕ No voy esta semana' : 'No voy esta semana'}
            </button>
            {/* "Me borro": solo cuando te has apuntado a jugar (titular o reserva). */}
            {(miEstado === 'in' || miEstado === 'maybe') && (
              <button
                onClick={desapuntar}
                className="rounded border border-red-600 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-600/10"
              >
                Me borro
              </button>
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-400">
            El admin debe emparejarte con tu jugador para que puedas apuntarte.
          </span>
        )}

        {/* Contadores + listado provisional de convocados y reservas (visible a todos).
            El número va encima; la cabecera de cada lista solo aparece si tiene gente. */}
        {(titulares.length > 0 || reservas.length > 0 || noVienen.length > 0) && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-slate-400">
              {titulares.length} apuntado{titulares.length === 1 ? '' : 's'}
              {reservas.length > 0 && ` · ${reservas.length} de reserva`}
              {noVienen.length > 0 && ` · ${noVienen.length} baja${noVienen.length === 1 ? '' : 's'}`}
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              <ListaConvocatoria titulo="Convocados" color="text-emerald-400" items={titulares} nombreDe={nombreDe} />
              <ListaConvocatoria titulo="Reservas" color="text-amber-400" items={reservas} nombreDe={nombreDe} />
              <ListaConvocatoria titulo="Bajas" color="text-red-400" items={noVienen} nombreDe={nombreDe} />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Aviso del plazo de re-evaluación de valoraciones (lo abre el admin). */}
      {ratingsOpen && isLinked && (
        <div className="rounded-md border border-sky-500/50 bg-sky-900/30 px-3 py-2 text-sm text-sky-200">
          📝 <b>Plazo de reevaluación abierto:</b> puedes revisar y ajustar tus valoraciones en la
          pestaña «Valorar» mientras esté activo.
        </div>
      )}
    </div>
  )
}

/** Lista numerada de convocados o reservas (orden de llegada). Vacía → no renderiza nada. */
function ListaConvocatoria({
  titulo,
  color,
  items,
  nombreDe,
}: {
  titulo: string
  color: string
  items: SignupRow[]
  nombreDe: (id: string) => string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>
        {titulo} ({items.length})
      </span>
      <ol className="mt-1 flex flex-col gap-0.5 text-sm text-slate-200">
        {items.map((s, i) => (
          <li key={s.player_id} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-slate-500">{i + 1}.</span>
            <span className="truncate">{nombreDe(s.player_id)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
