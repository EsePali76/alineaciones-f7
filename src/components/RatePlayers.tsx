import { useEffect, useMemo, useState } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useRatingsStore } from '../store/ratingsStore'
import { useAuthStore } from '../store/authStore'
import type { PlayerRatings, Rating } from '../domain/types'
import {
  RATING_KEY_ANCLA,
  RATING_KEYS_FACETAS,
  RATING_KEY_LABEL,
  RATING_KEY_HINT,
  MIN_RATING,
  MAX_RATING,
  ratingLabel,
} from '../domain/constants'
import type { RatingKey } from '../domain/constants'

/**
 * Valoración colaborativa: cada usuario vota a TODOS los demás jugadores (menos a
 * sí mismo). Anónimo. Editable hasta pulsar "Finalizar", que lo bloquea.
 */
export function RatePlayers() {
  const players = usePlayersStore((s) => s.players)
  const { profile, isLinked } = useAuthStore()
  const mine = useRatingsStore((s) => s.mine)
  const mineLoaded = useRatingsStore((s) => s.mineLoaded)
  const loadMine = useRatingsStore((s) => s.loadMine)
  const saveMine = useRatingsStore((s) => s.saveMine)
  const finalize = useRatingsStore((s) => s.finalize)

  const [seleccionado, setSeleccionado] = useState<string | null>(null)

  useEffect(() => {
    loadMine()
  }, [loadMine])

  const finalizado = profile?.ratingsFinalized ?? false

  // Jugadores a valorar: activos, no invitados (a esos los estima el admin), distintos de mí.
  const aValorar = useMemo(
    () =>
      players
        .filter((p) => p.activo && !p.invitado && p.id !== profile?.playerId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [players, profile?.playerId],
  )

  if (!isLinked) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-400">
        Para valorar tienes que estar vinculado a tu jugador. Pídele al admin que te vincule.
      </p>
    )
  }

  const jugador = seleccionado ? aValorar.find((p) => p.id === seleccionado) : null
  const valores = seleccionado ? mine.get(seleccionado) ?? {} : {}

  const setValor = async (key: RatingKey, value: Rating | undefined) => {
    if (!seleccionado || finalizado) return
    const nuevos: PlayerRatings = { ...mine.get(seleccionado) }
    if (value === undefined) delete nuevos[key]
    else nuevos[key] = value
    await saveMine(seleccionado, nuevos)
  }

  // Cuántos jugadores tienen al menos la valoración general puesta.
  const completados = aValorar.filter((p) => mine.get(p.id)?.general != null).length

  const ratingRow = (key: RatingKey) => {
    const val = valores[key]
    return (
      <div key={key} className="flex items-start gap-3">
        <div className="w-40 shrink-0">
          <span className="text-slate-300">{RATING_KEY_LABEL[key]}</span>
          <p className="text-xs text-slate-500">{RATING_KEY_HINT[key]}</p>
        </div>
        <input
          type="number"
          min={MIN_RATING}
          max={MAX_RATING}
          step={1}
          disabled={finalizado}
          value={val ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') return setValor(key, undefined)
            const n = Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(Number(raw))))
            setValor(key, n)
          }}
          placeholder="—"
          className="w-20 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 disabled:opacity-50"
        />
        <span className="pt-2 text-xs text-slate-500">
          {val === undefined ? 'sin valorar' : ratingLabel(val)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Valorar jugadores</h2>
        <p className="text-sm text-slate-400">
          Puntúa al resto del grupo (0-10). Es anónimo: nadie verá tu voto, solo la media.
          Puedes hacerlo en varias veces; cuando termines, pulsa <b>Finalizar</b> y se bloqueará.
        </p>
      </div>

      {finalizado && (
        <p className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">
          🔒 Has finalizado tus valoraciones. Si quieres cambiar algo, pídeselo al admin.
        </p>
      )}

      {!mineLoaded ? (
        <p className="p-6 text-center text-slate-500">Cargando tus valoraciones…</p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Lista de jugadores a valorar */}
          <div className="md:w-64 md:shrink-0">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {completados}/{aValorar.length} valorados
              </span>
              {!finalizado && completados > 0 && (
                <button
                  onClick={() => {
                    if (confirm('¿Finalizar tus valoraciones? Ya no podrás editarlas.')) finalize()
                  }}
                  className="rounded bg-emerald-600 px-2 py-1 font-medium text-white hover:bg-emerald-500"
                >
                  Finalizar
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-slate-700 p-1">
              {aValorar.map((p) => {
                const hecho = mine.get(p.id)?.general != null
                const activo = p.id === seleccionado
                return (
                  <button
                    key={p.id}
                    onClick={() => setSeleccionado(p.id)}
                    className={
                      'flex items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ' +
                      (activo ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800')
                    }
                  >
                    <span>{p.nombre}</span>
                    <span className={hecho ? 'text-emerald-400' : 'text-slate-600'}>
                      {hecho ? '✓' : '○'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panel de valoración del jugador seleccionado */}
          <div className="flex-1">
            {!jugador ? (
              <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
                Elige un jugador de la lista para valorarlo.
              </p>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                <h3 className="text-base font-semibold">{jugador.nombre}</h3>
                <div className="rounded-lg border-2 border-amber-400 bg-amber-500/20 p-3 shadow-[0_0_12px_-2px_rgba(251,191,36,0.4)]">
                  {ratingRow(RATING_KEY_ANCLA)}
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-slate-600 bg-slate-800/60 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Modificadores
                  </span>
                  {RATING_KEYS_FACETAS.map((key) => ratingRow(key))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
