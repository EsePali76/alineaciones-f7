import { useEffect, useMemo, useRef, useState } from 'react'
import { toBlob, toPng } from 'html-to-image'
import { useLineupsStore } from '../store/lineupsStore'
import { useGeneratorStore } from '../store/generatorStore'
import { useAuthStore } from '../store/authStore'
import { useEffectivePlayers } from '../hooks/useEffectivePlayers'
import { useTurno } from '../hooks/useTurno'
import { useConvocatoria } from '../hooks/useConvocatoria'
import type { Player } from '../domain/types'
import { fotoVisible, nombreVisible } from '../domain/types'
import { balanceTeams, evaluatePartition, type TeamBalance } from '../domain/balancer'
import { playerScore } from '../domain/scoring'
import { formacionesDe, formacionPorNombre, type Formacion } from '../domain/formation'
import { parseISO, partidoPasado } from '../domain/matchday'
import { FieldView, ordenAutomatico } from './FieldView'
import { TocadoIcon } from './TocadoIcon'
import { Avatar } from './Avatar'
import { QuickGuestForm } from './QuickGuestForm'
import { usePlayersStore, type PlayerInput } from '../store/playersStore'
import { useConvocatoriaStore } from '../store/convocatoriaStore'

export function TeamGenerator() {
  const players = useEffectivePlayers()
  const lineups = useLineupsStore((s) => s.lineups)
  const lineupsLoaded = useLineupsStore((s) => s.loaded)
  const addLineup = useLineupsStore((s) => s.addLineup)
  const removeLineup = useLineupsStore((s) => s.removeLineup)
  const { current: turnoActual, isMyTurn } = useTurno()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)

  // Estado de la sesión de generación en store persistente (sobrevive a cambios de pestaña).
  const convocadosIds = useGeneratorStore((s) => s.convocados)
  const jugadoresPorEquipo = useGeneratorStore((s) => s.jugadoresPorEquipo)
  const formacionNombreA = useGeneratorStore((s) => s.formacionNombreA)
  const formacionNombreB = useGeneratorStore((s) => s.formacionNombreB)
  const balance = useGeneratorStore((s) => s.balance)
  const confirmada = useGeneratorStore((s) => s.confirmada)
  const confirmedLineupId = useGeneratorStore((s) => s.confirmedLineupId)
  const setConfirmedLineupId = useGeneratorStore((s) => s.setConfirmedLineupId)
  const updateLineupTeams = useLineupsStore((s) => s.updateLineupTeams)
  const puedeConfirmar = isMyTurn || isAdmin
  const setConvocados = useGeneratorStore((s) => s.setConvocados)
  const setJugadoresPorEquipo = useGeneratorStore((s) => s.setJugadoresPorEquipo)
  const setFormacionNombreA = useGeneratorStore((s) => s.setFormacionNombreA)
  const setFormacionNombreB = useGeneratorStore((s) => s.setFormacionNombreB)
  const placementA = useGeneratorStore((s) => s.placementA)
  const placementB = useGeneratorStore((s) => s.placementB)
  const setPlacementA = useGeneratorStore((s) => s.setPlacementA)
  const setPlacementB = useGeneratorStore((s) => s.setPlacementB)
  const setBalance = useGeneratorStore((s) => s.setBalance)
  const setConfirmada = useGeneratorStore((s) => s.setConfirmada)
  const syncConvocatoria = useGeneratorStore((s) => s.syncConvocatoria)
  const loadConfirmed = useGeneratorStore((s) => s.loadConfirmed)
  const substitute = useGeneratorStore((s) => s.substitute)
  const reset = useGeneratorStore((s) => s.reset)
  // Jugador marcado como "sale" en la rejilla inteligente (sustitución in-place).
  const [salienteId, setSalienteId] = useState<string | null>(null)
  const addPlayer = usePlayersStore((s) => s.addPlayer)
  // Para que un convocado añadido a mano se vea en el banner (lista compartida), se le
  // apunta a la convocatoria ('in'); al quitarlo de los titulares, se le saca de ella.
  const apuntarse = useConvocatoriaStore((s) => s.apuntarse)
  const borrarse = useConvocatoriaStore((s) => s.borrarse)

  // Convocatoria compartida: la gente se apunta desde el banner; aquí se ve la lista
  // y pre-rellena los convocados en vivo (diff incremental, conserva ajustes a mano).
  const { fecha, noVienen, titularIds, reservaIds } = useConvocatoria()
  // Apuntados como titulares ('Me apunto' o convocados a mano): ya salen en el banner.
  const titularSet = useMemo(() => new Set(titularIds), [titularIds])

  // Alta rápida de un invitado puntual desde aquí: se da de alta, se autoconvoca y se
  // apunta a la convocatoria para que aparezca en el banner como convocado.
  const añadirPuntual = async (input: PlayerInput) => {
    const id = await addPlayer(input)
    if (!id) return
    setConvocados([...convocadosIds, id])
    try {
      await apuntarse(id, 'in', fecha)
    } catch {
      // Sin permisos para apuntar a otros (RLS): queda seleccionado solo en local.
    }
  }

  // Cierre de partido: se limpia todo (formato, formaciones, convocados y la gráfica)
  // para empezar la siguiente de cero cuando la alineación que teníamos en marcha ya
  // no es la pendiente de la semana, es decir cuando:
  //   a) ya tiene resultado (se registró tras jugarse), o
  //   b) su día de partido ya ha pasado (al día siguiente), aunque no se registrara
  //      resultado, o
  //   c) ya no existe en el backend (se borró, o el resultado se metió en OTRA
  //      alineación duplicada con distinto id → la que teníamos cargada quedó huérfana).
  // Se espera a que los lineups estén CARGADOS para no resetear durante el arranque
  // (cuando la lista aún está vacía). Cada dispositivo se autolimpia solo.
  useEffect(() => {
    if (!confirmedLineupId || !lineupsLoaded) return
    const lu = lineups.find((l) => l.id === confirmedLineupId)
    if (!lu || lu.resultado || partidoPasado(lu.fecha)) reset()
  }, [confirmedLineupId, lineups, lineupsLoaded, reset])

  // Pre-relleno en vivo: cada vez que cambia la lista de apuntados (o la jornada),
  // siembra los convocados con los titulares ('Me apunto'). El diff incremental del
  // store respeta los retoques manuales del del turno.
  // OJO: con una alineación en curso (generada/cargada) los convocados quedan
  // CONGELADOS (= los de la alineación). Los cambios en la convocatoria NO deben
  // tocarlos, para no invalidar la alineación; una baja se resuelve sustituyendo.
  const titularKey = titularIds.join(',')
  useEffect(() => {
    if (balance) return
    syncConvocatoria(titularIds, fecha)
    // titularKey resume la lista de ids; evita re-sincronizar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titularKey, fecha, balance])

  const disponibles = useMemo(
    () => players.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [players],
  )
  const convocados = useMemo(() => new Set(convocadosIds), [convocadosIds])

  // (Antes había aquí un efecto de "baja de última hora" que BORRABA la alineación
  // confirmada al quitar a un convocado. Se ha eliminado: ahora una baja se resuelve
  // sustituyendo in-place en la rejilla, sin perder la alineación. Los convocados
  // quedan congelados mientras hay una alineación en curso, así que este caso ya no
  // ocurre por la vía de la convocatoria.)

  // Alineación confirmada de la semana (compartida, sin resultado aún). Vive en el
  // backend; su balance/placement NO está en el localStorage de otros dispositivos.
  // Se excluyen las de partidos ya pasados: no deben auto-cargarse (a juego con el
  // banner, que también las caduca al día siguiente).
  const pendingLineup = useMemo(
    () =>
      [...lineups]
        .filter((l) => !l.resultado && !partidoPasado(l.fecha))
        .sort((a, b) => b.fecha - a.fecha)[0],
    [lineups],
  )

  // Auto-carga: SOLO si ya existe una alineación confirmada y el editor está vacío
  // (balance null) y no la tengo ya cargada. Reconstruye el balance desde los ids +
  // jugadores actuales para que el admin/autor pueda retocarla aunque la generase otro.
  useEffect(() => {
    if (!pendingLineup) return
    if (balance) return // no pisar lo que ya estás editando o generando
    if (confirmedLineupId === pendingLineup.id) return // ya cargada / es la mía
    const byId = new Map(players.map((p) => [p.id, p]))
    const teamA = pendingLineup.teamA.map((id) => byId.get(id)).filter((p): p is Player => !!p)
    const teamB = pendingLineup.teamB.map((id) => byId.get(id)).filter((p): p is Player => !!p)
    // Si falta algún jugador (borrado/inactivo) no se puede reconstruir con fiabilidad.
    if (teamA.length !== pendingLineup.teamA.length || teamB.length !== pendingLineup.teamB.length)
      return
    const por = teamA.length
    if (por !== 6 && por !== 7 && por !== 8) return
    loadConfirmed({
      convocados: [...pendingLineup.teamA, ...pendingLineup.teamB],
      jugadoresPorEquipo: por,
      formacionNombreA: pendingLineup.formacionA ?? formacionNombreA,
      formacionNombreB: pendingLineup.formacionB ?? formacionNombreB,
      placementA: pendingLineup.placementA ?? null,
      placementB: pendingLineup.placementB ?? null,
      balance: evaluatePartition(teamA, teamB, { history: lineups }),
      confirmedLineupId: pendingLineup.id,
      convocatoriaDate: fecha,
      lastSyncedSignupIds: titularIds,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLineup, balance, confirmedLineupId, players, fecha])

  // Apuntados por la app (titulares + reservas). Al del turno (no admin) NO se le deja
  // sacar a un apuntado de la convocatoria; eso solo lo puede hacer el admin.
  const apuntadosIds = useMemo(
    () => new Set([...titularIds, ...reservaIds]),
    [titularIds, reservaIds],
  )
  const bloqueados = useMemo(
    () => (isAdmin ? new Set<string>() : apuntadosIds),
    [isAdmin, apuntadosIds],
  )
  // Quienes han marcado "No voy esta semana": se deshabilitan en el grid de selección.
  const noVienenIds = useMemo(() => new Set(noVienen.map((s) => s.player_id)), [noVienen])
  // Se muestran en dos grupos con cabecera (plantel / invitados) en vez de marcar al
  // invitado con un asterisco: así se ve claro quién es de fuera del grupo.
  const delPlantel = useMemo(() => disponibles.filter((p) => !p.invitado), [disponibles])
  const invitados = useMemo(() => disponibles.filter((p) => p.invitado), [disponibles])

  const formaciones = formacionesDe(jugadoresPorEquipo)
  const formacionA = formacionPorNombre(jugadoresPorEquipo, formacionNombreA) ?? formaciones[0]
  const formacionB = formacionPorNombre(jugadoresPorEquipo, formacionNombreB) ?? formaciones[0]

  // Al cambiar de formato, ajusta las formaciones a unas válidas y descarta la colocación manual.
  const cambiarFormato = (n: 6 | 7 | 8) => {
    setJugadoresPorEquipo(n)
    const lista = formacionesDe(n)
    if (!lista.some((f) => f.nombre === formacionNombreA)) setFormacionNombreA(lista[0].nombre)
    if (!lista.some((f) => f.nombre === formacionNombreB)) setFormacionNombreB(lista[0].nombre)
    setPlacementA(null)
    setPlacementB(null)
  }

  // Cambiar la formación de un equipo descarta su colocación manual (los puestos cambian).
  const cambiarFormacionA = (nombre: string) => {
    setFormacionNombreA(nombre)
    setPlacementA(null)
  }
  const cambiarFormacionB = (nombre: string) => {
    setFormacionNombreB(nombre)
    setPlacementB(null)
  }

  // Refresca la alineación generada con los datos ACTUALES de los jugadores (por id),
  // para que editar un jugador (quitar "tocado", renombrar…) se vea sin regenerar.
  const balanceVivo = useMemo(() => {
    if (!balance) return null
    const porId = new Map(players.map((p) => [p.id, p]))
    const teamA = balance.teamA.map((p) => porId.get(p.id) ?? p)
    const teamB = balance.teamB.map((p) => porId.get(p.id) ?? p)
    const re = evaluatePartition(teamA, teamB, { history: lineups })
    return { ...re, method: balance.method, evaluated: balance.evaluated }
  }, [balance, players, lineups])

  // Sustitución in-place: el jugador `inId` entra por `outId` conservando su puesto.
  // Recalcula el balance y fija los placements para que el sustituto ocupe el hueco.
  const hacerSustitucion = (outId: string, inId: string) => {
    if (!balanceVivo) return
    const inPlayer = players.find((p) => p.id === inId)
    if (!inPlayer) return
    const enA = balanceVivo.teamA.some((p) => p.id === outId)
    const teamA = balanceVivo.teamA.map((p) => (p.id === outId ? inPlayer : p))
    const teamB = balanceVivo.teamB.map((p) => (p.id === outId ? inPlayer : p))
    const nuevo = evaluatePartition(teamA, teamB, { history: lineups })
    // Congela el orden actual y cambia solo el id que sale por el que entra, para que
    // el sustituto quede EXACTAMENTE en el puesto del que se va (misma banda/posición).
    const curPlA = placementA ?? ordenAutomatico(balanceVivo.teamA, 'A', formacionA)
    const curPlB = placementB ?? ordenAutomatico(balanceVivo.teamB, 'B', formacionB)
    const newPlA = enA ? curPlA.map((x) => (x === outId ? inId : x)) : curPlA
    const newPlB = enA ? curPlB : curPlB.map((x) => (x === outId ? inId : x))
    substitute({
      balance: { ...nuevo, method: 'manual', evaluated: 0 },
      placementA: newPlA,
      placementB: newPlB,
      convocados: [...convocadosIds.filter((i) => i !== outId), inId],
    })
  }

  const toggle = async (id: string) => {
    // Rejilla inteligente: si ya hay una alineación generada, la rejilla sirve para
    // SUSTITUIR (baja de última hora) sin regenerar ni perder posiciones. Se toca al
    // que sale (queda marcado) y luego al que entra, y ocupa su hueco.
    if (balance) {
      const enLineup = [...balance.teamA, ...balance.teamB].some((p) => p.id === id)
      if (enLineup) {
        setSalienteId((prev) => (prev === id ? null : id)) // marca/desmarca al saliente
        return
      }
      // Toca a alguien de fuera del campo: si hay saliente elegido, hace la sustitución.
      if (salienteId) {
        hacerSustitucion(salienteId, id)
        setSalienteId(null)
      }
      return
    }

    const next = new Set(convocados)
    if (next.has(id)) {
      // Solo el admin puede sacar de la convocatoria a quien se haya apuntado por la app.
      if (bloqueados.has(id)) return
      next.delete(id)
      setConvocados([...next])
      // Si estaba como titular en la convocatoria, se le saca también del banner.
      if (titularSet.has(id)) {
        try {
          await borrarse(id)
        } catch {
          /* el store revierte y avisa */
        }
      }
    } else {
      next.add(id)
      setConvocados([...next])
      // Convocar a mano → apuntar 'in' para que se vea en el banner (si no era ya titular).
      if (!titularSet.has(id)) {
        try {
          await apuntarse(id, 'in', fecha)
        } catch {
          // Sin permisos para apuntar a otros (RLS): queda seleccionado solo en local.
        }
      }
    }
  }

  const seleccionados = disponibles.filter((p) => convocados.has(p.id))
  const nConvocados = seleccionados.length
  const objetivo = jugadoresPorEquipo * 2 // 14 (7v7) o 16 (8v8)
  const faltan = objetivo - nConvocados
  const completo = faltan === 0

  // Añade reservas (por orden de llegada) a los convocados hasta llegar al objetivo.
  const completarConReservas = () => {
    const huecos = objetivo - nConvocados
    if (huecos <= 0) return
    const add = reservaIds.filter((id) => !convocados.has(id)).slice(0, huecos)
    if (add.length) setConvocados([...convocadosIds, ...add])
  }
  const reservasDisponibles = reservaIds.filter((id) => !convocados.has(id)).length

  const generar = () => {
    // Pasa el historial de alineaciones confirmadas para evitar repetir parejas.
    const result = balanceTeams(seleccionados, { history: lineups })
    setBalance(result)
    setConfirmada(false)
    setConfirmedLineupId(null) // nueva alineación → ya no re-confirma la anterior
    // Nueva alineación → descarta cualquier colocación manual previa.
    setPlacementA(null)
    setPlacementB(null)
    setSalienteId(null)
  }

  const confirmar = async () => {
    if (!balanceVivo) return
    const teamAids = balanceVivo.teamA.map((p) => p.id)
    const teamBids = balanceVivo.teamB.map((p) => p.id)
    // Congela la colocación: si no se han movido fichas, guarda el orden AUTOMÁTICO
    // actual para que el historial reproduzca el campo idéntico aunque luego cambien
    // las valoraciones de los jugadores.
    const meta = {
      formacionA: formacionNombreA,
      formacionB: formacionNombreB,
      placementA: placementA ?? ordenAutomatico(balanceVivo.teamA, 'A', formacionA),
      placementB: placementB ?? ordenAutomatico(balanceVivo.teamB, 'B', formacionB),
    }
    // Solo se actualiza si el partido referenciado SIGUE existiendo; si se borró del
    // historial, el id quedó huérfano → hay que crear uno nuevo (si no, no pasaría nada).
    const existe = !!confirmedLineupId && lineups.some((l) => l.id === confirmedLineupId)
    if (existe) {
      // Re-confirmar: actualiza la misma alineación (el autor puede editar y reconfirmar).
      await updateLineupTeams(confirmedLineupId!, teamAids, teamBids, meta)
    } else {
      const madeBy = turnoActual?.id ?? myPlayerId ?? undefined
      // La alineación se fecha con el DÍA DEL PARTIDO (no el instante de confirmar),
      // así en "Partidos" aparece con su fecha real aunque se confirme otro día. Se
      // usa mediodía local, igual que el editor de fecha del historial.
      const diaPartido = parseISO(fecha)
      diaPartido.setHours(12, 0, 0, 0)
      const id = await addLineup(teamAids, teamBids, { ...meta, madeBy }, diaPartido.getTime())
      setConfirmedLineupId(id)
      // No se avanza el turno aquí: el autor sigue siendo el del turno y puede editar y
      // re-confirmar. El turno avanza cuando el admin registra el resultado del partido.
    }
    setConfirmada(true)
  }

  // Deshacer la confirmación: borra la alineación del historial (el banner vuelve a la
  // convocatoria) y resetea la generación CONSERVANDO los convocados, para rehacerla.
  const cancelarConfirmada = async () => {
    if (confirmedLineupId && lineups.some((l) => l.id === confirmedLineupId && !l.resultado)) {
      await removeLineup(confirmedLineupId)
    }
    setConfirmedLineupId(null)
    setConfirmada(false)
    setBalance(null)
    setPlacementA(null)
    setPlacementB(null)
    setSalienteId(null)
  }

  // Cambia dos jugadores de equipo (arrastrando entre bandos), sin confirmación.
  const handleCrossSwap = (id1: string, id2: string) => {
    if (!balanceVivo) return
    const enA = balanceVivo.teamA.some((p) => p.id === id1) ? id1 : id2
    const enB = enA === id1 ? id2 : id1
    const pA = balanceVivo.teamA.find((p) => p.id === enA)
    const pB = balanceVivo.teamB.find((p) => p.id === enB)
    if (!pA || !pB) return

    const nuevoA = balanceVivo.teamA.map((p) => (p.id === enA ? pB : p))
    const nuevoB = balanceVivo.teamB.map((p) => (p.id === enB ? pA : p))
    const nuevo = evaluatePartition(nuevoA, nuevoB, { history: lineups })
    setBalance({ ...nuevo, method: 'manual', evaluated: 0 })
    setPlacementA(null)
    setPlacementB(null)
    setConfirmada(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Selección de convocados */}
      <section className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Convocados de esta semana</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className={completo ? 'text-emerald-400' : 'text-slate-400'}>
              {nConvocados} / {objetivo} seleccionados
            </span>
            {reservaIds.length > 0 && (
              <button
                onClick={completarConReservas}
                disabled={faltan <= 0 || reservasDisponibles === 0}
                className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white enabled:hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                title="Añade reservas por orden de llegada hasta completar el formato"
              >
                Completar con reservas
              </button>
            )}
          </div>
        </div>

        {/* Selector de formato */}
        <div className="flex items-center gap-2 text-sm">
          <span className="w-20 text-slate-400">Formato:</span>
          {([6, 7, 8] as const).map((n) => (
            <button
              key={n}
              onClick={() => cambiarFormato(n)}
              className={
                'rounded border px-3 py-1 transition-colors ' +
                (jugadoresPorEquipo === n
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
              }
            >
              {n} vs {n} <span className="opacity-70">({n * 2})</span>
            </button>
          ))}
        </div>

        {/* Selectores de formación por equipo */}
        <FormacionSelector
          label="Formación A"
          labelClass="text-slate-200"
          formaciones={formaciones}
          seleccionada={formacionA.nombre}
          onSelect={cambiarFormacionA}
        />
        <FormacionSelector
          label="Formación B"
          labelClass="text-red-400"
          formaciones={formaciones}
          seleccionada={formacionB.nombre}
          onSelect={cambiarFormacionB}
        />

        {/* Rejilla inteligente: al marcar a un saliente, la rejilla pasa a sustituir
            sin regenerar ni perder posiciones. */}
        {salienteId && (
          <p className="rounded-md border border-amber-500/50 bg-amber-900/25 px-3 py-2 text-sm text-amber-100">
            🔁 Sale <b>{nombreVisible(players.find((p) => p.id === salienteId)!)}</b> — toca en la
            rejilla a quién entra.{' '}
            <button
              onClick={() => setSalienteId(null)}
              className="ml-1 rounded border border-amber-400/60 px-2 py-0.5 text-xs hover:bg-amber-500/20"
            >
              Cancelar
            </button>
          </p>
        )}

        {disponibles.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay jugadores activos. Da de alta el plantel en la pestaña «Plantel».
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <GrupoConvocados
              titulo="Plantel"
              jugadores={delPlantel}
              convocados={convocados}
              bloqueados={bloqueados}
              deshabilitados={noVienenIds}
              onToggle={toggle}
              salienteId={salienteId}
            />
            {invitados.length > 0 && (
              <GrupoConvocados
                titulo="Invitados"
                jugadores={invitados}
                convocados={convocados}
                bloqueados={bloqueados}
                deshabilitados={noVienenIds}
                onToggle={toggle}
                salienteId={salienteId}
              />
            )}
          </div>
        )}

        <QuickGuestForm onAdd={añadirPuntual} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generar}
            disabled={!completo}
            className="rounded bg-emerald-600 px-4 py-2 font-medium text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generar equipos ({jugadoresPorEquipo} vs {jugadoresPorEquipo})
          </button>
          {!completo && (
            <span className="text-sm text-amber-400">
              {faltan > 0
                ? `Faltan ${faltan} para el formato ${jugadoresPorEquipo} vs ${jugadoresPorEquipo}.`
                : `Sobran ${-faltan} para el formato ${jugadoresPorEquipo} vs ${jugadoresPorEquipo}.`}
            </span>
          )}
        </div>
      </section>

      {/* Resultado */}
      {balanceVivo && (
        <BalanceResult
          balance={balanceVivo}
          formacionA={formacionA}
          formacionB={formacionB}
          onConfirm={confirmar}
          onCancelConfirm={cancelarConfirmada}
          confirmada={confirmada}
          canConfirm={puedeConfirmar}
          onCrossSwap={handleCrossSwap}
        />
      )}
    </div>
  )
}

function FormacionSelector({
  label,
  labelClass,
  formaciones,
  seleccionada,
  onSelect,
}: {
  label: string
  labelClass: string
  formaciones: Formacion[]
  seleccionada: string
  onSelect: (nombre: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`w-24 font-medium ${labelClass}`}>{label}:</span>
      {formaciones.map((f) => (
        <button
          key={f.nombre}
          onClick={() => onSelect(f.nombre)}
          className={
            'rounded border px-3 py-1 transition-colors ' +
            (seleccionada === f.nombre
              ? 'border-emerald-500 bg-emerald-600 text-white'
              : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
          }
        >
          {f.nombre}
        </button>
      ))}
    </div>
  )
}

/** Grupo de convocables (plantel o invitados) con su cabecera y rejilla de botones. */
function GrupoConvocados({
  titulo,
  jugadores,
  convocados,
  bloqueados,
  deshabilitados,
  onToggle,
  salienteId = null,
}: {
  titulo: string
  jugadores: Player[]
  convocados: Set<string>
  /** Ids que el usuario actual no puede DESELECCIONAR (apuntados; solo admin los saca). */
  bloqueados: Set<string>
  /** Ids que han dicho "No voy esta semana": no se pueden seleccionar. */
  deshabilitados: Set<string>
  onToggle: (id: string) => void
  /** Jugador marcado como "sale" en la sustitución (rejilla inteligente). */
  salienteId?: string | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {jugadores.map((p) => {
          const on = convocados.has(p.id)
          const noVa = deshabilitados.has(p.id)
          const locked = on && bloqueados.has(p.id)
          const sale = salienteId === p.id
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              disabled={noVa}
              title={
                noVa
                  ? 'Ha marcado que no va esta semana'
                  : locked
                    ? 'Se ha apuntado por la app; solo el admin puede quitarlo'
                    : undefined
              }
              className={
                'flex items-center justify-between gap-1 rounded border px-2 py-1.5 text-left text-sm transition-colors ' +
                (noVa
                  ? 'border-red-800 bg-red-950/40 text-red-400 line-through cursor-not-allowed'
                  : sale
                    ? 'border-amber-400 bg-amber-600/80 text-white ring-2 ring-amber-300'
                    : on
                      ? 'border-emerald-500 bg-emerald-600/80 text-white'
                      : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400') +
                (locked ? ' cursor-not-allowed' : '')
              }
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar src={fotoVisible(p)} alt={nombreVisible(p)} className="h-6 w-6" />
                <span className="truncate">
                  {nombreVisible(p)}
                  {p.tocado && <TocadoIcon className="ml-1" />}
                </span>
              </span>
              {noVa ? (
                <span className="shrink-0 text-xs opacity-80">no va</span>
              ) : sale ? (
                <span className="shrink-0 text-xs font-semibold opacity-90">sale</span>
              ) : locked ? (
                <span className="shrink-0 text-xs opacity-80" aria-label="apuntado">🔒</span>
              ) : (
                <span className="shrink-0 text-xs opacity-70">{p.posiciones[0]}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BalanceResult({
  balance,
  formacionA,
  formacionB,
  onConfirm,
  onCancelConfirm,
  confirmada,
  canConfirm,
  onCrossSwap,
}: {
  balance: TeamBalance
  formacionA: Formacion
  formacionB: Formacion
  onConfirm: () => void
  onCancelConfirm: () => void
  confirmada: boolean
  canConfirm: boolean
  onCrossSwap: (dragId: string, dropId: string) => void
}) {
  const pctA = Math.round(balance.balancePctA)
  const pctB = 100 - pctA
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const fieldRef = useRef<HTMLDivElement>(null)
  const [imgMsg, setImgMsg] = useState('')

  const descargarImagen = async () => {
    if (!fieldRef.current) return
    // cacheBust: fuerza recargar las fotos remotas (Supabase) para que se inlinen bien.
    const dataUrl = await toPng(fieldRef.current, {
      pixelRatio: 2,
      backgroundColor: '#0f1115',
      cacheBust: true,
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `equipos-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  const copiarImagen = async () => {
    if (!fieldRef.current) return
    try {
      const blob = await toBlob(fieldRef.current, {
        pixelRatio: 2,
        backgroundColor: '#0f1115',
        cacheBust: true,
      })
      if (!blob) throw new Error('sin imagen')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setImgMsg('✓ Imagen copiada')
      setTimeout(() => setImgMsg(''), 2500)
    } catch {
      // El portapapeles de imágenes no está disponible (p.ej. móvil) → descarga.
      await descargarImagen()
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Equipos propuestos</h2>
        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <button
              onClick={onConfirm}
              className={
                confirmada
                  ? 'rounded border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-600/10'
                  : 'rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500'
              }
              title={
                confirmada
                  ? 'Ya está confirmada. Púlsala para volver a guardarla con la colocación actual.'
                  : 'Guarda esta alineación en el historial para evitar repetirla en el futuro'
              }
            >
              {confirmada ? '✓ Confirmada · actualizar' : '✅ Confirmar alineación'}
            </button>
          )}
          {canConfirm && confirmada && (
            <button
              onClick={() => {
                if (
                  confirm(
                    '¿Cancelar la alineación confirmada? Se borrará y el banner volverá a mostrar la convocatoria. Los convocados se conservan para que puedas rehacerla.',
                  )
                )
                  onCancelConfirm()
              }}
              className="rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-600/10"
              title="Borra la alineación confirmada (vuelve la convocatoria al banner) y resetea la generación; conserva los convocados"
            >
              ✕ Cancelar alineación
            </button>
          )}
          <button
            onClick={copiarImagen}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            title="Copia la imagen del campo al portapapeles (o la descarga si no se puede)"
          >
            {imgMsg || '📷 Copiar imagen'}
          </button>
          <button
            onClick={descargarImagen}
            className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-slate-400"
            title="Descargar la imagen del campo (PNG)"
          >
            ⬇
          </button>
        </div>
      </div>

      {/* Barra de equilibrio */}
      <div>
        <div className="flex h-3 overflow-hidden rounded-full">
          <div className="bg-white" style={{ width: `${pctA}%` }} />
          <div className="bg-red-500" style={{ width: `${pctB}%` }} />
        </div>
        <p className="mt-1 text-center text-sm text-slate-400">
          Equilibrio {pctA}% / {pctB}% · diferencia de nivel {balance.diffScore.toFixed(2)}
        </p>
      </div>

      {/* Pista de uso (fuera de fieldRef para que NO salga en la imagen exportada) */}
      <p className="rounded-md border border-sky-500/50 bg-sky-900/30 px-3 py-2 text-center text-sm font-medium text-sky-200">
        💡 Puedes intercambiar jugadores <b>arrastrando</b> uno sobre la posición de otro.
      </p>

      {/* Campo con la distribución de ambos equipos (capturable como imagen) */}
      <div ref={fieldRef}>
        <FieldView
          balance={balance}
          formacionA={formacionA}
          formacionB={formacionB}
          onCrossSwap={onCrossSwap}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TeamColumn title="⚪ Equipo A" color="white" team={balance.teamA} score={balance.scoreA} />
        <TeamColumn title="🔴 Equipo B" color="red" team={balance.teamB} score={balance.scoreB} />
      </div>

      {/* Desglose técnico (solo admin: detalle de cómo equilibra el algoritmo) */}
      {isAdmin && (
      <details className="text-sm text-slate-400">
        <summary className="cursor-pointer select-none">Detalle del equilibrado</summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Diferencia de nivel total: {balance.breakdown.score.toFixed(2)} puntos</li>
          <li>Desequilibrio por líneas (DEF/MED/ATA): {balance.breakdown.posicion}</li>
          <li>Diferencia de zurdos: {balance.breakdown.pierna}</li>
          <li>Repetición de parejas (historial): {balance.breakdown.repeticion.toFixed(2)}</li>
          <li>
            Método:{' '}
            {balance.method === 'bruteforce'
              ? `exacto (fuerza bruta) · ${balance.evaluated.toLocaleString('es-ES')} combinaciones`
              : balance.method === 'manual'
                ? 'ajustado a mano'
                : 'heurístico'}
          </li>
        </ul>
      </details>
      )}
    </section>
  )
}

function TeamColumn({
  title,
  color,
  team,
  score,
}: {
  title: string
  color: 'white' | 'red'
  team: Player[]
  score: number
}) {
  const border = color === 'white' ? 'border-slate-300' : 'border-red-800'
  const ordenados = [...team].sort((a, b) => playerScore(b) - playerScore(a))
  return (
    <div className={'rounded-lg border ' + border + ' bg-slate-900/60 p-3'}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-slate-400">
          nivel {score.toFixed(1)} · {team.length} jug.
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {ordenados.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar
              src={fotoVisible(p)}
              alt={nombreVisible(p)}
              className="h-6 w-6"
              ring={color === 'white' ? 'A' : 'B'}
            />
            <span>
              {nombreVisible(p)}
              {p.invitado && <span className="text-amber-400" title="Invitado"> *</span>}
              {p.tocado && <TocadoIcon className="ml-1" />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
