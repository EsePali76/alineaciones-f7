import { useEffect, useMemo, useState } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useRatingsStore } from '../store/ratingsStore'
import { useAuthStore } from '../store/authStore'
import { useRotationStore } from '../store/rotationStore'
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
import { Avatar } from './Avatar'

/**
 * Valoración colaborativa: cada usuario vota a los demás jugadores (menos a sí mismo).
 * Anónimo. Cada parámetro es OPCIONAL (lo que dejes en blanco no cuenta) y editar uno
 * no afecta a los demás. Se guarda por jugador con su botón. Editable hasta "Finalizar".
 */
export function RatePlayers() {
  const players = usePlayersStore((s) => s.players)
  const { profile, isLinked, isAdmin } = useAuthStore()
  const mine = useRatingsStore((s) => s.mine)
  const mineLoaded = useRatingsStore((s) => s.mineLoaded)
  const loadMine = useRatingsStore((s) => s.loadMine)
  const saveMine = useRatingsStore((s) => s.saveMine)
  const finalize = useRatingsStore((s) => s.finalize)
  const ratingsOpen = useRotationStore((s) => s.ratingsOpen)

  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  // Borrador en edición del jugador seleccionado (no se guarda hasta pulsar Guardar).
  const [draft, setDraft] = useState<PlayerRatings>({})
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => {
    loadMine()
  }, [loadMine])

  const finalizado = profile?.ratingsFinalized ?? false
  // Durante el plazo de re-evaluación (abierto por el admin) se puede editar aunque
  // hayas finalizado. El bloqueo real solo aplica si finalizaste y NO hay plazo abierto.
  const bloqueado = finalizado && !ratingsOpen

  const aValorar = useMemo(
    () =>
      players
        // Se vota al plantel y a los invitados HABITUALES; nunca al invitado puntual
        // (datos estimados) ni a uno mismo.
        .filter(
          (p) => p.activo && !(p.invitado && !p.habitual) && p.id !== profile?.playerId,
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [players, profile?.playerId],
  )

  // Al elegir jugador (o al cargar mis votos), el borrador parte de lo ya guardado.
  const elegir = (id: string) => {
    setSeleccionado(id)
    setDraft({ ...(mine.get(id) ?? {}) })
    setGuardadoOk(false)
  }
  useEffect(() => {
    if (seleccionado) setDraft({ ...(mine.get(seleccionado) ?? {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineLoaded])

  if (!isLinked) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-400">
        Para valorar tienes que estar vinculado a tu jugador. Pídele al admin que te vincule.
      </p>
    )
  }

  const jugador = seleccionado ? aValorar.find((p) => p.id === seleccionado) : null
  const guardado = seleccionado ? mine.get(seleccionado) ?? {} : {}
  const sucio = JSON.stringify(draft) !== JSON.stringify(guardado)

  const setValor = (key: RatingKey, value: Rating | undefined) => {
    if (bloqueado) return
    setGuardadoOk(false)
    setDraft((d) => {
      const n = { ...d }
      if (value === undefined) delete n[key]
      else n[key] = value
      return n
    })
  }

  const guardar = async () => {
    if (!seleccionado) return
    setGuardando(true)
    try {
      await saveMine(seleccionado, draft)
      setGuardadoOk(true)
    } finally {
      setGuardando(false)
    }
  }

  const completados = aValorar.filter((p) => mine.get(p.id)?.general != null).length

  const ratingRow = (key: RatingKey) => {
    const val = draft[key]
    return (
      <div key={key} className="flex items-start gap-3">
        <div className="w-40 shrink-0">
          <span className="font-medium text-slate-100">{RATING_KEY_LABEL[key]}</span>
          <p className="text-xs text-slate-300">{RATING_KEY_HINT[key]}</p>
        </div>
        <input
          type="number"
          min={MIN_RATING}
          max={MAX_RATING}
          step={1}
          disabled={bloqueado}
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
        <span className="pt-2 text-xs text-slate-400">
          {val === undefined ? 'sin valorar' : ratingLabel(val)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Valorar jugadores</h2>
        {isAdmin ? (
          <p className="text-sm text-slate-400">
            Puntúa al resto del grupo (0-10). Es anónimo: nadie verá tu voto, solo la media. Guarda
            cada jugador con su botón. Cuando termines del todo, pulsa <b>Finalizar</b> y se bloqueará.
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Puntúa al resto del grupo (0-10). Es anónimo. Guarda cada jugador y, al terminar, pulsa{' '}
            <b>Finalizar</b>.
          </p>
        )}
      </div>

      {bloqueado && (
        <p className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">
          🔒 Has finalizado tus valoraciones. Si quieres cambiar algo, pídeselo al admin.
        </p>
      )}

      {finalizado && ratingsOpen && (
        <p className="rounded-lg border border-sky-600/50 bg-sky-900/20 p-3 text-sm text-sky-200">
          📝 Plazo de reevaluación abierto: aunque ya finalizaste, puedes revisar y ajustar tus
          valoraciones mientras esté activo.
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
                    onClick={() => elegir(p.id)}
                    className={
                      'flex items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ' +
                      (activo ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800')
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Avatar src={p.fotoUrl} alt={p.nombre} className="h-6 w-6" />
                      {p.nombre}
                    </span>
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
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <Avatar src={jugador.fotoUrl} alt={jugador.nombre} className="h-9 w-9" />
                  {jugador.nombre}
                </h3>
                <div className="rounded-lg border-2 border-red-500 bg-red-600/25 p-3 shadow-[0_0_14px_-2px_rgba(239,68,68,0.5)]">
                  {ratingRow(RATING_KEY_ANCLA)}
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-slate-600 bg-slate-800/60 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Modificadores
                  </span>
                  {RATING_KEYS_FACETAS.map((key) => ratingRow(key))}
                </div>

                {/* Guardar */}
                {!bloqueado && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={guardar}
                      disabled={guardando || !sucio}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                    {sucio ? (
                      <span className="text-xs text-amber-400">Cambios sin guardar</span>
                    ) : guardadoOk ? (
                      <span className="text-xs text-emerald-400">✓ Guardado</span>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
