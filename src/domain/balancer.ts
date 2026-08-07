import type { Player, ConfirmedLineup } from './types'
import {
  playerScore,
  lineaPrincipal,
  esZurdo,
  DEFAULT_WEIGHTS,
  TOCADO_FACTOR,
  type Linea,
  type ScoreOptions,
} from './scoring'

/**
 * Pesos de la función de coste (cuánto penaliza cada tipo de desequilibrio).
 * El objetivo PRINCIPAL es igualar el nivel total (score); el reparto por líneas
 * y la pierna hábil son secundarios / desempates. Todos ajustables.
 */
export interface CostWeights {
  /** Diferencia de nivel total entre equipos (en puntos de score). */
  score: number
  /** Desequilibrio en el reparto por líneas (DEF/MED/ATA). */
  posicion: number
  /** Desequilibrio en el nº de zurdos. */
  pierna: number
  /** Penalización por repetir parejas de compañeros respecto al historial. */
  repeticion: number
}

export const DEFAULT_COST_WEIGHTS: CostWeights = {
  score: 1.0,
  posicion: 0.4,
  pierna: 0.15,
  // "Equilibrado": secundario al equilibrio, pero suficiente para desempatar
  // entre alineaciones igual de parejas evitando repetir compañeros. Ajustable.
  repeticion: 0.3,
}

/** Cuánto decae el peso de una alineación histórica por cada semana de antigüedad. */
const RECENCY_DECAY = 0.6

export interface BalanceOptions extends ScoreOptions {
  costWeights?: CostWeights
  /** Historial de alineaciones confirmadas para penalizar repeticiones. */
  history?: ConfirmedLineup[]
}

/**
 * Opciones de puntuación a partir de las de equilibrado, con los valores por
 * defecto puestos. Centralizado a propósito: estaba duplicado en `balanceTeams` y
 * `evaluatePartition`, y al añadir un campo nuevo (el método de ponderación) es muy
 * fácil ponerlo en uno y olvidarlo en el otro — con el efecto de que la alineación
 * se genera con un criterio y luego se muestra evaluada con otro.
 */
function scoreOptionsDe(opts: BalanceOptions): ScoreOptions {
  return {
    weights: opts.weights ?? DEFAULT_WEIGHTS,
    tocadoFactor: opts.tocadoFactor ?? TOCADO_FACTOR,
    metodo: opts.metodo,
    puntos: opts.puntos,
  }
}

export interface CostBreakdown {
  score: number
  posicion: number
  pierna: number
  repeticion: number
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Acumula, por cada pareja de jugadores que ha jugado junta en el historial, un
 * peso que decae con la antigüedad (las alineaciones recientes pesan más).
 */
export function buildPairWeights(
  history: ConfirmedLineup[],
  decay = RECENCY_DECAY,
): Map<string, number> {
  const sorted = [...history].sort((a, b) => b.fecha - a.fecha)
  const weights = new Map<string, number>()
  sorted.forEach((lu, idx) => {
    const w = Math.pow(decay, idx)
    const addTeam = (ids: string[]) => {
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const k = pairKey(ids[i], ids[j])
          weights.set(k, (weights.get(k) ?? 0) + w)
        }
    }
    addTeam(lu.teamA)
    addTeam(lu.teamB)
  })
  return weights
}

/** Suma de pesos de las parejas de compañeros de la partición que ya se repitieron. */
function repetitionCost(teamA: Player[], teamB: Player[], pairW: Map<string, number>): number {
  if (pairW.size === 0) return 0
  let sum = 0
  const addTeam = (team: Player[]) => {
    for (let i = 0; i < team.length; i++)
      for (let j = i + 1; j < team.length; j++) {
        sum += pairW.get(pairKey(team[i].id, team[j].id)) ?? 0
      }
  }
  addTeam(teamA)
  addTeam(teamB)
  return sum
}

export interface TeamBalance {
  teamA: Player[]
  teamB: Player[]
  scoreA: number
  scoreB: number
  /** |scoreA - scoreB|. */
  diffScore: number
  /** % de nivel que aporta el equipo A sobre el total (50 = empate perfecto). */
  balancePctA: number
  /** Coste total de la mejor partición encontrada (menor = más equilibrada). */
  cost: number
  breakdown: CostBreakdown
  method: 'bruteforce' | 'greedy' | 'manual'
  /** Nº de combinaciones evaluadas (informativo). */
  evaluated: number
}

/** Límite de combinaciones para fuerza bruta. Por encima → heurística greedy. */
const BRUTEFORCE_LIMIT = 500_000

function teamScore(team: Player[], opts: ScoreOptions): number {
  return team.reduce((sum, p) => sum + playerScore(p, opts), 0)
}

function countByLinea(team: Player[]): Record<Linea, number> {
  const acc: Record<Linea, number> = { DEF: 0, MED: 0, ATA: 0 }
  for (const p of team) acc[lineaPrincipal(p)]++
  return acc
}

/** Coste de una partición concreta en dos equipos. Menor = más equilibrada. */
function partitionCost(
  teamA: Player[],
  teamB: Player[],
  scoreOpts: ScoreOptions,
  costW: CostWeights,
  pairW: Map<string, number>,
): { cost: number; breakdown: CostBreakdown; scoreA: number; scoreB: number } {
  const scoreA = teamScore(teamA, scoreOpts)
  const scoreB = teamScore(teamB, scoreOpts)

  const lineasA = countByLinea(teamA)
  const lineasB = countByLinea(teamB)
  const difPosicion =
    Math.abs(lineasA.DEF - lineasB.DEF) +
    Math.abs(lineasA.MED - lineasB.MED) +
    Math.abs(lineasA.ATA - lineasB.ATA)

  const zurdosA = teamA.filter(esZurdo).length
  const zurdosB = teamB.filter(esZurdo).length
  const difPierna = Math.abs(zurdosA - zurdosB)

  const breakdown: CostBreakdown = {
    score: Math.abs(scoreA - scoreB),
    posicion: difPosicion,
    pierna: difPierna,
    repeticion: repetitionCost(teamA, teamB, pairW),
  }

  const cost =
    costW.score * breakdown.score +
    costW.posicion * breakdown.posicion +
    costW.pierna * breakdown.pierna +
    costW.repeticion * breakdown.repeticion

  return { cost, breakdown, scoreA, scoreB }
}

/**
 * Genera todas las combinaciones de `k` índices de entre `n`, llamando a `cb`
 * con cada combinación (array reutilizado, no guardar referencia).
 */
function forEachCombination(n: number, k: number, cb: (combo: number[]) => void) {
  const combo = new Array<number>(k)
  const recurse = (start: number, depth: number) => {
    if (depth === k) {
      cb(combo)
      return
    }
    // Asegura que quedan suficientes elementos para completar la combinación.
    for (let i = start; i <= n - (k - depth); i++) {
      combo[depth] = i
      recurse(i + 1, depth + 1)
    }
  }
  recurse(0, 0)
}

function nCk(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  k = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return Math.round(result)
}

function buildResult(
  teamA: Player[],
  teamB: Player[],
  scoreOpts: ScoreOptions,
  costW: CostWeights,
  pairW: Map<string, number>,
  method: TeamBalance['method'],
  evaluated: number,
): TeamBalance {
  const { cost, breakdown, scoreA, scoreB } = partitionCost(teamA, teamB, scoreOpts, costW, pairW)
  const total = scoreA + scoreB
  return {
    teamA,
    teamB,
    scoreA,
    scoreB,
    diffScore: Math.abs(scoreA - scoreB),
    balancePctA: total > 0 ? (scoreA / total) * 100 : 50,
    cost,
    breakdown,
    method,
    evaluated,
  }
}

/**
 * Reparte a los jugadores convocados en dos equipos lo más equilibrados posible.
 *
 * - Tamaños: si el nº es par, dos equipos iguales; si es impar, el equipo A lleva
 *   uno más (típico cuando rota un comodín/portero).
 * - Método exacto por fuerza bruta evaluando todas las particiones posibles.
 *   Para F7 (12-16 convocados) son unos miles de combinaciones → instantáneo.
 *   Si el nº fuese enorme, cae a una heurística greedy.
 */
export function balanceTeams(players: Player[], opts: BalanceOptions = {}): TeamBalance | null {
  const scoreOpts = scoreOptionsDe(opts)
  const costW = opts.costWeights ?? DEFAULT_COST_WEIGHTS
  const pairW = buildPairWeights(opts.history ?? [])

  const n = players.length
  if (n < 2) return null

  const sizeA = Math.ceil(n / 2)
  const totalCombos = nCk(n, sizeA)
  // Si los equipos son iguales (n par), A y B son intercambiables → fijamos el
  // jugador 0 en A para no evaluar cada partición dos veces.
  const fixFirst = n % 2 === 0

  if (totalCombos > BRUTEFORCE_LIMIT) {
    return greedyBalance(players, scoreOpts, costW, pairW)
  }

  // Contenedor (objeto) en vez de variable suelta: evita que TS reduzca el tipo a
  // `never` al reasignarse sólo dentro del callback.
  const state: { best: { a: number[]; cost: number } | null } = { best: null }
  let evaluated = 0

  forEachCombination(n, sizeA, (combo) => {
    // Romper simetría: si n es par, sólo combinaciones que incluyan el índice 0.
    if (fixFirst && combo[0] !== 0) return
    evaluated++

    const inA = new Set(combo)
    const teamA: Player[] = []
    const teamB: Player[] = []
    for (let i = 0; i < n; i++) {
      if (inA.has(i)) teamA.push(players[i])
      else teamB.push(players[i])
    }
    const { cost } = partitionCost(teamA, teamB, scoreOpts, costW, pairW)
    if (state.best === null || cost < state.best.cost) {
      state.best = { a: [...combo], cost }
    }
  })

  if (state.best === null) return null

  const inA = new Set(state.best.a)
  const teamA: Player[] = []
  const teamB: Player[] = []
  for (let i = 0; i < n; i++) {
    if (inA.has(i)) teamA.push(players[i])
    else teamB.push(players[i])
  }
  return buildResult(teamA, teamB, scoreOpts, costW, pairW, 'bruteforce', evaluated)
}

/**
 * Reevalúa una partición YA decidida (no optimiza): recalcula niveles y coste con
 * los datos actuales de los jugadores. Útil para refrescar una alineación generada
 * cuando se editan los jugadores, manteniendo los mismos equipos.
 */
export function evaluatePartition(
  teamA: Player[],
  teamB: Player[],
  opts: BalanceOptions = {},
): TeamBalance {
  const scoreOpts = scoreOptionsDe(opts)
  const costW = opts.costWeights ?? DEFAULT_COST_WEIGHTS
  const pairW = buildPairWeights(opts.history ?? [])
  return buildResult(teamA, teamB, scoreOpts, costW, pairW, 'bruteforce', 0)
}

/**
 * Heurística de respaldo para nº de jugadores enorme: ordena por puntaje
 * descendente y va asignando cada jugador al equipo con menos nivel acumulado.
 */
function greedyBalance(
  players: Player[],
  scoreOpts: ScoreOptions,
  costW: CostWeights,
  pairW: Map<string, number>,
): TeamBalance {
  const sorted = [...players].sort((a, b) => playerScore(b, scoreOpts) - playerScore(a, scoreOpts))
  const sizeA = Math.ceil(players.length / 2)
  const teamA: Player[] = []
  const teamB: Player[] = []
  let scoreA = 0
  let scoreB = 0
  for (const p of sorted) {
    const s = playerScore(p, scoreOpts)
    const canA = teamA.length < sizeA
    const canB = teamB.length < players.length - sizeA
    if (canA && (!canB || scoreA <= scoreB)) {
      teamA.push(p)
      scoreA += s
    } else {
      teamB.push(p)
      scoreB += s
    }
  }
  return buildResult(teamA, teamB, scoreOpts, costW, pairW, 'greedy', players.length)
}
