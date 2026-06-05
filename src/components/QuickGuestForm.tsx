import { useState } from 'react'
import type { PlayerInput } from '../store/playersStore'
import type { PositionCode } from '../domain/types'
import { POSITIONS, MIN_RATING, MAX_RATING, ratingLabel } from '../domain/constants'

/**
 * Alta rápida de un invitado PUNTUAL desde Equipos (la hace quien arma la alineación).
 * Mínimo imprescindible: nombre. Opcionalmente posiciones (con prioridad: la 1ª es la
 * preferida) y la valoración general. Sin posiciones → el sistema lo coloca donde
 * quepa; sin valoración → todo a 5. Se da de alta como invitado no habitual y se
 * autoconvoca.
 */
export function QuickGuestForm({
  onAdd,
}: {
  onAdd: (input: PlayerInput) => Promise<void> | void
}) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [posiciones, setPosiciones] = useState<PositionCode[]>([])
  const [general, setGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)

  const toggle = (code: PositionCode) =>
    setPosiciones((ps) => (ps.includes(code) ? ps.filter((c) => c !== code) : [...ps, code]))

  const limpiar = () => {
    setNombre('')
    setPosiciones([])
    setGeneral('')
  }

  const añadir = async () => {
    const nom = nombre.trim()
    if (!nom) return
    const g = general === '' ? undefined : Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(Number(general))))
    const input: PlayerInput = {
      nombre: nom,
      posiciones,
      pierna: 'der',
      ratings: g != null ? { general: g } : {},
      invitado: true,
      habitual: false,
      tocado: false,
      excluidoRotacion: false,
      reserva: false,
      activo: true,
    }
    setGuardando(true)
    try {
      await onAdd(input)
      limpiar()
      setAbierto(false)
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="self-start rounded border border-dashed border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-400"
      >
        + Añadir nuevo invitado
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-600 bg-slate-900/60 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-200">Nuevo invitado puntual</span>
        <span className="text-xs text-slate-500">se añade convocado · datos estimados</span>
      </div>

      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            añadir()
          }
        }}
        className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
      />

      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">
          Posiciones (opcional · la 1ª que marques es la preferida; sin posiciones, juega donde quepa)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((p) => {
            const idx = posiciones.indexOf(p.code)
            const on = idx >= 0
            return (
              <button
                type="button"
                key={p.code}
                onClick={() => toggle(p.code)}
                title={p.descripcion}
                className={
                  'rounded-full border px-2.5 py-1 text-xs transition-colors ' +
                  (on
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
                }
              >
                {on && <span className="mr-0.5 opacity-80">{idx + 1}.</span>}
                {p.code}
              </button>
            )
          })}
        </div>
      </div>

      <label className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Valoración general (opcional, 0-10):</span>
        <input
          type="number"
          min={MIN_RATING}
          max={MAX_RATING}
          step={1}
          value={general}
          onChange={(e) => setGeneral(e.target.value)}
          placeholder="5"
          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1"
        />
        <span className="text-xs text-slate-500">
          {general === '' ? 'sin valorar → 5' : ratingLabel(Number(general))}
        </span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={añadir}
          disabled={guardando || !nombre.trim()}
          className="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-50"
        >
          {guardando ? 'Añadiendo…' : 'Añadir y convocar'}
        </button>
        <button
          onClick={() => {
            limpiar()
            setAbierto(false)
          }}
          className="rounded border border-slate-600 px-3 py-1.5 text-slate-300 hover:border-slate-400"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
