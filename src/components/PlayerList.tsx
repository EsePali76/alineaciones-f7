import { useState } from 'react'
import type { Player } from '../domain/types'
import { POSITION_LABEL, FOOT_LABEL, RATING_KEYS, DEFAULT_RATING } from '../domain/constants'
import { animoLabel } from '../domain/animo'
import { TocadoIcon } from './TocadoIcon'

interface PlayerListProps {
  players: Player[]
  onEdit: (player: Player) => void
  onRemove: (id: string) => void
  /** Si el usuario es admin (muestra acciones de editar/borrar). */
  isAdmin: boolean
}

/** Media simple de las valoraciones (sin valorar cuenta como 5 si es invitado, si no se ignora). */
function mediaValoracion(p: Player): number | null {
  const vals = RATING_KEYS.map((k) => p.ratings[k]).map((v) =>
    v === undefined ? (p.invitado ? DEFAULT_RATING : undefined) : v,
  )
  const present = vals.filter((v): v is number => v !== undefined)
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

type SortKey = 'nombre' | 'media'
type SortDir = 'asc' | 'desc'

export function PlayerList({ players, onEdit, onRemove, isAdmin }: PlayerListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  /** Cambia de columna (empieza asc) o alterna dirección si ya está activa. */
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  if (players.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
        {isAdmin
          ? 'Aún no hay jugadores. Añade el primero con el formulario de abajo.'
          : 'Aún no hay jugadores en el plantel.'}
      </p>
    )
  }

  const ordenados = [...players].sort((a, b) => {
    let cmp: number
    if (sortKey === 'media') {
      const ma = mediaValoracion(a)
      const mb = mediaValoracion(b)
      // Sin media (null) siempre al final, independientemente de la dirección.
      if (ma === null && mb === null) cmp = 0
      else if (ma === null) return 1
      else if (mb === null) return -1
      else cmp = ma - mb
    } else {
      cmp = a.nombre.localeCompare(b.nombre)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-400">{players.length} jugadores en el plantel</p>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-left text-slate-400">
              <th className="px-3 py-2 font-medium">
                <button
                  onClick={() => toggleSort('nombre')}
                  className="font-medium hover:text-slate-200"
                >
                  Nombre{sortArrow('nombre')}
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Edad</th>
              <th className="px-3 py-2 font-medium">Posiciones</th>
              <th className="px-3 py-2 font-medium">Perfil</th>
              <th className="px-3 py-2 font-medium">
                <button
                  onClick={() => toggleSort('media')}
                  className="font-medium hover:text-slate-200"
                >
                  Media{sortArrow('media')}
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Ánimo</th>
              {isAdmin && <th className="px-3 py-2 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {ordenados.map((p) => {
              const media = mediaValoracion(p)
              return (
                <tr
                  key={p.id}
                  className={
                    'border-t border-slate-700/60 ' +
                    (p.activo ? '' : 'opacity-50')
                  }
                >
                  <td className="px-3 py-2">
                    <span className="font-medium">{p.nombre}</span>
                    {p.invitado && (
                      <span className="ml-1 text-amber-400" title="Invitado · datos estimados">
                        *
                      </span>
                    )}
                    {p.tocado && <TocadoIcon className="ml-1" />}
                    {p.reserva && <span className="ml-2 text-xs text-sky-400">(reserva)</span>}
                    {!p.activo && <span className="ml-2 text-xs text-slate-500">(baja)</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{p.edad ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.posiciones.map((c) => (
                        <span
                          key={c}
                          title={POSITION_LABEL[c]}
                          className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-200"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{FOOT_LABEL[p.pierna]}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {media === null ? '—' : media.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                    {p.animoCalculado != null ? (
                      <span title={animoLabel(p.animoCalculado).texto}>
                        {animoLabel(p.animoCalculado).emoji} {p.animoCalculado.toFixed(1)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onEdit(p)}
                          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${p.nombre}?`)) onRemove(p.id)
                          }}
                          className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:border-red-500"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
