import { useRef, useState } from 'react'
import type { Player } from '../domain/types'
import { fotoVisible, nombreVisible } from '../domain/types'
import { asignarFormacion, type FieldLine, type Formacion } from '../domain/formation'
import { POSITION_LABEL } from '../domain/constants'
import type { TeamBalance } from '../domain/balancer'
import { useGeneratorStore } from '../store/generatorStore'
import { TocadoIcon } from './TocadoIcon'
import { Avatar } from './Avatar'

const ORDEN_BANDAS: FieldLine[] = ['POR', 'DEF', 'MED', 'ATA']

/** Profundidad (x en %) de cada banda para el equipo A (ataca hacia el centro/derecha). */
const X_BANDA_A: Record<FieldLine, number> = { POR: 6, DEF: 19, MED: 31, ATA: 43 }

/** Rango vertical (Y en %) que ocupa cada banda: define cuánto se separan los jugadores. */
const Y_RANGO: Record<FieldLine, [number, number]> = {
  POR: [50, 50],
  DEF: [15, 85], // defensa abierta (laterales a los costados)
  MED: [40, 60], // centrocampistas juntos y centrados
  ATA: [30, 70], // delanteros algo más juntos
}

/** ¿Juega de banda (lateral/extremo)? Se mira su posición preferida. */
function esBanda(p: Player): boolean {
  const pref = p.posiciones[0]
  return pref === 'CAR' || pref === 'EXT'
}

/**
 * Clave de orden vertical dentro de una línea: las bandas van a los extremos según
 * el PERFIL preferido (izquierdo arriba, derecho abajo) y los interiores al centro.
 * El perfil "Ambos" queda en medio → cae al flanco que quede libre al repartir.
 */
function ordenVertical(p: Player): number {
  if (!esBanda(p)) return 1 // interior → centro
  if (p.pierna === 'izq') return 0 // perfil izquierdo → banda izquierda (arriba)
  if (p.pierna === 'der') return 2 // perfil derecho → banda derecha (abajo)
  return 1 // perfil "Ambos" → flexible, al flanco libre
}

/** Reparte k jugadores a lo ancho del campo (eje Y, en %) dentro del rango de la banda. */
function repartoY(k: number, [top, bottom]: [number, number]): number[] {
  if (k <= 1) return [(top + bottom) / 2]
  return Array.from({ length: k }, (_, i) => top + ((bottom - top) * i) / (k - 1))
}

interface Punto {
  player: Player
  x: number
  y: number
}

/** Calcula las posiciones (x,y en %) de un equipo. `lado` 'A' = izquierda, 'B' = derecha (espejo). */
function posiciones(team: Player[], lado: 'A' | 'B', formacion: Formacion): Punto[] {
  const asignaciones = asignarFormacion(team, formacion.cupos)
  const puntos: Punto[] = []
  for (const banda of ORDEN_BANDAS) {
    const enBanda = asignaciones
      .filter((a) => a.linea === banda)
      .map((a) => a.player)
      // Ordena por lado para que laterales/extremos caigan en las bandas.
      .sort((a, b) => ordenVertical(a) - ordenVertical(b))
    const ys = repartoY(enBanda.length, Y_RANGO[banda])
    const xBase = X_BANDA_A[banda]
    const x = lado === 'A' ? xBase : 100 - xBase
    // El equipo B ataca hacia el lado contrario: se espeja también en vertical para
    // que la pierna/lado (zurdo a su izquierda, diestro a su derecha) salga correcta.
    enBanda.forEach((player, i) => {
      const y = lado === 'A' ? ys[i] : 100 - ys[i]
      puntos.push({ player, x, y })
    })
  }
  return puntos
}

/**
 * Orden de puestos AUTOMÁTICO de un equipo (ids en el orden en que se dibujan las
 * fichas). Sirve para "congelar" la colocación al confirmar aunque no se haya movido
 * ninguna ficha, de modo que el historial reproduzca el campo idéntico para siempre,
 * independientemente de cómo cambien después las valoraciones de los jugadores.
 */
export function ordenAutomatico(team: Player[], lado: 'A' | 'B', formacion: Formacion): string[] {
  return posiciones(team, lado, formacion).map((p) => p.player.id)
}

/** Aplica una colocación manual (placement) sobre los puntos automáticos, si es válida. */
function aplicarPlacement(auto: Punto[], placement: string[] | null): Punto[] {
  if (!placement || placement.length !== auto.length) return auto
  const idsAuto = new Set(auto.map((p) => p.player.id))
  if (!placement.every((id) => idsAuto.has(id))) return auto
  const porId = new Map(auto.map((p) => [p.player.id, p.player]))
  // Los slots (x,y) se mantienen; cambia qué jugador ocupa cada uno según el placement.
  return auto.map((pt, i) => ({ player: porId.get(placement[i])!, x: pt.x, y: pt.y }))
}

function Ficha({
  punto,
  lado,
  onDrop,
  readOnly = false,
  marca,
  tocado,
}: {
  punto: Punto
  lado: 'A' | 'B'
  /** Se llama al soltar la ficha: el padre resuelve por coordenadas sobre qué ficha se suelta. */
  onDrop: (dragId: string, lado: 'A' | 'B', clientX: number, clientY: number) => void
  readOnly?: boolean
  /** Goles/asistencias del jugador en este partido (solo en la vista del historial). */
  marca?: { goles: number; asist: number }
  /** Si jugó tocado (ya resuelto por FieldView: foto del partido en historial, flag en vivo si no). */
  tocado: boolean
}) {
  const { player, x, y } = punto
  // Arrastre con Pointer Events (unifica ratón + táctil; el HTML5 DnD no funciona en móvil).
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null)

  const finDrag = () => {
    startRef.current = null
    setOffset(null)
  }

  return (
    <div
      onPointerDown={(e) => {
        if (readOnly) return
        // Evita que el navegador móvil inicie su propia gesto (menú "guardar imagen",
        // selección de texto…) que roba el arrastre.
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        startRef.current = { x: e.clientX, y: e.clientY }
        setOffset({ dx: 0, dy: 0 })
      }}
      onContextMenu={(e) => !readOnly && e.preventDefault()}
      onPointerMove={(e) => {
        if (!startRef.current) return
        setOffset({ dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y })
      }}
      onPointerUp={(e) => {
        if (!startRef.current) return
        const moved = Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y)
        finDrag()
        // Solo cuenta como arrastre si el dedo/ratón se movió algo (evita swaps por un simple toque).
        if (moved > 6) onDrop(player.id, lado, e.clientX, e.clientY)
      }}
      onPointerCancel={finDrag}
      className={
        'absolute flex flex-col items-center ' +
        (readOnly ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing') +
        (offset ? ' z-20' : '')
      }
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translate(${offset?.dx ?? 0}px, ${offset?.dy ?? 0}px)`,
        // Suprime el callout de pulsación larga en móvil (iOS/Android); hereda a la foto.
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      title={
        readOnly
          ? `${nombreVisible(player)} · ${POSITION_LABEL[player.posiciones[0]]}`
          : `${nombreVisible(player)} · ${POSITION_LABEL[player.posiciones[0]]} — arrástralo sobre otra ficha para intercambiar (al otro equipo, con confirmación)`
      }
    >
      <Avatar src={fotoVisible(player)} alt={nombreVisible(player)} className="h-11 w-11 shadow" ring={lado} thick />
      <span className="mt-0.5 whitespace-nowrap rounded bg-black/65 px-1.5 text-[0.8rem] font-medium leading-tight text-white">
        {nombreVisible(player)}
        {player.invitado && <span className="text-amber-300">*</span>}
        {tocado && <TocadoIcon className="ml-0.5" />}
      </span>
      {marca && (marca.goles > 0 || marca.asist > 0) && (
        <span className="mt-0.5 flex max-w-[5em] flex-wrap justify-center gap-px text-[0.85rem] leading-none">
          {Array.from({ length: marca.goles }, (_, i) => (
            <span key={`g${i}`} className="text-[1.05rem]">
              ⚽
            </span>
          ))}
          {Array.from({ length: marca.asist }, (_, i) => (
            <span key={`a${i}`}>🅰️</span>
          ))}
        </span>
      )}
    </div>
  )
}

export function FieldView({
  balance,
  formacionA,
  formacionB,
  onCrossSwap,
  readOnly = false,
  placementA: placementAProp,
  placementB: placementBProp,
  marcas,
  tocadoIds,
}: {
  balance: TeamBalance
  formacionA: Formacion
  formacionB: Formacion
  onCrossSwap: (dragId: string, dropId: string) => void
  /** Solo lectura: sin arrastrar fichas (vista compartida de la alineación confirmada). */
  readOnly?: boolean
  /** Colocación a usar (si no, se toma del store de generación). */
  placementA?: string[] | null
  placementB?: string[] | null
  /** Goles/asistencias por jugador, para pintar ⚽/🅰️ sobre cada ficha (vista de historial). */
  marcas?: Map<string, { goles: number; asist: number }>
  /**
   * Quién jugó tocado en ESTE partido (foto del historial). Si se pasa, manda sobre el
   * flag `tocado` en vivo del jugador; si no (vistas de la semana actual), se usa el flag.
   */
  tocadoIds?: Set<string>
}) {
  const storePlacementA = useGeneratorStore((s) => s.placementA)
  const storePlacementB = useGeneratorStore((s) => s.placementB)
  const setPlacementA = useGeneratorStore((s) => s.setPlacementA)
  const setPlacementB = useGeneratorStore((s) => s.setPlacementB)

  const placementA = readOnly ? placementAProp ?? null : storePlacementA
  const placementB = readOnly ? placementBProp ?? null : storePlacementB

  // Tocado: en el historial manda la foto del partido (`tocadoIds`); en las vistas en vivo, el flag.
  const esTocado = (p: Player) => (tocadoIds ? tocadoIds.has(p.id) : p.tocado)

  const fieldRef = useRef<HTMLDivElement>(null)

  const puntosA = aplicarPlacement(posiciones(balance.teamA, 'A', formacionA), placementA)
  const puntosB = aplicarPlacement(posiciones(balance.teamB, 'B', formacionB), placementB)

  // Intercambia dos fichas del mismo equipo: cambian de puesto en el campo.
  const handleSwap = (lado: 'A' | 'B', dragId: string, dropId: string) => {
    if (readOnly || dragId === dropId) return
    const puntos = lado === 'A' ? puntosA : puntosB
    const orden = puntos.map((p) => p.player.id)
    const i = orden.indexOf(dragId)
    const j = orden.indexOf(dropId)
    if (i < 0 || j < 0) return
    ;[orden[i], orden[j]] = [orden[j], orden[i]]
    ;(lado === 'A' ? setPlacementA : setPlacementB)(orden)
  }

  // Al soltar una ficha, busca por coordenadas la ficha más cercana al punto de suelta
  // (hit-testing manual: los Pointer Events no traen un "drop target" como el HTML5 DnD).
  const handleDrop = (dragId: string, ladoDrag: 'A' | 'B', clientX: number, clientY: number) => {
    if (readOnly) return
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = clientX - rect.left
    const py = clientY - rect.top
    let best: { player: Player; lado: 'A' | 'B' } | null = null
    let bestDist = Infinity
    for (const pt of puntosA) {
      if (pt.player.id === dragId) continue
      const d = Math.hypot((pt.x / 100) * rect.width - px, (pt.y / 100) * rect.height - py)
      if (d < bestDist) (bestDist = d), (best = { player: pt.player, lado: 'A' })
    }
    for (const pt of puntosB) {
      if (pt.player.id === dragId) continue
      const d = Math.hypot((pt.x / 100) * rect.width - px, (pt.y / 100) * rect.height - py)
      if (d < bestDist) (bestDist = d), (best = { player: pt.player, lado: 'B' })
    }
    // Debe soltarse razonablemente cerca de una ficha; si no, se ignora (soltar en vacío = cancelar).
    if (!best || bestDist > 60) return
    // Mismo equipo: intercambia puesto. Distinto equipo: cambia de bando (con confirmación).
    if (best.lado === ladoDrag) handleSwap(ladoDrag, dragId, best.player.id)
    else onCrossSwap(dragId, best.player.id)
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-700">
      <div ref={fieldRef} className="relative aspect-[3/2] w-full">
        {/* Campo */}
        <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <rect x="0" y="0" width="300" height="200" fill="#15803d" />
          {/* Bandas de césped alternas */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={i * 50}
              y="0"
              width="50"
              height="200"
              fill={i % 2 === 0 ? '#16a34a' : '#15803d'}
            />
          ))}
          <g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" fill="none">
            <rect x="4" y="4" width="292" height="192" />
            <line x1="150" y1="4" x2="150" y2="196" />
            <circle cx="150" cy="100" r="28" />
            <circle cx="150" cy="100" r="1.5" fill="#ffffff" />
            {/* Áreas */}
            <rect x="4" y="55" width="36" height="90" />
            <rect x="260" y="55" width="36" height="90" />
            {/* Porterías */}
            <rect x="0" y="80" width="4" height="40" />
            <rect x="296" y="80" width="4" height="40" />
          </g>
        </svg>

        {/* Jugadores */}
        {puntosA.map((pt) => (
          <Ficha key={pt.player.id} punto={pt} lado="A" onDrop={handleDrop} readOnly={readOnly} marca={marcas?.get(pt.player.id)} tocado={esTocado(pt.player)} />
        ))}
        {puntosB.map((pt) => (
          <Ficha key={pt.player.id} punto={pt} lado="B" onDrop={handleDrop} readOnly={readOnly} marca={marcas?.get(pt.player.id)} tocado={esTocado(pt.player)} />
        ))}

        {/* Etiquetas de equipo */}
        <span className="absolute left-2 top-1 rounded bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-900">
          Equipo A
        </span>
        <span className="absolute right-2 top-1 rounded bg-red-600/90 px-2 py-0.5 text-xs font-semibold text-white">
          Equipo B
        </span>
      </div>
    </div>
  )
}
