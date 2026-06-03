import { TODAS } from '../domain/season'

/** Selector de temporada: una pastilla por temporada disponible + «Totales». */
export function SeasonPicker({
  temporadas,
  valor,
  onChange,
  incluirTotales = true,
  siempreVisible = false,
}: {
  temporadas: string[]
  valor: string
  onChange: (v: string) => void
  /** Añade la pastilla «Totales» (agregado de todas). Desactívalo si ya hay otra pestaña para ello. */
  incluirTotales?: boolean
  /** Muestra el selector aunque solo haya una temporada (útil cuando es el único modo de filtrar). */
  siempreVisible?: boolean
}) {
  if (temporadas.length === 0) return null
  if (!siempreVisible && temporadas.length <= 1) return null
  const opciones = incluirTotales ? [...temporadas, TODAS] : temporadas
  return (
    <div className="flex flex-wrap gap-1">
      {opciones.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
            (valor === t
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-600 text-slate-400 hover:border-slate-400')
          }
        >
          {t === TODAS ? t : `Temporada ${t}`}
        </button>
      ))}
    </div>
  )
}
