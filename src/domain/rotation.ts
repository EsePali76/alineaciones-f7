/**
 * Lógica pura de la rotación de turnos (a quién le toca hacer la alineación).
 *
 * Modelo:
 *  - `order`: cola estable de jugadores en rotación (orden canónico).
 *  - `current`: a quién le toca ahora.
 *  - `skipped`: quienes han pasado turno ESTE ciclo (conservan su sitio).
 *
 * Reglas:
 *  - Hacer la alineación → el autor va al final de la cola y empieza ciclo nuevo.
 *  - Pasar turno ("no puedo") → pasa al siguiente, pero el que pasa NO pierde su
 *    sitio (sigue en cola; lo hará la próxima). Se "consume" solo al hacerla.
 *  - Salir del listado (autoexclusión) o quedar inactivo → fuera de elegibles.
 */
import type { Player } from './types'

export interface RotationData {
  currentPlayerId: string | null
  orderIds: string[]
  skippedIds: string[]
}

/**
 * ¿Entra este jugador en la rotación de alineadores? Solo los fijos del grupo:
 * activos, no autoexcluidos, no reservas y no invitados (estos no tienen cuenta
 * y nunca hacen alineaciones).
 */
export function esElegibleRotacion(p: Player): boolean {
  return p.activo && !p.excluidoRotacion && !p.reserva && !p.invitado
}

/**
 * Aplica el filtro "solo alinea quien ha valorado a todos" sobre los elegibles.
 *
 * IMPORTANTE — esto NO se aplica al reconciliar la cola guardada (`reconcileOrder`,
 * `advancePass`, `advanceAfterConfirm`): esos siguen usando `esElegibleRotacion` a
 * secas. Si el filtro tocara la cola persistida, al que le falte una valoración se
 * le borraría del orden y perdería su sitio para siempre; así, en cuanto complete
 * sus votos vuelve exactamente donde estaba. El filtro es de TURNO, no de cola.
 *
 * Quien no tiene cuenta vinculada no aparece en `completos` y, por tanto, queda
 * fuera mientras el filtro esté activo: no puede valorar, y tampoco podría entrar
 * en la app a hacer la alineación.
 *
 * Red de seguridad: si el filtro dejase la cola VACÍA, se ignora y se devuelven
 * todos los elegibles. Vale más un turno "sucio" que una semana sin alineador.
 */
export function filtrarPorValoraciones(
  elegibles: Player[],
  completos: Set<string>,
  activo: boolean,
): { ids: Set<string>; aplicado: boolean } {
  const todos = new Set(elegibles.map((p) => p.id))
  if (!activo) return { ids: todos, aplicado: false }
  const pasan = elegibles.filter((p) => completos.has(p.id))
  if (pasan.length === 0) return { ids: todos, aplicado: false }
  return { ids: new Set(pasan.map((p) => p.id)), aplicado: true }
}

/** Primer elegible de la cola que no haya pasado turno; si todos pasaron, el primero. */
export function computeCurrent(
  order: string[],
  eligible: Set<string>,
  skipped: Set<string>,
): string | null {
  const enCola = order.filter((id) => eligible.has(id))
  const libre = enCola.find((id) => !skipped.has(id))
  return libre ?? enCola[0] ?? null
}

/**
 * Reconcilia la cola con los elegibles actuales: conserva el orden existente,
 * quita a los que ya no son elegibles y añade al final a los nuevos elegibles.
 */
export function reconcileOrder(order: string[], eligibleOrdered: string[]): string[] {
  const eligSet = new Set(eligibleOrdered)
  const kept = order.filter((id) => eligSet.has(id))
  const nuevos = eligibleOrdered.filter((id) => !order.includes(id))
  return [...kept, ...nuevos]
}

/** Current "efectivo" para mostrar: el guardado si sigue siendo elegible; si no, recalcula. */
export function effectiveCurrent(
  data: RotationData,
  eligible: Set<string>,
): string | null {
  if (data.currentPlayerId && eligible.has(data.currentPlayerId)) return data.currentPlayerId
  return computeCurrent(data.orderIds, eligible, new Set(data.skippedIds))
}

/**
 * Quién hará la PRÓXIMA alineación: simula que el actual hace la suya (se va al
 * final de la cola y empieza ciclo nuevo) y devuelve quién quedaría de turno.
 * Así, si alguien pasó turno (conserva su sitio), aparece correctamente como el
 * siguiente, en vez del simple "siguiente cíclico".
 */
export function nextCurrent(data: RotationData, eligible: Set<string>): string | null {
  const order = data.orderIds.filter((id) => eligible.has(id))
  if (order.length <= 1) return null
  const cur = effectiveCurrent(data, eligible)
  const sinCur = order.filter((id) => id !== cur)
  const nuevoOrden = cur ? [...sinCur, cur] : order
  return nuevoOrden[0] ?? null
}

/** Pasar turno (o avance del admin): salta al actual y pasa al siguiente, conservando su sitio. */
export function advancePass(data: RotationData, eligibleOrdered: string[]): RotationData {
  const order = reconcileOrder(data.orderIds, eligibleOrdered)
  const eligible = new Set(eligibleOrdered)
  const current = effectiveCurrent({ ...data, orderIds: order }, eligible)

  const skipped = new Set(data.skippedIds)
  if (current) skipped.add(current)

  const restantes = order.filter((id) => eligible.has(id) && !skipped.has(id))
  if (restantes.length > 0) {
    return { currentPlayerId: restantes[0], orderIds: order, skippedIds: [...skipped] }
  }
  // Todos han pasado → ciclo nuevo: empieza por el primero de la cola.
  return { currentPlayerId: order.find((id) => eligible.has(id)) ?? null, orderIds: order, skippedIds: [] }
}

/** Tras confirmar una alineación: el autor va al final y empieza ciclo nuevo. */
export function advanceAfterConfirm(
  data: RotationData,
  doerId: string,
  eligibleOrdered: string[],
): RotationData {
  let order = reconcileOrder(data.orderIds, eligibleOrdered)
  if (order.includes(doerId)) order = [...order.filter((id) => id !== doerId), doerId]
  const eligible = new Set(eligibleOrdered)
  return {
    currentPlayerId: computeCurrent(order, eligible, new Set()),
    orderIds: order,
    skippedIds: [],
  }
}

/** Siembra/reinicia la cola desde los elegibles dados (en orden). */
export function seed(eligibleOrdered: string[]): RotationData {
  return {
    currentPlayerId: eligibleOrdered[0] ?? null,
    orderIds: [...eligibleOrdered],
    skippedIds: [],
  }
}
