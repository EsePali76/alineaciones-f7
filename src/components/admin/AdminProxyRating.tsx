import { useEffect, useMemo, useState } from 'react'
import { usePlayersStore } from '../../store/playersStore'
import { useRatingsStore } from '../../store/ratingsStore'
import { useRotationStore } from '../../store/rotationStore'
import { useRatingsWindow } from '../../hooks/useRatingsWindow'
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
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Valoraciones</h2>

      <RatingsWindowControl />

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
    </div>
  )
}

/**
 * Plazo de re-evaluación: el admin abre/cierra una ventana global en la que TODOS
 * pueden revisar y ajustar sus valoraciones aunque ya las hubieran finalizado.
 * Mientras está abierta se avisa a cada usuario bajo el banner de turno.
 */
function RatingsWindowControl() {
  const ratingsOpen = useRotationStore((s) => s.ratingsOpen)
  const ratingsDeadline = useRotationStore((s) => s.ratingsDeadline)
  const setRatingsDeadline = useRotationStore((s) => s.setRatingsDeadline)
  const { abierto: vigente } = useRatingsWindow()
  const setRatingsOpen = useRotationStore((s) => s.setRatingsOpen)
  const [guardando, setGuardando] = useState(false)

  const cambiar = async (open: boolean) => {
    setGuardando(true)
    try {
      await setRatingsOpen(open)
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <div>
        <h3 className="text-base font-semibold">Plazo de reevaluación</h3>
        <p className="text-sm text-slate-400">
          Al abrirlo, cualquier usuario (también los que ya finalizaron) puede revisar y ajustar sus
          valoraciones. Se avisa a cada uno bajo el banner de turno. Si le pones fecha, se cierra
          solo al acabar ese día.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            'rounded-full px-3 py-1 text-xs font-medium ' +
            (vigente
              ? 'bg-sky-900/40 text-sky-300 ring-1 ring-sky-500/50'
              : 'bg-slate-700/60 text-slate-300')
          }
        >
          {vigente ? '● Abierto' : ratingsOpen ? '○ Vencido' : '○ Cerrado'}
        </span>

        <button
          onClick={() => cambiar(true)}
          disabled={guardando || ratingsOpen}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-sky-500 disabled:opacity-50"
        >
          Reabrir valoraciones
        </button>
        <button
          onClick={() => cambiar(false)}
          disabled={guardando || !ratingsOpen}
          className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 enabled:hover:border-slate-400 disabled:opacity-50"
        >
          Cerrar valoraciones
        </button>
      </div>

      {/* Fecha límite: el plazo se cierra solo al acabar ese día (cálculo derivado,
          no hay tarea programada). Vacío = abierto hasta que el admin lo cierre. */}
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <span>Cerrar automáticamente el:</span>
        <input
          type="date"
          value={ratingsDeadline ?? ''}
          onChange={(e) => setRatingsDeadline(e.target.value || null)}
          className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200"
        />
        {ratingsDeadline && (
          <button
            onClick={() => setRatingsDeadline(null)}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
          >
            Quitar fecha
          </button>
        )}
      </label>
    </div>
  )
}
