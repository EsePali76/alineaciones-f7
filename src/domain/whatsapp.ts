import type { Player } from './types'
import type { TeamBalance } from './balancer'

/** Etiqueta corta de un jugador: "Nombre (POS)" con marcas de invitado/tocado. */
function playerLine(p: Player): string {
  const pos = p.posiciones[0] ?? ''
  const marks = `${p.invitado ? ' *' : ''}${p.tocado ? ' 🤕' : ''}`
  return ` • ${p.nombre} (${pos})${marks}`
}

/** Genera el texto listo para pegar en WhatsApp con los dos equipos. */
export function formatForWhatsApp(balance: TeamBalance, fecha = new Date()): string {
  const f = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const pctA = Math.round(balance.balancePctA)
  const pctB = 100 - pctA

  const sortByName = (a: Player, b: Player) => a.nombre.localeCompare(b.nombre)
  const lineasA = [...balance.teamA].sort(sortByName).map(playerLine).join('\n')
  const lineasB = [...balance.teamB].sort(sortByName).map(playerLine).join('\n')

  return [
    `⚽ Pachanga ${f}`,
    '━━━━━━━━━━━━━━',
    `⚪ EQUIPO A (nivel ${balance.scoreA.toFixed(1)})`,
    lineasA,
    '',
    `🔴 EQUIPO B (nivel ${balance.scoreB.toFixed(1)})`,
    lineasB,
    '━━━━━━━━━━━━━━',
    `⚖️ Equilibrio: ${pctA}% / ${pctB}%`,
  ].join('\n')
}
