import { useState } from 'react'
import type { PlayerInput } from '../store/playersStore'
import type { Foot, PositionCode, Rating } from '../domain/types'
import {
  POSITIONS,
  FOOT_OPTIONS,
  ratingLabel,
  RATING_KEY_ANCLA,
  RATING_KEYS_FACETAS,
  RATING_KEY_LABEL,
  RATING_KEY_HINT,
  MIN_RATING,
  MAX_RATING,
} from '../domain/constants'
import type { RatingKey } from '../domain/constants'
import { PhotoUpload } from './PhotoUpload'

interface PlayerFormProps {
  /** Valores iniciales (modo edición). Si se omite, formulario en blanco (alta). */
  initial?: PlayerInput
  /** Id del jugador (modo edición/autoservicio). Necesario para subir su foto. */
  playerId?: string
  onSubmit: (input: PlayerInput) => void | Promise<void>
  onCancel?: () => void
  /**
   * 'full' (admin): identidad + valoraciones + flags.
   * 'identity' (autoservicio del usuario): solo nombre/edad/posiciones/perfil.
   * Las valoraciones se votan entre todos; los flags los gestiona el admin.
   */
  mode?: 'full' | 'identity'
  /**
   * 'plantel' (por defecto): jugador del grupo; sus valoraciones las vota el grupo.
   * 'invitado': alta/edición en la lista de Invitados. `invitado=true` va implícito
   * (no se pregunta); el único toggle es "habitual" (lo vota el grupo) vs puntual
   * (datos estimados a 5, editables aquí).
   */
  kind?: 'plantel' | 'invitado'
}

/**
 * Aclaración junto a la casilla de "tocado". Desde que hay dos métodos de
 * equilibrado, este flag SOLO baja el nivel en el de valoraciones: el de
 * resultados reparte por lo que se gana en el campo y no admite modificadores
 * (ver `domain/resultados.ts`). Sin este aviso, marcarse tocado y ver que la
 * alineación no cambia parece un fallo.
 */
const AVISO_TOCADO = 'Solo tiene efecto en las alineaciones hechas por valoraciones.'

const EMPTY: PlayerInput = {
  nombre: '',
  edad: undefined,
  posiciones: [],
  pierna: 'der',
  ratings: {},
  invitado: false,
  habitual: false,
  tocado: false,
  excluidoRotacion: false,
  reserva: false,
  activo: true,
  fotoOculta: false,
}

export function PlayerForm({
  initial,
  playerId,
  onSubmit,
  onCancel,
  mode = 'full',
  kind = 'plantel',
}: PlayerFormProps) {
  const esInvitado = kind === 'invitado'
  // Alta de invitado: `invitado` va implícito (no es un checkbox que se pregunte).
  const seed: PlayerInput = initial ?? (esInvitado ? { ...EMPTY, invitado: true } : EMPTY)
  const [data, setData] = useState<PlayerInput>(seed)
  const soloIdentidad = mode === 'identity'
  // En la lista de invitados, las valoraciones manuales solo se piden al puntual
  // (al habitual lo vota el grupo, igual que a un jugador del plantel).
  const mostrarValoraciones = esInvitado && !data.habitual

  const togglePosition = (code: PositionCode) =>
    setData((d) => ({
      ...d,
      posiciones: d.posiciones.includes(code)
        ? d.posiciones.filter((c) => c !== code)
        : [...d.posiciones, code],
    }))

  // Sube una posición en el orden de preferencia (la 1ª es la natural/preferida).
  const moverArriba = (i: number) =>
    setData((d) => {
      if (i <= 0) return d
      const pos = [...d.posiciones]
      ;[pos[i - 1], pos[i]] = [pos[i], pos[i - 1]]
      return { ...d, posiciones: pos }
    })

  const setRating = (key: RatingKey, value: Rating | undefined) =>
    setData((d) => ({ ...d, ratings: { ...d.ratings, [key]: value } }))

  // Fila de valoración reutilizable (ancla y facetas comparten render).
  const ratingRow = (key: RatingKey) => {
    const val = data.ratings[key]
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
          value={val ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') return setRating(key, undefined)
            const n = Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(Number(raw))))
            setRating(key, n)
          }}
          placeholder="—"
          className="w-20 rounded border border-slate-600 bg-slate-900 px-3 py-1.5"
        />
        <span className="pt-2 text-xs text-slate-400">
          {val === undefined ? 'sin valorar' : ratingLabel(val)}
        </span>
      </div>
    )
  }

  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nombre = data.nombre.trim()
    if (!nombre) return
    // Las posiciones son obligatorias para el plantel, pero opcionales para invitados
    // (el alta rápida desde Equipos también las permite vacías → "juega donde quepa").
    if (!esInvitado && data.posiciones.length === 0) return
    setGuardando(true)
    setGuardado(false)
    try {
      // En la lista de invitados, `invitado` va siempre implícito.
      await onSubmit({ ...data, nombre, invitado: esInvitado ? true : data.invitado })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
      if (!initial) setData(esInvitado ? { ...EMPTY, invitado: true } : EMPTY) // limpia tras un alta
    } catch {
      // El store ya avisa del error; no mostramos "guardado".
    } finally {
      setGuardando(false)
    }
  }

  const valid =
    data.nombre.trim().length > 0 && (esInvitado || data.posiciones.length > 0)

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4"
    >
      <h2 className="text-lg font-semibold">
        {soloIdentidad
          ? 'Mis datos'
          : esInvitado
            ? initial
              ? 'Editar invitado'
              : 'Nuevo invitado'
            : initial
              ? 'Editar jugador'
              : 'Nuevo jugador'}
      </h2>
      {/* Foto / avatar */}
      <PhotoUpload
        playerId={playerId}
        value={data.fotoUrl}
        nombre={data.nombre}
        onChange={(url) => setData((d) => ({ ...d, fotoUrl: url }))}
      />

      {/* Moderación de la foto (solo admin): ocultar una foto inapropiada sin borrarla. */}
      {!soloIdentidad && data.fotoUrl && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.fotoOculta ?? false}
            onChange={(e) => setData((d) => ({ ...d, fotoOculta: e.target.checked }))}
            className="h-4 w-4"
          />
          <span title="Oculta esta foto en toda la app (se mostrará la silueta). No la borra: tú la sigues viendo aquí. Útil si alguien sube algo inapropiado.">
            Ocultar foto (no la verá nadie · se muestra silueta)
          </span>
        </label>
      )}

      {/* Nombre + edad */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm">
          <span className="text-slate-400">Nombre</span>
          <input
            type="text"
            value={data.nombre}
            onChange={(e) => setData((d) => ({ ...d, nombre: e.target.value }))}
            placeholder="Nombre del jugador"
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
          />
        </label>
        {!soloIdentidad && (
          <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm">
            <span className="text-slate-400" title="El que se ve en estadísticas, equipos y partidos. Si lo dejas vacío, se usa el nombre de arriba.">
              Nombre reconocible (opcional)
            </span>
            <input
              type="text"
              value={data.nombreReconocible ?? ''}
              onChange={(e) => setData((d) => ({ ...d, nombreReconocible: e.target.value }))}
              placeholder="Nombre real para estadísticas"
              className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            />
          </label>
        )}
        <label className="flex w-28 flex-col gap-1 text-sm">
          <span className="text-slate-400">Edad</span>
          <input
            type="number"
            min={1}
            max={99}
            value={data.edad ?? ''}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                edad: e.target.value === '' ? undefined : Number(e.target.value),
              }))
            }
            placeholder="—"
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
          />
        </label>
      </div>

      {/* Posiciones */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-slate-400">Posiciones que puede jugar (una o varias)</span>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((p) => {
            const on = data.posiciones.includes(p.code)
            return (
              <button
                type="button"
                key={p.code}
                onClick={() => togglePosition(p.code)}
                title={p.descripcion}
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors ' +
                  (on
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
                }
              >
                {p.code} · {p.label}
              </button>
            )
          })}
        </div>

        {/* Orden de preferencia: la 1ª es la posición natural/preferida */}
        {data.posiciones.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">
              Orden de preferencia (la 1ª es su posición natural; usa ↑ para reordenar):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {data.posiciones.map((code, i) => (
                <span
                  key={code}
                  className={
                    'flex items-center gap-1 rounded border px-2 py-0.5 text-xs ' +
                    (i === 0
                      ? 'border-amber-500 bg-amber-600/20 text-amber-300'
                      : 'border-slate-600 bg-slate-900 text-slate-300')
                  }
                >
                  {i === 0 && <span title="Posición preferida">★</span>}
                  {code}
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => moverArriba(i)}
                      title="Subir en preferencia"
                      className="ml-0.5 rounded px-1 text-slate-400 hover:text-white"
                    >
                      ↑
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Perfil preferido (antes "pierna hábil") */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-slate-400">Perfil preferido</span>
        {!soloIdentidad && (
          <p className="text-xs text-slate-500">
            Banda en la que actúa con naturalidad (carrilero/extremo). "Ambos" = cómodo en las dos
            → la app puede colocarlo en cualquier lado.
          </p>
        )}
        <div className="flex gap-2">
          {FOOT_OPTIONS.map((f) => (
            <button
              type="button"
              key={f.value}
              onClick={() => setData((d) => ({ ...d, pierna: f.value as Foot }))}
              className={
                'rounded border px-3 py-1.5 transition-colors ' +
                (data.pierna === f.value
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* "Tocado": el propio usuario puede marcarlo desde su perfil (también el admin, abajo). */}
      {soloIdentidad && (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.tocado}
              onChange={(e) => setData((d) => ({ ...d, tocado: e.target.checked }))}
              className="h-4 w-4"
            />
            <span title="Márcalo si vienes mermado a este partido (molestias, vuelves de lesión). Baja un poco tu nivel para equilibrar mejor los equipos.">
              Voy tocado / bajo de forma este partido
            </span>
          </label>
          <p className="ml-6 text-xs text-slate-500">{AVISO_TOCADO}</p>
        </div>
      )}

      {/* Valoraciones 0-10: SOLO para el invitado puntual (al resto lo vota el grupo). */}
      {!soloIdentidad && mostrarValoraciones && (
      <div className="flex flex-col gap-3 text-sm">
        <span className="text-slate-400">
          Valoración estimada del invitado (0-10){' '}
          <span className="text-amber-400">· sin valorar = 5 (media)</span>
        </span>

        {/* Ancla: destacada (la que más pondera) */}
        <div className="rounded-lg border-2 border-red-500 bg-red-600/25 p-3 shadow-[0_0_14px_-2px_rgba(239,68,68,0.5)]">
          {ratingRow(RATING_KEY_ANCLA)}
        </div>

        {/* Facetas = modificadores */}
        <div className="flex flex-col gap-3 rounded-lg border border-slate-600 bg-slate-800/60 p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Modificadores
          </span>
          {RATING_KEYS_FACETAS.map((key) => ratingRow(key))}
        </div>
      </div>
      )}

      {!soloIdentidad && !mostrarValoraciones && (
        <p className="text-xs text-slate-500">
          Las valoraciones de {esInvitado ? 'este invitado' : 'este jugador'} salen de los votos
          del grupo (pestaña «Valorar»).
        </p>
      )}

      {/* Flags del invitado: solo "habitual" (lo vota el grupo) + activo. */}
      {!soloIdentidad && esInvitado && (
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.habitual}
            onChange={(e) => setData((d) => ({ ...d, habitual: e.target.checked }))}
            className="h-4 w-4"
          />
          <span title="Viene a menudo: lo vota el grupo y cuenta en las estadísticas. Si lo dejas sin marcar, es un invitado puntual (datos estimados a 5, sin rastro en estadísticas).">
            Habitual (lo vota el grupo · cuenta en estadísticas)
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.activo}
            onChange={(e) => setData((d) => ({ ...d, activo: e.target.checked }))}
            className="h-4 w-4"
          />
          <span>Activo (disponible para convocar)</span>
        </label>
      </div>
      )}

      {/* Flags del jugador del plantel (solo admin / modo completo). */}
      {!soloIdentidad && !esInvitado && (
      <div className="flex flex-wrap gap-5 text-sm">
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.tocado}
              onChange={(e) => setData((d) => ({ ...d, tocado: e.target.checked }))}
              className="h-4 w-4"
            />
            <span title="Viene mermado a este partido (molestias, vuelve de lesión). Penaliza su puntaje.">
              Tocado / bajo de forma
            </span>
          </label>
          <p className="ml-6 text-xs text-slate-500">{AVISO_TOCADO}</p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.excluidoRotacion}
            onChange={(e) => setData((d) => ({ ...d, excluidoRotacion: e.target.checked }))}
            className="h-4 w-4"
          />
          <span title="No entra en la cola para hacer la alineación. No impide ser convocado para jugar.">
            Excluido de la rotación de turnos
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.reserva}
            onChange={(e) => setData((d) => ({ ...d, reserva: e.target.checked }))}
            className="h-4 w-4"
          />
          <span title="No es fijo del grupo; viene como reserva para completar. Es convocable, pero NUNCA entra en la rotación de alineadores.">
            Reserva (no fijo · nunca hace alineaciones)
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.activo}
            onChange={(e) => setData((d) => ({ ...d, activo: e.target.checked }))}
            className="h-4 w-4"
          />
          <span>Activo en el plantel</span>
        </label>
      </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!valid || guardando}
          className="rounded bg-emerald-600 px-4 py-2 font-medium text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {guardando
            ? 'Guardando…'
            : soloIdentidad
              ? 'Guardar mis datos'
              : initial
                ? 'Guardar cambios'
                : esInvitado
                  ? 'Añadir invitado'
                  : 'Añadir jugador'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:border-slate-400"
          >
            Cancelar
          </button>
        )}
        {guardado && (
          <span className="self-center text-sm font-medium text-emerald-400">✓ Guardado</span>
        )}
      </div>
    </form>
  )
}
