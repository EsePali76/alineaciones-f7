import type { Player } from '../domain/types'
import { POSITION_LABEL, RATING_KEYS, DEFAULT_RATING } from '../domain/constants'
import { TocadoIcon } from './TocadoIcon'

interface PlayerListProps {
  players: Player[]
  onEdit: (player: Player) => void
  onRemove: (id: string) => void
}

/** Media de las 5 valoraciones (sin valorar cuenta como 3 si es invitado, si no se ignora). */
function mediaValoracion(p: Player): number | null {
  const vals = RATING_KEYS.map((k) => p.ratings[k]).map((v) =>
    v === undefined ? (p.invitado ? DEFAULT_RATING : undefined) : v,
  )
  const present = vals.filter((v): v is number => v !== undefined)
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

export function PlayerList({ players, onEdit, onRemove }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
        Aún no hay jugadores. Añade el primero con el formulario.
      </p>
    )
  }

  const ordenados = [...players].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-400">{players.length} jugadores en el plantel</p>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Edad</th>
              <th className="px-3 py-2 font-medium">Posiciones</th>
              <th className="px-3 py-2 font-medium">Pierna</th>
              <th className="px-3 py-2 font-medium">Media</th>
              <th className="px-3 py-2 font-medium"></th>
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
                  <td className="px-3 py-2 text-slate-400 capitalize">{p.pierna}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {media === null ? '—' : media.toFixed(1)}
                  </td>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
