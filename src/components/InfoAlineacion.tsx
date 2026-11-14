import { useLineupsStore } from '../store/lineupsStore'
import { useRotationStore } from '../store/rotationStore'
import { ajustePorResultado, diferenciasMasComunes, DIFERENCIA_MAX } from '../domain/ajuste'
import { porcentajes } from '../domain/auditoria'
import { temporadaDe } from '../domain/season'
import { Delta } from './TablaAjuste'

/**
 * Información de transparencia de una alineación, común al editor (y su imagen) y a
 * la alineación confirmada que ve todo el mundo: si es la propuesta de la app o
 * cuánto la retocó quien alinea, y lo que se juega cada equipo en ajuste.
 */

/** «Alineación propuesta por la app ⚪ 50% · 🔴 50% · Santi: 2 cambios → ⚪ 58% · 🔴 42%». */
export function LineaPropuesta({
  auditoria,
  autorNombre,
  probA,
}: {
  auditoria: { cambios: number; probAppA: number }
  autorNombre: string
  probA: number
}) {
  return (
    <p className="mt-2 text-center text-sm text-slate-300">
      Alineación propuesta por la app {porcentajes(auditoria.probAppA)}
      {auditoria.cambios > 0 && (
        <>
          {' '}
          · <b className="text-amber-300">{autorNombre || 'Quien alinea'}</b>: {auditoria.cambios}{' '}
          {auditoria.cambios === 1 ? 'cambio' : 'cambios'} → {porcentajes(probA)}
        </>
      )}
    </p>
  )
}

/**
 * Lo que se lleva cada jugador de cada equipo (ajuste) según el resultado, solo con
 * las 3 diferencias de goles más habituales de la temporada (el ajuste depende de la
 * diferencia, no del marcador exacto).
 */
export function AjustePorResultado({ probA, temporada }: { probA: number; temporada: string }) {
  const lineups = useLineupsStore((s) => s.lineups)
  const k = useRotationStore((s) => s.eloK)
  const difs = diferenciasMasComunes(lineups.filter((l) => temporadaDe(l.fecha) === temporada))
  const porGoles = (d: number) => (d >= DIFERENCIA_MAX ? `${d} o más` : `${d}`)
  const filas = difs.flatMap((d) =>
    d === 0
      ? [{ txt: 'Empate', ...ajustePorResultado(probA, 0, k) }]
      : [
          { txt: `⚪ gana por ${porGoles(d)}`, ...ajustePorResultado(probA, d, k) },
          { txt: `🔴 gana por ${porGoles(d)}`, ...ajustePorResultado(probA, -d, k) },
        ],
  )
  return (
    <div className="mx-auto mt-2 w-full max-w-sm text-xs">
      <p className="text-center text-slate-400">
        Ajuste por jugador según el resultado
      </p>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr className="text-slate-400">
            <th className="py-0.5 text-left font-medium">Resultado</th>
            <th className="py-0.5 text-right font-medium">⚪</th>
            <th className="py-0.5 text-right font-medium">🔴</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.txt} className="border-t border-slate-700/50">
              <td className="py-0.5 text-slate-300">{f.txt}</td>
              <td className="py-0.5 text-right">
                <Delta v={f.a} />
              </td>
              <td className="py-0.5 text-right">
                <Delta v={f.b} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
