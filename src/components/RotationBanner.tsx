import { useState } from 'react'
import { useTurno } from '../hooks/useTurno'
import { useConvocatoria } from '../hooks/useConvocatoria'
import { useAuthStore } from '../store/authStore'
import { usePlayersStore } from '../store/playersStore'
import { useRotationStore } from '../store/rotationStore'
import { useRatingsWindow } from '../hooks/useRatingsWindow'
import { useRatingsStore } from '../store/ratingsStore'
import { useConvocatoriaStore } from '../store/convocatoriaStore'
import { useLineupsStore } from '../store/lineupsStore'
import { ConfirmedLineupView } from './ConfirmedLineupView'
import {
  formatoFecha,
  siguienteJornada,
  partidoPasado,
  nombreDia,
  nombresDias,
  ordenarDias,
  aperturaConvocatoria,
} from '../domain/matchday'
import { nombreVisible } from '../domain/types'
import type { SignupStatus } from '../lib/convocatoriaApi'
import type { PlayerInput } from '../store/playersStore'

/**
 * Banner de turno + convocatoria, visible para todos. Contiene, en este orden:
 *  1. La fecha del próximo partido (+ día fijo de la semana y botón admin
 *     "esta semana no hay partido").
 *  2. A quién le toca hacer la alineación (turno rotativo) y sus acciones.
 *  3. La cabecera "Convocatoria" con los botones para apuntarse (desde el día
 *     antes del partido, a las 12:00).
 */
export function RotationBanner() {
  const { current, next, isMyTurn, congelado, currentColaId } = useTurno()
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
  const matchWeekdays = useRotationStore((s) => s.matchWeekdays)
  const fijarDiasSemana = useRotationStore((s) => s.fijarDiasSemana)
  const { abierto: ratingsOpen, deadline: ratingsDeadline } = useRatingsWindow()
  const profile = useAuthStore((s) => s.profile)
  const progress = useRatingsStore((s) => s.progress)
  const [fechaEdit, setFechaEdit] = useState('')

  const { fecha, abierta, titulares, reservas, noVienen, miEstado } = useConvocatoria()
  const apuntarse = useConvocatoriaStore((s) => s.apuntarse)
  const borrarse = useConvocatoriaStore((s) => s.borrarse)
  const lineups = useLineupsStore((s) => s.lineups)

  // Fijos (plantel activo, ni invitados ni reservas) que aún no han dicho nada esta jornada.
  const contestados = new Set([...titulares, ...reservas, ...noVienen].map((s) => s.player_id))
  const sinContestar = players
    .filter((p) => p.activo && !p.invitado && !p.reserva && !contestados.has(p.id))
    .sort((a, b) => nombreVisible(a).localeCompare(nombreVisible(b)))
    .map((p) => p.id)

  // Alineación de la jornada en curso. Se sigue mostrando aunque ya se haya registrado
  // el resultado (el partido es hoy): así no reaparece la convocatoria de una jornada
  // ya jugada. Caduca al día siguiente del partido, que es cuando vuelve la convocatoria
  // (y cuando se anuncia el relevo del turno).
  const pendingLineup = lineups
    .filter((l) => !partidoPasado(l.fecha))
    .sort((a, b) => b.fecha - a.fecha)[0]

  // Mi progreso de valoraciones (mismo recuento que ve el admin en «Usuarios»).
  const miProgreso = myPlayerId ? progress.get(myPlayerId) : undefined
  const miProgresoCompleto = !!miProgreso && miProgreso.total > 0 && miProgreso.valorados >= miProgreso.total
  const yaFinalice = profile?.ratingsFinalized ?? false

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
      if (value && isMyTurn) await pasarTurno(yo.id)
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

  // Marca/desmarca un día de partido. Siempre queda al menos uno.
  const alternarDiaSemana = async (dow: number) => {
    const dias = matchWeekdays.includes(dow)
      ? matchWeekdays.filter((d) => d !== dow)
      : [...matchWeekdays, dow]
    if (dias.length === 0) return
    try {
      await fijarDiasSemana(ordenarDias(dias))
    } catch {
      alert('No se pudo cambiar el día de partido.')
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
            {/* Días fijos de la semana: lo que se juega TODAS las semanas (uno o
                varios). Va aparte de la fecha suelta de abajo, que es un override de
                un solo partido. */}
            <div
              className="flex items-center gap-1 text-xs text-slate-400"
              title="Días de la semana en que se juega. No altera la cola de turnos."
            >
              Días de partido:
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                const on = matchWeekdays.includes(dow)
                return (
                  <button
                    key={dow}
                    onClick={() => alternarDiaSemana(dow)}
                    title={nombreDia(dow)}
                    className={
                      'h-6 w-6 rounded border text-xs font-medium uppercase ' +
                      (on
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-400')
                    }
                  >
                    {dow === 3 ? 'x' : nombreDia(dow)[0]}
                  </button>
                )
              })}
            </div>
            <input
              type="date"
              value={fechaEdit || fecha}
              onChange={(e) => setFechaEdit(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
              title="Fija la fecha de UN partido suelto (p.ej. moverlo un día esa semana)."
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
                title={`Vuelve a la fecha automática (el ${nombresDias(matchWeekdays)} que toque).`}
              >
                Volver a automático
              </button>
            )}
            <button
              onClick={() => {
                const siguiente = siguienteJornada(fecha, matchWeekdays)
                if (
                  confirm(
                    `¿Este partido no se juega? La convocatoria pasará al ${formatoFecha(siguiente)} (el turno NO cambia).`,
                  )
                )
                  posponerJornada(siguiente)
              }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
              title="Pasa la convocatoria al siguiente día de partido. No altera la cola de turnos."
            >
              Este partido no se juega
            </button>
          </div>
        )}
      </div>

      {/* 2) Turno rotativo */}
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-slate-200">
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_2px] shadow-red-500/70" />
          {congelado ? 'La alineación de esta jornada es de...' : 'La siguiente alineación es de...'}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-5">
          <b className="text-xl text-red-400">{current ? current.nombre : '— sin asignar —'}</b>
          {isMyTurn && !congelado && (
            <span className="animate-pulse font-semibold text-emerald-300">
              ¡te toca! Ve a “Equipos”.
            </span>
          )}

          {/* Acción junto al nombre: pasar/avanzar el turno. Mientras el turno está
              congelado (alineación de la jornada ya hecha) no hay nada que pasar:
              el relevo se anuncia al día siguiente del partido. */}
          {isMyTurn && !congelado && (
            <button
              onClick={() => {
                if (confirm('¿No puedes hacerla esta semana? Pasa el turno al siguiente.'))
                  pasarTurno(currentColaId)
              }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
            >
              No puedo → pasar turno
            </button>
          )}
          {isAdmin && !congelado && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `¿Avanzar el turno? Pasará de ${current?.nombre ?? '—'} al siguiente${next ? ` (${next.nombre})` : ''}.`,
                  )
                )
                  pasarTurno(currentColaId)
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
            La convocatoria se abre el{' '}
            <b>{nombreDia(aperturaConvocatoria(fecha).getDay())} a las 12:00</b> (el día antes del
            partido). ¡Atento!
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
        {abierta &&
          (titulares.length > 0 || reservas.length > 0 || noVienen.length > 0 || sinContestar.length > 0) && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-slate-400">
              {titulares.length} apuntado{titulares.length === 1 ? '' : 's'}
              {reservas.length > 0 && ` · ${reservas.length} de reserva`}
              {noVienen.length > 0 && ` · ${noVienen.length} baja${noVienen.length === 1 ? '' : 's'}`}
              {sinContestar.length > 0 && ` · ${sinContestar.length} sin contestar`}
            </span>
            {/* flex-wrap y no grid: en rejilla la fila de Convocados (13) estiraba la
                altura y dejaba muy separadas las listas cortas de debajo. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-10">
              <ListaConvocatoria titulo="Convocados" color="text-emerald-400" ids={titulares.map((s) => s.player_id)} nombreDe={nombreDe} />
              <ListaConvocatoria titulo="Reservas" color="text-amber-400" ids={reservas.map((s) => s.player_id)} nombreDe={nombreDe} />
              <ListaConvocatoria titulo="Bajas" color="text-red-400" ids={noVienen.map((s) => s.player_id)} nombreDe={nombreDe} />
              <ListaConvocatoria titulo="Sin contestar" color="text-slate-400" ids={sinContestar} nombreDe={nombreDe} />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Aviso del plazo de re-evaluación de valoraciones.
          Se ve en dos casos: con el plazo GLOBAL abierto (lo abre el admin para
          todos, y desaparece solo al vencer la fecha límite), o con el plazo
          abierto solo para mí — que es lo que hace el botón "Reabrir" del menú
          Usuarios: dejar mis valoraciones sin finalizar. Al cerrarlas (yo con
          «Finalizar» o el admin con «Cerrar») el aviso se va. */}
      {isLinked && (ratingsOpen || !yaFinalice) && (
        <div className="rounded-md border border-sky-500/50 bg-sky-900/30 px-3 py-2 text-sm text-sky-200">
          📝{' '}
          <b>
            {ratingsOpen
              ? `Plazo de reevaluación abierto${ratingsDeadline ? ` hasta el ${formatoFecha(ratingsDeadline)}` : ''}:`
              : 'Tienes las valoraciones sin finalizar:'}
          </b>{' '}
          revisa tus valoraciones en «Valorar» y pulsa <b>Finalizar</b> al acabar.
          {miProgreso && miProgreso.total > 0 && (
            <div className="mt-1">
              Llevas{' '}
              <b className={miProgresoCompleto ? 'text-emerald-300' : 'text-amber-300'}>
                {miProgreso.valorados}/{miProgreso.total}
              </b>{' '}
              jugadores valorados{miProgresoCompleto ? ' — solo te falta pulsar Finalizar.' : '.'}
            </div>
          )}
          <div className="mt-1 text-amber-300">
            ⚠️ Quien no las tenga puestas al cerrarse el plazo se queda fuera de la cola para hacer
            las alineaciones.
          </div>
        </div>
      )}
    </div>
  )
}

/** Lista numerada de jugadores (los apuntes, por orden de llegada). Vacía → no renderiza nada. */
function ListaConvocatoria({
  titulo,
  color,
  ids,
  nombreDe,
}: {
  titulo: string
  color: string
  ids: string[]
  nombreDe: (id: string) => string
}) {
  if (ids.length === 0) return null
  return (
    <div>
      <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>
        {titulo} ({ids.length})
      </span>
      <ol className="mt-1 flex flex-col gap-0.5 text-sm text-slate-200">
        {ids.map((id, i) => (
          <li key={id} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-slate-500">{i + 1}.</span>
            <span className="truncate">{nombreDe(id)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
