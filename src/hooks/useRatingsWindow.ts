import { useRotationStore } from '../store/rotationStore'
import { plazoVigente } from '../domain/ratingsWindow'

export interface RatingsWindow {
  /** Plazo de reevaluación realmente vigente (abierto por el admin y sin vencer). */
  abierto: boolean
  /** Fecha límite 'YYYY-MM-DD', o null si el plazo no tiene fin. */
  deadline: string | null
}

/**
 * Estado del plazo de reevaluación tal y como lo tiene que ver la app.
 *
 * SIEMPRE usar esto en vez de leer `ratingsOpen` del store a pelo: el flag crudo
 * es solo la intención del admin, y sin la fecha límite el plazo seguiría abierto
 * después de vencer.
 */
export function useRatingsWindow(): RatingsWindow {
  const abierto = useRotationStore((s) => s.ratingsOpen)
  const deadline = useRotationStore((s) => s.ratingsDeadline)
  return { abierto: plazoVigente(abierto, deadline), deadline }
}
