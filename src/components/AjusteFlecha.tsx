/**
 * Flecha del ajuste por resultados (▲ +0.3 / ▼ −0.2). Por debajo de 0,05 no se
 * pinta nada: redondeado a una décima sería un «+0.0» que no dice nada.
 */
export function AjusteFlecha({ valor }: { valor: number | undefined }) {
  if (valor == null || Math.abs(valor) < 0.05) return <span className="text-slate-600">—</span>
  const sube = valor > 0
  return (
    <span
      className={'whitespace-nowrap text-xs font-semibold ' + (sube ? 'text-emerald-400' : 'text-red-400')}
      title="Lo que ha subido o bajado su nota por los resultados de sus partidos"
    >
      {sube ? '▲ +' : '▼ −'}
      {Math.abs(valor).toFixed(1)}
    </span>
  )
}
