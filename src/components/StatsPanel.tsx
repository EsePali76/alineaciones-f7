import { useMemo, useState } from 'react'
import { useLineupsStore } from '../store/lineupsStore'
import { useEffectivePlayers, useSimulacionAjustes } from '../hooks/useEffectivePlayers'
import { useRotationStore } from '../store/rotationStore'
import { weightedRatings } from '../domain/scoring'
import { AjusteFlecha } from './AjusteFlecha'
import { FichaJugador } from './FichaJugador'
import { TablaAjuste } from './TablaAjuste'
import {
  statsPorEquipo,
  statsPorJugador,
  ordenarGoleadores,
  ordenarAsistentes,
  equiposMasGoleadores,
  equiposMenosGoleados,
  MIN_PARTIDOS_MENCION,
  type PlayerStats,
  type MencionEquipo,
  type TeamStats,
} from '../domain/stats'
import { temporadasDisponibles, filtrarPorTemporada, TODAS } from '../domain/season'
import { SeasonPicker } from './SeasonPicker'
import { Avatar } from './Avatar'
import { fotoVisible, nombreVisible } from '../domain/types'

type Sub = 'equipo' | 'jugador' | 'menciones'
type Modo = 'temporada' | 'totales'
type JugSortKey =
  | 'nombre'
  | 'partidos'
  | 'victorias'
  | 'valoracion'
  | 'valUsuarios'
  | 'ajuste'
  | 'pctVictorias'
  | 'racha'
  | 'goles'
  | 'asistencias'
  | 'mvps'
type SortDir = 'asc' | 'desc'

export function StatsPanel() {
  const lineups = useLineupsStore((s) => s.lineups)
  const players = useEffectivePlayers()
  const baseCincoDesde = useRotationStore((s) => s.baseCincoDesde)
  const baseCinco = baseCincoDesde != null
  const [sub, setSub] = useState<Sub>('jugador')
  const [modo, setModo] = useState<Modo>('temporada')
  const [jugSort, setJugSort] = useState<JugSortKey>('valoracion')
  const [jugDir, setJugDir] = useState<SortDir>('desc')
  /** Jugador cuya ficha está abierta (se abre pinchando en su nombre). */
  const [ficha, setFicha] = useState<string | null>(null)
  /** Tabla «¿Cómo se calcula el ajuste?» desplegada. */
  const [verTabla, setVerTabla] = useState(false)

  /** Cambia de columna (texto→asc, números→desc) o alterna dirección si ya está activa. */
  const toggleJug = (key: JugSortKey) => {
    if (key === jugSort) setJugDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setJugSort(key)
      setJugDir(key === 'nombre' ? 'asc' : 'desc')
    }
  }
  const jugArrow = (key: JugSortKey) => (jugSort === key ? (jugDir === 'asc' ? ' ▲' : ' ▼') : '')

  const temporadas = useMemo(() => temporadasDisponibles(lineups), [lineups])
  const [temporada, setTemporada] = useState<string>(() => temporadasDisponibles(lineups)[0] ?? TODAS)

  // La temporada elegida debe ser siempre una válida (las alineaciones cargan async,
  // así que el valor inicial puede quedar obsoleto); si no, cae a la más reciente.
  const temporadaSel = temporadas.includes(temporada) ? temporada : temporadas[0] ?? TODAS

  // En "Totales" se agregan todas las temporadas; en "Por temporada", la elegida.
  const temporadaActiva = modo === 'totales' ? TODAS : temporadaSel

  // Las stats se calculan sobre las alineaciones de la temporada elegida (o todas).
  const lineupsTemp = useMemo(
    () => filtrarPorTemporada(lineups, temporadaActiva),
    [lineups, temporadaActiva],
  )
  const conResultado = useMemo(() => lineupsTemp.filter((l) => l.resultado), [lineupsTemp])
  const equipos = useMemo(() => statsPorEquipo(lineupsTemp), [lineupsTemp])
  const porJugador = useMemo(() => statsPorJugador(lineupsTemp), [lineupsTemp])
  // Los invitados puntuales no dejan rastro en las estadísticas por jugador (sí en el
  // marcador por color, que es del equipo, no de la persona). El resto sí aparece.
  const statsArr = useMemo(() => {
    const esPuntual = (id: string) => {
      const p = players.find((pl) => pl.id === id)
      return !!p && p.invitado && !p.habitual
    }
    return [...porJugador.values()].filter((s) => !esPuntual(s.playerId))
  }, [porJugador, players])

  const goleadores = useMemo(() => ordenarGoleadores(statsArr), [statsArr])
  const asistentes = useMemo(() => ordenarAsistentes(statsArr), [statsArr])
  const masGoleadores = useMemo(() => equiposMasGoleadores(statsArr), [statsArr])
  const menosGoleados = useMemo(() => equiposMenosGoleados(statsArr), [statsArr])

  // Ajuste por resultados: solo por temporada, lo ganado o perdido en ella (aunque el
  // admin lo haya puesto a cero después: queda como histórico). En «Totales» no se
  // enseña (decisión de Santi, 2026-10-30): se pone a cero cada temporada y sumar o
  // promediar temporadas con valoraciones distintas no significa nada.
  const ajustes = useSimulacionAjustes().jugadores
  const ajusteDe = (id: string) => ajustes.get(id)?.porTemporada.get(temporadaSel) ?? 0

  // Nivel = valoración CON el ajuste acumulado ya sumado: la nota con la que se reparte hoy
  // (aunque se mire una temporada pasada). Se enseña aquí para que la gente se pique
  // por superar a los demás; en Plantel sigue saliendo la del grupo, sin ajuste.
  // Con «todos parten de 5», la base es 5 y al lado sale la de los usuarios, para
  // comparar a final de temporada lo que dan los resultados con lo que vota el grupo.
  const valoracionDe = (id: string) => {
    const p = players.find((pl) => pl.id === id)
    return p ? (p.baseReparto ?? weightedRatings(p)) + (ajustes.get(id)?.total ?? 0) : undefined
  }
  const valoracionUsuariosDe = (id: string) => {
    const p = players.find((pl) => pl.id === id)
    return p ? weightedRatings(p) : undefined
  }

  const nombre = (id: string) => nombreVisible(players.find((p) => p.id === id))
  const foto = (id: string) => fotoVisible(players.find((p) => p.id === id))

  const filas = useMemo(() => {
    // Valor de ordenación de cada jugador según la columna activa.
    const val = (s: PlayerStats): number | string => {
      switch (jugSort) {
        case 'nombre':
          return nombre(s.playerId).toLowerCase()
        case 'partidos':
          return s.partidos
        case 'victorias':
          return s.victorias
        case 'valoracion':
          return valoracionDe(s.playerId) ?? 0
        case 'valUsuarios':
          return valoracionUsuariosDe(s.playerId) ?? 0
        case 'ajuste':
          return ajusteDe(s.playerId)
        case 'pctVictorias':
          return s.pctVictorias
        case 'racha':
          // En Totales se muestra la mejor racha de victorias; en temporada, la actual.
          return modo === 'totales' ? s.mejorRachaV : s.racha
        case 'goles':
          return s.goles
        case 'asistencias':
          return s.asistencias
        case 'mvps':
          return s.mvps
      }
    }
    return [...statsArr].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      let cmp =
        typeof va === 'string' || typeof vb === 'string'
          ? String(va).localeCompare(String(vb))
          : va - vb
      cmp = jugDir === 'asc' ? cmp : -cmp
      // Desempate fijo: más partidos primero.
      return cmp !== 0 ? cmp : b.partidos - a.partidos
    })
    // `nombre` depende de `players`; se incluye vía statsArr/jugSort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsArr, jugSort, jugDir, modo, ajustes, temporadaSel, players, baseCinco])

  return (
    <div className="flex flex-col gap-4">
      {/* Nivel 1: agregado total vs. una temporada concreta */}
      <div className="flex flex-wrap gap-1 border-b border-slate-700/60 pb-2">
        <SubTab active={modo === 'temporada'} onClick={() => setModo('temporada')}>
          Por temporada
        </SubTab>
        <SubTab
          active={modo === 'totales'}
          onClick={() => {
            setModo('totales')
            // La columna Ajuste no existe en Totales: si se ordenaba por ella, al Nivel.
            if (jugSort === 'ajuste') setJugSort('valoracion')
          }}
        >
          Totales
        </SubTab>
      </div>

      {modo === 'temporada' && (
        <SeasonPicker
          temporadas={temporadas}
          valor={temporadaSel}
          onChange={setTemporada}
          incluirTotales={false}
          siempreVisible
        />
      )}

      {conResultado.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
          {modo === 'totales'
            ? 'Aún no hay partidos con resultado. Cuando se registren marcadores, aquí saldrán las estadísticas.'
            : `No hay partidos con resultado en la temporada ${temporadaSel}.`}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            <SubTab active={sub === 'jugador'} onClick={() => setSub('jugador')}>
              Por jugador
            </SubTab>
            <SubTab active={sub === 'equipo'} onClick={() => setSub('equipo')}>
              Por equipo
            </SubTab>
            <SubTab active={sub === 'menciones'} onClick={() => setSub('menciones')}>
              Menciones
            </SubTab>
          </div>

          {sub === 'equipo' && (
            <div className="grid gap-3 md:grid-cols-2">
              <TeamCard titulo="⚪ Blanco" stats={equipos.blanco} acento="text-slate-100" />
              <TeamCard titulo="🔴 Rojo" stats={equipos.rojo} acento="text-red-400" />
            </div>
          )}

          {sub === 'menciones' && (
            <div className="grid gap-4 md:grid-cols-2">
              <ScorerTable
                titulo="⚽ Goleadores"
                rows={goleadores}
                nombre={nombre}
                foto={foto}
                destacado="goles"
                vacio="Aún no hay goles registrados."
              />
              <ScorerTable
                titulo="🅰️ Asistentes"
                rows={asistentes}
                nombre={nombre}
                foto={foto}
                destacado="asistencias"
                vacio="Aún no hay asistencias registradas."
              />
              {/* Las tablas de media solo aparecen si hay alguien con el mínimo de PJ. */}
              {masGoleadores.length > 0 && (
                <MencionTable
                  titulo="🚀 En los equipos más goleadores"
                  subtitulo={`Media de goles a favor por partido · mín. ${MIN_PARTIDOS_MENCION} PJ`}
                  rows={masGoleadores}
                  nombre={nombre}
                  foto={foto}
                  colLabel="GF/P"
                />
              )}
              {menosGoleados.length > 0 && (
                <MencionTable
                  titulo="🛡️ Menos goleados"
                  subtitulo={`Media de goles en contra por partido · mín. ${MIN_PARTIDOS_MENCION} PJ`}
                  rows={menosGoleados}
                  nombre={nombre}
                  foto={foto}
                  colLabel="GC/P"
                />
              )}
            </div>
          )}

          {sub === 'jugador' && (
        <>
        <div className="-mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">👆 Toca un jugador para ver su ficha.</p>
          {/* Solo por temporada: el ajuste se pone a cero cada temporada. */}
          {modo === 'temporada' && (
            <button
              onClick={() => setVerTabla((v) => !v)}
              className="ml-auto rounded border border-sky-600 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-600/10"
            >
              {verTabla ? '✕ Cerrar' : '¿Cómo se calcula el ajuste?'}
            </button>
          )}
        </div>
        {modo === 'temporada' && verTabla && (
          <div className="mt-2">
            <TablaAjuste />
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-left text-slate-400">
                <th className="px-3 py-2 font-medium">
                  <button onClick={() => toggleJug('nombre')} className="font-medium hover:text-slate-200">
                    Jugador{jugArrow('nombre')}
                  </button>
                </th>
                <th className="px-2 py-2 text-center font-medium" title="Partidos jugados">
                  <button onClick={() => toggleJug('partidos')} className="font-medium hover:text-slate-200">
                    PJ{jugArrow('partidos')}
                  </button>
                </th>
                <th className="px-2 py-2 text-center font-medium" title="Victorias (ordena por victorias)">
                  <button onClick={() => toggleJug('victorias')} className="font-medium hover:text-slate-200">
                    V-E-D{jugArrow('victorias')}
                  </button>
                </th>
                {/* En Totales no hay Ajuste: se pone a cero cada temporada y una suma o media
                    de temporadas con valoraciones distintas no significa nada. */}
                {modo === 'temporada' && (
                  <th
                    className="px-2 py-2 text-center font-medium"
                    title="Lo que ha subido o bajado su nivel esta temporada"
                  >
                    <button onClick={() => toggleJug('ajuste')} className="font-medium hover:text-slate-200">
                      Ajuste{jugArrow('ajuste')}
                    </button>
                  </th>
                )}
                <th
                  className="px-2 py-2 text-center font-medium"
                  title={baseCinco ? '5 + ajuste: con lo que se reparte hoy' : 'Valoración + ajuste: con lo que se reparte hoy'}
                >
                  <button onClick={() => toggleJug('valoracion')} className="font-medium hover:text-slate-200">
                    Nivel{jugArrow('valoracion')}
                  </button>
                </th>
                {baseCinco && (
                  <th className="px-2 py-2 text-center font-medium" title="Valoración que le da el grupo, sin ajuste (para comparar)">
                    <button onClick={() => toggleJug('valUsuarios')} className="font-medium hover:text-slate-200">
                      Valoración{jugArrow('valUsuarios')}
                    </button>
                  </th>
                )}
                <th className="px-2 py-2 text-center font-medium" title="% de victorias">
                  <button onClick={() => toggleJug('pctVictorias')} className="font-medium hover:text-slate-200">
                    %V{jugArrow('pctVictorias')}
                  </button>
                </th>
                <th
                  className="px-2 py-2 text-center font-medium"
                  title={modo === 'totales' ? 'Mejor racha de victorias / peor de derrotas' : 'Racha actual'}
                >
                  <button onClick={() => toggleJug('racha')} className="font-medium hover:text-slate-200">
                    Racha{jugArrow('racha')}
                  </button>
                </th>
                <th className="px-2 py-2 text-center font-medium" title="Goles">
                  <button onClick={() => toggleJug('goles')} className="font-medium hover:text-slate-200">
                    ⚽{jugArrow('goles')}
                  </button>
                </th>
                <th className="px-2 py-2 text-center font-medium" title="Asistencias">
                  <button onClick={() => toggleJug('asistencias')} className="font-medium hover:text-slate-200">
                    🅰️{jugArrow('asistencias')}
                  </button>
                </th>
                <th className="px-2 py-2 text-center font-medium" title="Veces MVP del partido">
                  <button onClick={() => toggleJug('mvps')} className="font-medium hover:text-slate-200">
                    MVP{jugArrow('mvps')}
                  </button>
                </th>
                <th className="px-2 py-2 text-center font-medium" title="Veces de blanco / de rojo">⚪/🔴</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((s) => (
                <tr key={s.playerId} className="border-t border-slate-700/60">
                  <td className="px-3 py-2 font-medium">
                    <button
                      onClick={() => setFicha(s.playerId)}
                      className="group flex items-center gap-2 text-left"
                      title="Ver su ficha: partidos, probabilidad y ajuste de cada uno"
                    >
                      <Avatar src={foto(s.playerId)} alt={nombre(s.playerId)} className="h-6 w-6" />
                      <span className="underline decoration-slate-500 decoration-dotted underline-offset-4 group-hover:text-sky-300 group-hover:decoration-sky-300">
                        {nombre(s.playerId)}
                      </span>
                      <span className="text-sky-400/70 group-hover:text-sky-300">›</span>
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.partidos}</td>
                  <td className="px-2 py-2 text-center text-slate-300">
                    {s.victorias}-{s.empates}-{s.derrotas}
                  </td>
                  {modo === 'temporada' && (
                    <td className="px-2 py-2 text-center">
                      <AjusteFlecha valor={ajusteDe(s.playerId)} />
                    </td>
                  )}
                  <td className="px-2 py-2 text-center text-slate-300">
                    {valoracionDe(s.playerId)?.toFixed(2) ?? '—'}
                  </td>
                  {baseCinco && (
                    <td className="px-2 py-2 text-center text-slate-400">
                      {valoracionUsuariosDe(s.playerId)?.toFixed(2) ?? '—'}
                    </td>
                  )}
                  <td className="px-2 py-2 text-center text-slate-300">{s.pctVictorias}%</td>
                  <td className="px-2 py-2 whitespace-nowrap text-center">
                    {modo === 'totales' ? mejoresRachas(s.mejorRachaV, s.peorRachaD) : rachaTexto(s.racha)}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.goles || '—'}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.asistencias || '—'}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.mvps || '—'}</td>
                  <td className="px-2 py-2 text-center text-slate-400">
                    {s.vecesBlanco}/{s.vecesRojo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
          )}
        </>
      )}

      {ficha && (
        <FichaJugador
          playerId={ficha}
          temporadaInicial={modo === 'temporada' ? temporadaSel : undefined}
          onClose={() => setFicha(null)}
        />
      )}
    </div>
  )
}

function rachaTexto(racha: number) {
  if (racha > 0) return <span className="font-medium text-emerald-400">{racha}V 🔥</span>
  if (racha < 0) return <span className="font-medium text-red-400">{-racha}D 💀</span>
  return <span className="text-slate-500">—</span>
}

// En "Totales": mejor racha de victorias y peor de derrotas.
function mejoresRachas(mejorV: number, peorD: number) {
  const v = mejorV >= 1 ? <span className="font-medium text-emerald-400">{mejorV}V 🔥</span> : null
  const d = peorD >= 1 ? <span className="font-medium text-red-400">{peorD}D 💀</span> : null
  if (!v && !d) return <span className="text-slate-500">—</span>
  return (
    <span className="inline-flex items-center justify-center gap-1">
      {v ?? <span className="text-slate-600">—</span>}
      <span className="text-slate-600">/</span>
      {d ?? <span className="text-slate-600">—</span>}
    </span>
  )
}

/** Tabla de ranking por goles o asistencias (solo la columna que aplica + PJ). */
function ScorerTable({
  titulo,
  rows,
  nombre,
  foto,
  destacado,
  vacio,
}: {
  titulo: string
  rows: PlayerStats[]
  nombre: (id: string) => string
  foto: (id: string) => string | undefined
  destacado: 'goles' | 'asistencias'
  vacio: string
}) {
  const col = destacado === 'goles' ? { emoji: '⚽', title: 'Goles' } : { emoji: '🅰️', title: 'Asistencias' }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-200">{titulo}</h3>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
          {vacio}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-left text-slate-400">
                <th className="py-2 pl-3 pr-1 font-medium">#</th>
                <th className="w-full py-2 pl-1 pr-3 font-medium">Jugador</th>
                <th className="py-2 pl-3 pr-6 text-center font-medium" title="Partidos jugados">PJ</th>
                <th className="px-3 py-2 text-center font-medium" title={col.title}>{col.emoji}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.playerId} className="border-t border-slate-700/60">
                  <td className="py-2 pl-3 pr-1 text-slate-500">{i + 1}</td>
                  <td className="w-full py-2 pl-1 pr-3 font-medium">
                    <span className="flex items-center gap-2">
                      <Avatar src={foto(s.playerId)} alt={nombre(s.playerId)} className="h-6 w-6" />
                      {nombre(s.playerId)}
                    </span>
                  </td>
                  <td className="py-2 pl-3 pr-6 text-center text-slate-400">{s.partidos}</td>
                  <td className="px-3 py-2 text-center font-semibold text-slate-200">
                    {destacado === 'goles' ? s.goles : s.asistencias}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Tabla de ranking por media de goles del equipo del jugador (a favor o en contra). */
function MencionTable({
  titulo,
  subtitulo,
  rows,
  nombre,
  foto,
  colLabel,
}: {
  titulo: string
  subtitulo: string
  rows: MencionEquipo[]
  nombre: (id: string) => string
  foto: (id: string) => string | undefined
  colLabel: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{titulo}</h3>
        <p className="text-xs text-slate-500">{subtitulo}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-left text-slate-400">
              <th className="py-2 pl-3 pr-1 font-medium">#</th>
              <th className="py-2 pl-1 pr-3 font-medium">Jugador</th>
              <th className="px-2 py-2 text-center font-medium" title="Media por partido">
                {colLabel}
              </th>
              <th className="px-2 py-2 text-center font-medium" title="Partidos jugados">PJ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.playerId} className="border-t border-slate-700/60">
                <td className="py-2 pl-3 pr-1 text-slate-500">{i + 1}</td>
                <td className="py-2 pl-1 pr-3 font-medium">
                  <span className="flex items-center gap-2">
                    <Avatar src={foto(s.playerId)} alt={nombre(s.playerId)} className="h-6 w-6" />
                    {nombre(s.playerId)}
                  </span>
                </td>
                <td className="px-2 py-2 text-center font-semibold text-slate-200">
                  {s.media.toFixed(2)}
                </td>
                <td className="px-2 py-2 text-center text-slate-400">{s.partidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamCard({ titulo, stats, acento }: { titulo: string; stats: TeamStats; acento: string }) {
  const dg = stats.golesFavor - stats.golesContra
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <h3 className={`text-base font-semibold ${acento}`}>{titulo}</h3>
      <Dato label="Partidos" valor={stats.partidos} />
      <Dato label="Victorias" valor={stats.victorias} />
      <Dato label="Empates" valor={stats.empates} />
      <Dato label="Derrotas" valor={stats.derrotas} />
      <Dato
        label="% victorias"
        valor={stats.partidos ? `${Math.round((stats.victorias / stats.partidos) * 100)}%` : '—'}
      />
      <Dato label="Goles a favor" valor={stats.golesFavor} />
      <Dato label="Goles en contra" valor={stats.golesContra} />
      <Dato label="Diferencia" valor={dg > 0 ? `+${dg}` : dg} />
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-700/40 pb-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-200">{valor}</span>
    </div>
  )
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-t border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ' +
        (active
          ? 'border-emerald-500 text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200')
      }
    >
      {children}
    </button>
  )
}
