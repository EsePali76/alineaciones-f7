import { useState } from 'react'
import type { Player } from '../domain/types'
import { fotoVisible } from '../domain/types'
import { POSITION_LABEL, FOOT_LABEL } from '../domain/constants'
import { weightedRatings } from '../domain/scoring'
import { animoLabel } from '../domain/animo'
import { edadVisible } from '../domain/types'
import { Avatar } from './Avatar'

interface PlayerListProps {
  players: Player[]
  onEdit: (player: Player) => void
  onRemove: (id: string) => void
  /** Si el usuario es admin (muestra acciones de editar/borrar). */
  isAdmin: boolean
  /** Sustantivo para el recuento y los mensajes ("jugadores en el plantel", "invitados"). */
  noun?: string
  /** Id del jugador que se está editando ahora mismo (se resalta su fila). */
  editingId?: string | null
}

/**
 * Valoración mostrada en la columna: la MISMA media ponderada que usa el balanceador
 * (`weightedRatings`), sin el modificador de ánimo. Las facetas
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
  editingId = null,
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
      // Se ordena por la edad MOSTRADA: cada jugador puede llevar un número
      // distinto de temporadas desde que se anotó, así que el orden por el dato
      // crudo no tiene por qué coincidir.
      const ea = edadVisible(a) ?? null
      const eb = edadVisible(b) ?? null
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
                    (p.id === editingId ? 'bg-emerald-900/40 ring-1 ring-inset ring-emerald-500/60 ' : '') +
                    (p.activo ? '' : 'opacity-50')
                  }
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar src={fotoVisible(p)} alt={p.nombre} className="h-7 w-7" />
                      <span>
                        <span className="font-medium">{p.nombre}</span>
                        {p.invitado && !p.habitual && (
                          <span className="ml-2 text-xs text-amber-400">(no habitual)</span>
                        )}
                        {p.reserva && <span className="ml-2 text-xs text-sky-400">(reserva)</span>}
                        {!p.activo && <span className="ml-2 text-xs text-slate-500">(baja)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{edadVisible(p) ?? '—'}</td>
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
                    <AnimoPill valor={p.animoCalculado} />
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

/**
 * Ánimo de un jugador: el emoji dice CÓMO está y el color CUÁNTO.
 *
 * Se quitó el número (era el índice interno 0-10 y no se puede interpretar sin saber
 * cómo se calcula). Para que siga notándose la intensidad, el emoji va en una
 * pastilla con una rampa DIVERGENTE centrada en el gris: verde arriba, ámbar y rojo
 * abajo. Color y emoji dicen lo mismo a propósito —quien no distinga bien los tonos
 * tiene la cara, y el tooltip da la palabra—, que es la razón de no fiarlo al color
 * solo.
 */
const ANIMO_TONO: Record<number, string> = {
  2: 'border-emerald-500/60 bg-emerald-500/20',
  1: 'border-lime-500/50 bg-lime-500/15',
  0: 'border-slate-600 bg-slate-700/40',
  [-1]: 'border-amber-500/50 bg-amber-500/15',
  [-2]: 'border-red-500/60 bg-red-500/20',
}

function AnimoPill({ valor }: { valor: number | undefined }) {
  if (valor == null) return <span className="text-slate-600">—</span>
  const { emoji, texto, nivel } = animoLabel(valor)
  return (
    <span
      title={texto}
      className={
        'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-base leading-none ' +
        ANIMO_TONO[nivel]
      }
    >
      {emoji}
    </span>
  )
}
