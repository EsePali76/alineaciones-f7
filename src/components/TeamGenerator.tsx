import { useMemo, useRef, useState } from 'react'
import { toBlob, toPng } from 'html-to-image'
import { usePlayersStore } from '../store/playersStore'
import { useLineupsStore } from '../store/lineupsStore'
import { useGeneratorStore } from '../store/generatorStore'
import { useAuthStore } from '../store/authStore'
import type { Player } from '../domain/types'
import { balanceTeams, evaluatePartition, type TeamBalance } from '../domain/balancer'
import { playerScore } from '../domain/scoring'
import { formatForWhatsApp } from '../domain/whatsapp'
import { formacionesDe, formacionPorNombre, type Formacion } from '../domain/formation'
import { FieldView } from './FieldView'
import { TocadoIcon } from './TocadoIcon'

export function TeamGenerator() {
  const players = usePlayersStore((s) => s.players)
  const lineups = useLineupsStore((s) => s.lineups)
  const addLineup = useLineupsStore((s) => s.addLineup)

  // Estado de la sesión de generación en store persistente (sobrevive a cambios de pestaña).
  const convocadosIds = useGeneratorStore((s) => s.convocados)
  const jugadoresPorEquipo = useGeneratorStore((s) => s.jugadoresPorEquipo)
  const formacionNombreA = useGeneratorStore((s) => s.formacionNombreA)
  const formacionNombreB = useGeneratorStore((s) => s.formacionNombreB)
  const balance = useGeneratorStore((s) => s.balance)
  const confirmada = useGeneratorStore((s) => s.confirmada)
  const setConvocados = useGeneratorStore((s) => s.setConvocados)
  const setJugadoresPorEquipo = useGeneratorStore((s) => s.setJugadoresPorEquipo)
  const setFormacionNombreA = useGeneratorStore((s) => s.setFormacionNombreA)
  const setFormacionNombreB = useGeneratorStore((s) => s.setFormacionNombreB)
  const setPlacementA = useGeneratorStore((s) => s.setPlacementA)
  const setPlacementB = useGeneratorStore((s) => s.setPlacementB)
  const setBalance = useGeneratorStore((s) => s.setBalance)
  const setConfirmada = useGeneratorStore((s) => s.setConfirmada)

  const [copiado, setCopiado] = useState(false)

  const disponibles = useMemo(
    () => players.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [players],
  )
  const convocados = useMemo(() => new Set(convocadosIds), [convocadosIds])

  const formaciones = formacionesDe(jugadoresPorEquipo)
  const formacionA = formacionPorNombre(jugadoresPorEquipo, formacionNombreA) ?? formaciones[0]
  const formacionB = formacionPorNombre(jugadoresPorEquipo, formacionNombreB) ?? formaciones[0]

  // Al cambiar de formato, ajusta las formaciones a unas válidas y descarta la colocación manual.
  const cambiarFormato = (n: 6 | 7 | 8) => {
    setJugadoresPorEquipo(n)
    const lista = formacionesDe(n)
    if (!lista.some((f) => f.nombre === formacionNombreA)) setFormacionNombreA(lista[0].nombre)
    if (!lista.some((f) => f.nombre === formacionNombreB)) setFormacionNombreB(lista[0].nombre)
    setPlacementA(null)
    setPlacementB(null)
  }

  // Cambiar la formación de un equipo descarta su colocación manual (los puestos cambian).
  const cambiarFormacionA = (nombre: string) => {
    setFormacionNombreA(nombre)
    setPlacementA(null)
  }
  const cambiarFormacionB = (nombre: string) => {
    setFormacionNombreB(nombre)
    setPlacementB(null)
  }

  // Refresca la alineación generada con los datos ACTUALES de los jugadores (por id),
  // para que editar un jugador (quitar "tocado", renombrar…) se vea sin regenerar.
  const balanceVivo = useMemo(() => {
    if (!balance) return null
    const porId = new Map(players.map((p) => [p.id, p]))
    const teamA = balance.teamA.map((p) => porId.get(p.id) ?? p)
    const teamB = balance.teamB.map((p) => porId.get(p.id) ?? p)
    const re = evaluatePartition(teamA, teamB, { history: lineups })
    return { ...re, method: balance.method, evaluated: balance.evaluated }
  }, [balance, players, lineups])

  const toggle = (id: string) => {
    const next = new Set(convocados)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setConvocados([...next])
  }

  const seleccionados = disponibles.filter((p) => convocados.has(p.id))
  const nConvocados = seleccionados.length
  const objetivo = jugadoresPorEquipo * 2 // 14 (7v7) o 16 (8v8)
  const faltan = objetivo - nConvocados
  const completo = faltan === 0

  const generar = () => {
    // Pasa el historial de alineaciones confirmadas para evitar repetir parejas.
    const result = balanceTeams(seleccionados, { history: lineups })
    setBalance(result)
    setCopiado(false)
    setConfirmada(false)
    // Nueva alineación → descarta cualquier colocación manual previa.
    setPlacementA(null)
    setPlacementB(null)
  }

  const confirmar = () => {
    if (!balanceVivo) return
    addLineup(
      balanceVivo.teamA.map((p) => p.id),
      balanceVivo.teamB.map((p) => p.id),
    )
    setConfirmada(true)
  }

  // Cambia dos jugadores de equipo (arrastrando entre bandos), bajo confirmación.
  const handleCrossSwap = (id1: string, id2: string) => {
    if (!balanceVivo) return
    const enA = balanceVivo.teamA.some((p) => p.id === id1) ? id1 : id2
    const enB = enA === id1 ? id2 : id1
    const pA = balanceVivo.teamA.find((p) => p.id === enA)
    const pB = balanceVivo.teamB.find((p) => p.id === enB)
    if (!pA || !pB) return
    if (!confirm(`¿Cambiar de equipo a ${pA.nombre} (⚪ A) y ${pB.nombre} (🔴 B)?`)) return

    const nuevoA = balanceVivo.teamA.map((p) => (p.id === enA ? pB : p))
    const nuevoB = balanceVivo.teamB.map((p) => (p.id === enB ? pA : p))
    const nuevo = evaluatePartition(nuevoA, nuevoB, { history: lineups })
    setBalance({ ...nuevo, method: 'manual', evaluated: 0 })
    setPlacementA(null)
    setPlacementB(null)
    setConfirmada(false)
  }

  const copiar = async () => {
    if (!balance) return
    const texto = formatForWhatsApp(balance)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Fallback: si el portapapeles no está disponible, lo mostramos para copiar a mano.
      window.prompt('Copia el texto manualmente:', texto)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Selección de convocados */}
      <section className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Convocados de esta semana</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className={completo ? 'text-emerald-400' : 'text-slate-400'}>
              {nConvocados} / {objetivo} seleccionados
            </span>
            <button
              onClick={() => setConvocados(disponibles.map((p) => p.id))}
              className="rounded border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
            >
              Todos
            </button>
            <button
              onClick={() => setConvocados([])}
              className="rounded border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
            >
              Ninguno
            </button>
          </div>
        </div>

        {/* Selector de formato */}
        <div className="flex items-center gap-2 text-sm">
          <span className="w-20 text-slate-400">Formato:</span>
          {([6, 7, 8] as const).map((n) => (
            <button
              key={n}
              onClick={() => cambiarFormato(n)}
              className={
                'rounded border px-3 py-1 transition-colors ' +
                (jugadoresPorEquipo === n
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
              }
            >
              {n} vs {n} <span className="opacity-70">({n * 2})</span>
            </button>
          ))}
        </div>

        {/* Selectores de formación por equipo */}
        <FormacionSelector
          label="Formación A"
          labelClass="text-slate-200"
          formaciones={formaciones}
          seleccionada={formacionA.nombre}
          onSelect={cambiarFormacionA}
        />
        <FormacionSelector
          label="Formación B"
          labelClass="text-red-400"
          formaciones={formaciones}
          seleccionada={formacionB.nombre}
          onSelect={cambiarFormacionB}
        />

        {disponibles.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay jugadores activos. Da de alta el plantel en la pestaña «Plantel».
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {disponibles.map((p) => {
              const on = convocados.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={
                    'flex items-center justify-between gap-1 rounded border px-2 py-1.5 text-left text-sm transition-colors ' +
                    (on
                      ? 'border-emerald-500 bg-emerald-600/80 text-white'
                      : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
                  }
                >
                  <span className="truncate">
                    {p.nombre}
                    {p.invitado && <span className="text-amber-300"> *</span>}
                    {p.tocado && <TocadoIcon className="ml-1" />}
                  </span>
                  <span className="shrink-0 text-xs opacity-70">{p.posiciones[0]}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generar}
            disabled={!completo}
            className="rounded bg-emerald-600 px-4 py-2 font-medium text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generar equipos ({jugadoresPorEquipo} vs {jugadoresPorEquipo})
          </button>
          {!completo && (
            <span className="text-sm text-amber-400">
              {faltan > 0
                ? `Faltan ${faltan} para el formato ${jugadoresPorEquipo} vs ${jugadoresPorEquipo}.`
                : `Sobran ${-faltan} para el formato ${jugadoresPorEquipo} vs ${jugadoresPorEquipo}.`}
            </span>
          )}
        </div>
      </section>

      {/* Resultado */}
      {balanceVivo && (
        <BalanceResult
          balance={balanceVivo}
          formacionA={formacionA}
          formacionB={formacionB}
          onCopy={copiar}
          copiado={copiado}
          onConfirm={confirmar}
          confirmada={confirmada}
          onCrossSwap={handleCrossSwap}
        />
      )}
    </div>
  )
}

function FormacionSelector({
  label,
  labelClass,
  formaciones,
  seleccionada,
  onSelect,
}: {
  label: string
  labelClass: string
  formaciones: Formacion[]
  seleccionada: string
  onSelect: (nombre: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`w-24 font-medium ${labelClass}`}>{label}:</span>
      {formaciones.map((f) => (
        <button
          key={f.nombre}
          onClick={() => onSelect(f.nombre)}
          className={
            'rounded border px-3 py-1 transition-colors ' +
            (seleccionada === f.nombre
              ? 'border-emerald-500 bg-emerald-600 text-white'
              : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400')
          }
        >
          {f.nombre}
        </button>
      ))}
    </div>
  )
}

function BalanceResult({
  balance,
  formacionA,
  formacionB,
  onCopy,
  copiado,
  onConfirm,
  confirmada,
  onCrossSwap,
}: {
  balance: TeamBalance
  formacionA: Formacion
  formacionB: Formacion
  onCopy: () => void
  copiado: boolean
  onConfirm: () => void
  confirmada: boolean
  onCrossSwap: (dragId: string, dropId: string) => void
}) {
  const pctA = Math.round(balance.balancePctA)
  const pctB = 100 - pctA
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const fieldRef = useRef<HTMLDivElement>(null)
  const [imgMsg, setImgMsg] = useState('')

  const descargarImagen = async () => {
    if (!fieldRef.current) return
    const dataUrl = await toPng(fieldRef.current, { pixelRatio: 2, backgroundColor: '#0f1115' })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `equipos-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  const copiarImagen = async () => {
    if (!fieldRef.current) return
    try {
      const blob = await toBlob(fieldRef.current, { pixelRatio: 2, backgroundColor: '#0f1115' })
      if (!blob) throw new Error('sin imagen')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setImgMsg('✓ Imagen copiada')
      setTimeout(() => setImgMsg(''), 2500)
    } catch {
      // El portapapeles de imágenes no está disponible (p.ej. móvil) → descarga.
      await descargarImagen()
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Equipos propuestos</h2>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={onConfirm}
              disabled={confirmada}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:cursor-default disabled:opacity-50"
              title="Guarda esta alineación en el historial para evitar repetirla en el futuro"
            >
              {confirmada ? '✓ Confirmada' : '✅ Confirmar alineación'}
            </button>
          )}
          <button
            onClick={onCopy}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            {copiado ? '✓ Copiado' : '📋 Copiar texto'}
          </button>
          <button
            onClick={copiarImagen}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            title="Copia la imagen del campo al portapapeles (o la descarga si no se puede)"
          >
            {imgMsg || '📷 Copiar imagen'}
          </button>
          <button
            onClick={descargarImagen}
            className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-slate-400"
            title="Descargar la imagen del campo (PNG)"
          >
            ⬇
          </button>
        </div>
      </div>

      {/* Barra de equilibrio */}
      <div>
        <div className="flex h-3 overflow-hidden rounded-full">
          <div className="bg-white" style={{ width: `${pctA}%` }} />
          <div className="bg-red-500" style={{ width: `${pctB}%` }} />
        </div>
        <p className="mt-1 text-center text-sm text-slate-400">
          Equilibrio {pctA}% / {pctB}% · diferencia de nivel {balance.diffScore.toFixed(2)}
        </p>
      </div>

      {/* Campo con la distribución de ambos equipos (capturable como imagen) */}
      <div ref={fieldRef}>
        <FieldView
          balance={balance}
          formacionA={formacionA}
          formacionB={formacionB}
          onCrossSwap={onCrossSwap}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TeamColumn title="⚪ Equipo A" color="white" team={balance.teamA} score={balance.scoreA} />
        <TeamColumn title="🔴 Equipo B" color="red" team={balance.teamB} score={balance.scoreB} />
      </div>

      {/* Desglose técnico */}
      <details className="text-sm text-slate-400">
        <summary className="cursor-pointer select-none">Detalle del equilibrado</summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Diferencia de nivel total: {balance.breakdown.score.toFixed(2)} puntos</li>
          <li>Desequilibrio por líneas (DEF/MED/ATA): {balance.breakdown.posicion}</li>
          <li>Diferencia de zurdos: {balance.breakdown.pierna}</li>
          <li>Repetición de parejas (historial): {balance.breakdown.repeticion.toFixed(2)}</li>
          <li>
            Método:{' '}
            {balance.method === 'bruteforce'
              ? `exacto (fuerza bruta) · ${balance.evaluated.toLocaleString('es-ES')} combinaciones`
              : balance.method === 'manual'
                ? 'ajustado a mano'
                : 'heurístico'}
          </li>
        </ul>
      </details>
    </section>
  )
}

function TeamColumn({
  title,
  color,
  team,
  score,
}: {
  title: string
  color: 'white' | 'red'
  team: Player[]
  score: number
}) {
  const border = color === 'white' ? 'border-slate-300' : 'border-red-800'
  const ordenados = [...team].sort((a, b) => playerScore(b) - playerScore(a))
  return (
    <div className={'rounded-lg border ' + border + ' bg-slate-900/60 p-3'}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-slate-400">
          nivel {score.toFixed(1)} · {team.length} jug.
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {ordenados.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span>
              {p.nombre}
              {p.invitado && <span className="text-amber-400" title="Invitado"> *</span>}
              {p.tocado && <TocadoIcon className="ml-1" />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
