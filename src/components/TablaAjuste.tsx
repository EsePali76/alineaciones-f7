import { useState } from 'react'
import { useRotationStore } from '../store/rotationStore'
import { diferenciaParaProbabilidad, tablaAjuste } from '../domain/ajuste'

/**
 * «¿Cómo se calcula el ajuste?»: lo que gana o pierde el favorito y el débil según el
 * resultado, con un control para elegir el desequilibrio. Usa la misma función que el
 * cálculo real (`tablaAjuste`) y la K vigente: sin trampa ni cartón.
 */
export function TablaAjuste() {
  const k = useRotationStore((s) => s.eloK)
  const [pct, setPct] = useState(55)
  const prob = pct / 100
  const filas = tablaAjuste(prob, k)
  const dif = diferenciaParaProbabilidad(prob)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-sky-700/50 bg-sky-950/30 p-3 text-sm">
      <div>
        <label className="flex items-center justify-between gap-2 text-slate-300">
          <span>
            Favorito <b className="text-white">{pct}%</b> · Débil <b className="text-white">{100 - pct}%</b>
          </span>
          <span className="text-xs text-slate-400">
            {dif < 0.005 ? 'mismo nivel' : `≈ ${dif.toFixed(2)} pts de nivel medio`}
          </span>
        </label>
        <input
          type="range"
          min={50}
          max={95}
          step={1}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="mt-1 w-full accent-sky-500"
        />
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="py-1 pr-2 font-medium">Resultado</th>
            <th className="px-2 py-1 text-right font-medium">Favorito</th>
            <th className="py-1 pl-2 text-right font-medium">Débil</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.resultado} className="border-t border-slate-700/50">
              <td className="py-1 pr-2 text-slate-300">{f.resultado}</td>
              <td className="px-2 py-1 text-right">
                <Delta v={f.favorito} />
              </td>
              <td className="py-1 pl-2 text-right">
                <Delta v={f.debil} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Δ con signo y color, con tres decimales (con dos, el bonus y los tramos no se ven). */
export function Delta({ v }: { v: number }) {
  const color = v > 0.0005 ? 'text-emerald-400' : v < -0.0005 ? 'text-red-400' : 'text-slate-400'
  return (
    <span className={`whitespace-nowrap font-semibold tabular-nums ${color}`}>
      {v >= 0 ? '+' : '−'}
      {Math.abs(v).toFixed(3)}
    </span>
  )
}
