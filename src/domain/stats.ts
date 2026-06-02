import type { ConfirmedLineup } from './types'

/** Estadísticas acumuladas de un color de equipo (blanco = A, rojo = B). */
export interface TeamStats {
  partidos: number
  victorias: number
  empates: number
  derrotas: number
  golesFavor: number
  golesContra: number
}

/** Estadísticas por color: ⚪ blanco (equipo A) vs 🔴 rojo (equipo B). */
export function statsPorEquipo(lineups: ConfirmedLineup[]): { blanco: TeamStats; rojo: TeamStats } {
  const blanco = vacio()
  const rojo = vacio()
  for (const l of lineups) {
    if (!l.resultado) continue
    const { golesA, golesB } = l.resultado
    acumular(blanco, golesA, golesB)
    acumular(rojo, golesB, golesA)
  }
  return { blanco, rojo }
}

function vacio(): TeamStats {
  return { partidos: 0, victorias: 0, empates: 0, derrotas: 0, golesFavor: 0, golesContra: 0 }
}
function acumular(s: TeamStats, gf: number, gc: number) {
  s.partidos++
  s.golesFavor += gf
  s.golesContra += gc
  if (gf > gc) s.victorias++
  else if (gf < gc) s.derrotas++
  else s.empates++
}

/** Estadísticas acumuladas de un jugador. */
export interface PlayerStats {
  playerId: string
  partidos: number
  victorias: number
  empates: number
  derrotas: number
  pctVictorias: number
  golesFavor: number
  golesContra: number
  goles: number
  asistencias: number
  vecesBlanco: number
  vecesRojo: number
  /** Racha actual con signo: +3 = 3 victorias seguidas, -2 = 2 derrotas; 0 = sin racha. */
  racha: number
}

interface MatchOfPlayer {
  signo: number // 1 victoria, 0 empate, -1 derrota
  enA: boolean
  gf: number
  gc: number
  goles: number
  asistencias: number
}

/** Estadísticas por jugador, a partir del historial con resultados. */
export function statsPorJugador(lineups: ConfirmedLineup[]): Map<string, PlayerStats> {
  // Partidos por jugador en orden de recencia (más reciente primero).
  const porJugador = new Map<string, MatchOfPlayer[]>()
  const recientes = [...lineups].filter((l) => l.resultado).sort((a, b) => b.fecha - a.fecha)

  for (const l of recientes) {
    const { golesA, golesB, goleadores, asistencias } = l.resultado!
    const add = (id: string, enA: boolean) => {
      const gf = enA ? golesA : golesB
      const gc = enA ? golesB : golesA
      const lista = porJugador.get(id) ?? []
      lista.push({
        signo: gf > gc ? 1 : gf < gc ? -1 : 0,
        enA,
        gf,
        gc,
        goles: goleadores?.[id] ?? 0,
        asistencias: asistencias?.[id] ?? 0,
      })
      porJugador.set(id, lista)
    }
    for (const id of l.teamA) add(id, true)
    for (const id of l.teamB) add(id, false)
  }

  const map = new Map<string, PlayerStats>()
  for (const [id, partidos] of porJugador) {
    const s: PlayerStats = {
      playerId: id,
      partidos: partidos.length,
      victorias: 0,
      empates: 0,
      derrotas: 0,
      pctVictorias: 0,
      golesFavor: 0,
      golesContra: 0,
      goles: 0,
      asistencias: 0,
      vecesBlanco: 0,
      vecesRojo: 0,
      racha: 0,
    }
    for (const m of partidos) {
      if (m.signo > 0) s.victorias++
      else if (m.signo < 0) s.derrotas++
      else s.empates++
      s.golesFavor += m.gf
      s.golesContra += m.gc
      s.goles += m.goles
      s.asistencias += m.asistencias
      if (m.enA) s.vecesBlanco++
      else s.vecesRojo++
    }
    s.pctVictorias = s.partidos > 0 ? Math.round((s.victorias / s.partidos) * 100) : 0

    // Racha: desde el más reciente, mientras el signo se mantenga (el empate la corta).
    const primero = partidos[0]?.signo ?? 0
    if (primero !== 0) {
      let racha = 0
      for (const m of partidos) {
        if (m.signo === primero) racha += primero
        else break
      }
      s.racha = racha
    }
    map.set(id, s)
  }
  return map
}
