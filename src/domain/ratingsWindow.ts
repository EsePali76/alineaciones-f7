import { parseISO } from './matchday'

/**
 * Plazo de reevaluación de valoraciones.
 *
 * Dos datos en la fila `rotation`: `ratings_open` (el admin lo ha abierto) y
 * `ratings_deadline` (hasta cuándo, opcional). El plazo VIGENTE es la conjunción
 * de ambos, y se calcula aquí en vez de guardarse.
 *
 * Por qué derivado y no un cierre automático que escriba en la base: si el cierre
 * dependiera de que alguien ejecute algo el día del vencimiento, un fin de semana
 * sin que nadie abra la app dejaría el plazo abierto de más. Derivándolo, el plazo
 * vence puntualmente aunque nadie toque nada. Mismo criterio que el override de
 * fecha de partido en `matchday.ts`.
 */

/** ¿Está el plazo vigente? Abierto por el admin y con la fecha límite sin vencer. */
export function plazoVigente(
  abierto: boolean,
  deadlineISO: string | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!abierto) return false
  if (!deadlineISO) return true // abierto "hasta nuevo aviso"
  return ahora.getTime() <= finDelDia(deadlineISO).getTime()
}

/** ¿Hay fecha límite y ya ha vencido? (con el plazo aún marcado como abierto). */
export function plazoVencido(
  abierto: boolean,
  deadlineISO: string | null | undefined,
  ahora: Date = new Date(),
): boolean {
  return abierto && !!deadlineISO && !plazoVigente(abierto, deadlineISO, ahora)
}

/** La fecha límite cuenta ENTERA: el plazo muere al acabar ese día, no al empezarlo. */
function finDelDia(iso: string): Date {
  const d = parseISO(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
