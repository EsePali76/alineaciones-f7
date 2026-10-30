/**
 * Probabilidad de victoria de cada equipo (la misma con la que se calcula el ajuste,
 * ver `domain/ajuste.ts`). Sustituye al antiguo «Equilibrio», que era el reparto del
 * nivel total y comprimía las diferencias (decisión de Santi, 2026-10-30): así en
 * todos los sitios se ve el mismo dato.
 */
export function ProbabilidadBar({ probA, compacta = false }: { probA: number; compacta?: boolean }) {
  const pctA = Math.round(probA * 100)
  const pctB = 100 - pctA
  if (compacta) {
    return (
      <span className="text-xs text-slate-400" title="Probabilidad de victoria según el nivel de cada equipo">
        Prob. victoria ⚪ {pctA}% · 🔴 {pctB}%
      </span>
    )
  }
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        <div className="bg-white" style={{ width: `${pctA}%` }} />
        <div className="bg-red-500" style={{ width: `${pctB}%` }} />
      </div>
      <p className="mt-1 text-center text-sm text-slate-400" title="Según el nivel medio de cada equipo">
        Prob. victoria ⚪ {pctA}% · 🔴 {pctB}%
      </p>
    </div>
  )
}
