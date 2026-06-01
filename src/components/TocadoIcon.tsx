/** Indicador visual de jugador "tocado / en baja forma": una cruz roja médica. */
export function TocadoIcon({ className = '' }: { className?: string }) {
  return (
    <span
      title="Tocado / en baja forma · penaliza su puntaje"
      aria-label="tocado"
      className={'font-bold text-red-500 ' + className}
    >
      ✚
    </span>
  )
}
