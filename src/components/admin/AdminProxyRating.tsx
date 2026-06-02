import { useEffect, useMemo, useState } from 'react'
import { usePlayersStore } from '../../store/playersStore'
import { useRatingsStore } from '../../store/ratingsStore'
import { fetchAllProfiles, type Profile } from '../../lib/authApi'
import { fetchRatingsOf, adminUpsertRating } from '../../lib/ratingsApi'
import type { PlayerRatings, Rating } from '../../domain/types'
import {
  RATING_KEYS,
  RATING_KEY_LABEL,
  MIN_RATING,
  MAX_RATING,
} from '../../domain/constants'
import type { RatingKey } from '../../domain/constants'

/**
 * Edición-proxy del Admin: cambia "a ciegas" el voto de un usuario a un jugador,
 * en su nombre (cuando el usuario, ya finalizado, pide cambiar un dato concreto).
 * Los campos salen EN BLANCO a propósito (no se muestra el valor guardado).
 * Solo se modifican los parámetros rellenados; el resto del voto se conserva.
 */
export function AdminProxyRating() {
  const players = usePlayersStore((s) => s.players)
  const loadAverages = useRatingsStore((s) => s.loadAverages)

  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [raterId, setRaterId] = useState('')
  const [rateeId, setRateeId] = useState('')
  const [nuevos, setNuevos] = useState<PlayerRatings>({})
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchAllProfiles()
      .then((ps) => setUsuarios(ps.filter((p) => p.playerId)))
      .catch((e) => console.error(e))
  }, [])

  const rater = usuarios.find((u) => u.id === raterId)
  const jugadores = useMemo(
    () =>
      [...players]
        .filter((p) => p.id !== rater?.playerId) // no se vota a sí mismo
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [players, rater?.playerId],
  )

  const setValor = (key: RatingKey, value: Rating | undefined) =>
    setNuevos((d) => {
      const n = { ...d }
      if (value === undefined) delete n[key]
      else n[key] = value
      return n
    })

  const guardar = async () => {
    if (!raterId || !rateeId || Object.keys(nuevos).length === 0) return
    setGuardando(true)
    setMsg('')
    try {
      // Merge "a ciegas": leemos lo existente (sin mostrarlo) y sobreescribimos solo lo tecleado.
      const existentes = await fetchRatingsOf(raterId)
      const base = existentes.get(rateeId) ?? {}
      await adminUpsertRating(raterId, rateeId, { ...base, ...nuevos })
      await loadAverages()
      setNuevos({})
      setMsg('✓ Voto actualizado')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) {
      console.error(e)
      setMsg('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <div>
        <h3 className="text-base font-semibold">Editar voto de un usuario (a ciegas)</h3>
        <p className="text-sm text-slate-400">
          Para cuando un usuario ya finalizó y te pide cambiar un dato. Eliges usuario y jugador,
          tecleas solo el/los parámetros a cambiar (los campos salen en blanco a propósito) y se
          guarda en su nombre.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Usuario (valorador)</span>
          <select
            value={raterId}
            onChange={(e) => {
              setRaterId(e.target.value)
              setRateeId('')
              setNuevos({})
            }}
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1"
          >
            <option value="">— elegir —</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName || u.email}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Jugador valorado</span>
          <select
            value={rateeId}
            onChange={(e) => {
              setRateeId(e.target.value)
              setNuevos({})
            }}
            disabled={!raterId}
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 disabled:opacity-50"
          >
            <option value="">— elegir —</option>
            {jugadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {raterId && rateeId && (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {RATING_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-slate-300">{RATING_KEY_LABEL[key]}</span>
                <input
                  type="number"
                  min={MIN_RATING}
                  max={MAX_RATING}
                  step={1}
                  value={nuevos[key] ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') return setValor(key, undefined)
                    const n = Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(Number(raw))))
                    setValor(key, n)
                  }}
                  placeholder="—"
                  className="w-16 rounded border border-slate-600 bg-slate-900 px-2 py-1"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={guardar}
              disabled={guardando || Object.keys(nuevos).length === 0}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-50"
            >
              Guardar cambio
            </button>
            {msg && <span className="text-xs text-slate-400">{msg}</span>}
          </div>
        </>
      )}
    </div>
  )
}
