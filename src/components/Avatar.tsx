/**
 * Avatar de jugador: foto recortada en círculo o, si no hay, una silueta genérica.
 * `ring` pinta un borde del color del equipo (A = blanco, B = rojo) para las fichas
 * del campo; sin `ring` lleva un borde neutro.
 *
 * `crossOrigin="anonymous"` es necesario para que la exportación a PNG del campo
 * (html-to-image) pueda capturar la foto sin "ensuciar" el canvas.
 */
export function Avatar({
  src,
  alt,
  className = 'h-8 w-8',
  ring = null,
  thick = false,
}: {
  src?: string
  alt?: string
  className?: string
  ring?: 'A' | 'B' | null
  /** Borde más ancho (para las fichas del campo, donde el color de equipo debe destacar). */
  thick?: boolean
}) {
  const borde =
    ring === 'A'
      ? 'border-white'
      : ring === 'B'
        ? 'border-red-400'
        : 'border-slate-600'
  const grosor = thick ? 'border-4' : 'border-2'
  const base = `shrink-0 overflow-hidden rounded-full ${grosor} ${borde} ${className}`

  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        crossOrigin="anonymous"
        className={`${base} bg-slate-700 object-cover`}
        draggable={false}
      />
    )
  }
  // Silueta genérica (sin foto).
  return (
    <span className={`${base} flex items-center justify-center bg-slate-700`} aria-label={alt}>
      <svg viewBox="0 0 24 24" className="h-[80%] w-[80%] text-slate-400" fill="currentColor">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6Z" />
      </svg>
    </span>
  )
}
