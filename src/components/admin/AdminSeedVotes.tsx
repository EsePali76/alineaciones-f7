import { useState } from 'react'
import { usePlayersStore } from '../../store/playersStore'
import { useRatingsStore } from '../../store/ratingsStore'
import { useAuthStore } from '../../store/authStore'
import { upsertMyRating } from '../../lib/ratingsApi'

/**
 * Herramienta de un solo uso: vuelca las valoraciones "base" del plantel (lo que el
 * admin tenía puesto) a SU voto personal, para no tener que rellenarlo todo de nuevo.
 * No afecta a invitados (esos siguen valorándose desde el Plantel).
 */
export function AdminSeedVotes() {
  const players = usePlayersStore((s) => s.players)
  const myUserId = useAuthStore((s) => s.userId)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)
  const loadMine = useRatingsStore((s) => s.loadMine)
  const loadAverages = useRatingsStore((s) => s.loadAverages)

  const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle')
  const [copiados, setCopiados] = useState(0)

  const objetivo = players.filter(
    (p) => !p.invitado && p.id !== myPlayerId && Object.keys(p.ratings ?? {}).length > 0,
  )

  const copiar = async () => {
    if (!myUserId) return
    if (
      !confirm(
        `Se copiarán tus valoraciones base de ${objetivo.length} jugadores a tu voto personal. ` +
          'Si ya habías votado a alguno, se sobrescribirá con el valor del plantel. ¿Continuar?',
      )
    )
      return
    setEstado('cargando')
    try {
      let n = 0
      for (const p of objetivo) {
        await upsertMyRating(myUserId, p.id, p.ratings)
        n++
      }
      await loadMine()
      await loadAverages()
      setCopiados(n)
      setEstado('ok')
    } catch (e) {
      console.error(e)
      setEstado('error')
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <h3 className="text-base font-semibold">Copiar valoraciones del plantel a mi voto</h3>
      <p className="text-sm text-slate-400">
        Vuelca lo que tenías puesto en el Plantel a tu voto personal (pestaña Valorar), para no
        rellenarlo de nuevo. Hazlo <b>una sola vez</b>. No toca a los invitados.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={copiar}
          disabled={estado === 'cargando' || objetivo.length === 0}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-sky-500 disabled:opacity-50"
        >
          {estado === 'cargando' ? 'Copiando…' : `Copiar ${objetivo.length} valoraciones a mi voto`}
        </button>
        {estado === 'ok' && (
          <span className="text-sm text-emerald-400">✓ Copiadas {copiados} valoraciones</span>
        )}
        {estado === 'error' && <span className="text-sm text-red-400">Error al copiar</span>}
      </div>
    </div>
  )
}
