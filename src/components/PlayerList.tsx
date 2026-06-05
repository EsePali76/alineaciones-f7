import { useState } from 'react'
import type { Player } from '../domain/types'
import { POSITION_LABEL, FOOT_LABEL } from '../domain/constants'
import { weightedRatings } from '../domain/scoring'
import { animoLabel } from '../domain/animo'
import { TocadoIcon } from './TocadoIcon'
import { Avatar } from './Avatar'

interface PlayerListProps {
  players: Player[]
  onEdit: (player: Player) => void
  onRemove: (id: string) => void
  /** Si el usuario es admin (muestra acciones de editar/borrar). */
  isAdmin: boolean
  /** Sustantivo para el recuento y los mensajes ("jugadores en el plantel", "invitados"). */
  noun?: string
}

/**
 * Valoración mostrada en la columna: la MISMA media ponderada que usa el balanceador
 * (`weightedRatings`), sin los modificadores de situación (tocado / ánimo). Las facetas
 * vacías toman el valor de la general; si solo hay general, sale esa nota tal cual.
 */
function mediaValoracion(p: Player): number {
  return weightedRatings(p)
}

type SortKey = 'nombre' | 'edad' | 'media'
type SortDir = 'asc' | 'desc'

export function PlayerList({
  players,
  onEdit,
  onRemove,
  isAdmin,
  noun = 'jugadores en el plantel',
}: PlayerListProps) {
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
          ? 'Aún no hay nadie. Añade el primero con el formulario de abajo.'
          : `Aún no hay ${noun}.`}
      </p>
    )
  }

  const ordenados = [...players].sort((a, b) => {
    let cmp: number
    if (sortKey === 'media') {
      cmp = mediaValoracion(a) - mediaValoracion(b)
    } else if (sortKey === 'edad') {
      // Sin edad siempre al final, independientemente de la dirección.
      const ea = a.edad ?? null
      const eb = b.edad ?? null
      if (ea === null && eb === null) cmp = 0
      else if (ea === null) return 1
      else if (eb === null) return -1
      else cmp = ea - eb
    } else {
      cmp = a.nombre.localeCompare(b.nombre)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-400">
        {players.length} {noun}
      </p>
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
              <th className="px-3 py-2 font-medium">
                <button
                  onClick={() => toggleSort('edad')}
                  className="font-medium hover:text-slate-200"
                >
                  Edad{sortArrow('edad')}
                </button>
              </th>
              <th className="px-3 py-2 font-medium">Posiciones</th>
              <th className="px-3 py-2 font-medium">Perfil</th>
              <th className="px-3 py-2 font-medium">
                <button
                  onClick={() => toggleSort('media')}
                  className="font-medium hover:text-slate-200"
                >
                  Valoración{sortArrow('media')}
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
                    <div className="flex items-center gap-2">
                      <Avatar src={p.fotoUrl} alt={p.nombre} className="h-7 w-7" />
                      <span>
                        <span className="font-medium">{p.nombre}</span>
                        {p.invitado && !p.habitual && (
                          <span className="ml-2 text-xs text-amber-400">(no habitual)</span>
                        )}
                        {p.tocado && <TocadoIcon className="ml-1" />}
                        {p.reserva && <span className="ml-2 text-xs text-sky-400">(reserva)</span>}
                        {!p.activo && <span className="ml-2 text-xs text-slate-500">(baja)</span>}
                      </span>
                    </div>
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
                  <td className="px-3 py-2 text-slate-300">{media.toFixed(1)}</td>
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
