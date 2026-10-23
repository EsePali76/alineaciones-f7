/**
 * Flecha del ajuste por resultados (▲ +0.31 / ▼ −0.18). Dos decimales, como la
 * valoración, porque con K baja las diferencias son de centésimas. Por debajo de
 * 0,005 no se pinta nada: redondeado sería un «+0.00» que no dice nada.
 */
export function AjusteFlecha({ valor }: { valor: number | undefined }) {
  if (valor == null || Math.abs(valor) < 0.005) return <span className="text-slate-600">—</span>
  const sube = valor > 0
  return (
    <span
      className={'whitespace-nowrap text-xs font-semibold ' + (sube ? 'text-emerald-400' : 'text-red-400')}
      title="Lo que ha subido o bajado su nota por los resultados de sus partidos"
    >
      {sube ? '▲ +' : '▼ −'}
      {Math.abs(valor).toFixed(2)}
    </span>
  )
}
