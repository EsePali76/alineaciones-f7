import { useEffect, useState } from 'react'
import { usePlayersStore } from './store/playersStore'
import type { PlayerInput } from './store/playersStore'
import type { Player } from './domain/types'
import { useLineupsStore } from './store/lineupsStore'
import { useRatingsStore } from './store/ratingsStore'
import { useRotationStore } from './store/rotationStore'
import { useAuthStore } from './store/authStore'
import { useEffectivePlayers } from './hooks/useEffectivePlayers'
import { useTurno } from './hooks/useTurno'
import { RotationBanner } from './components/RotationBanner'
import { PlayerForm } from './components/PlayerForm'
import { PlayerList } from './components/PlayerList'
import { RatePlayers } from './components/RatePlayers'
import { TeamGenerator } from './components/TeamGenerator'
import { ConfirmedLineupView } from './components/ConfirmedLineupView'
import { HistoryList } from './components/HistoryList'
import { StatsPanel } from './components/StatsPanel'
import { DataIO } from './components/DataIO'
import { AccountBar } from './components/AccountBar'
import { UsersPanel } from './components/admin/UsersPanel'
import { AdminProxyRating } from './components/admin/AdminProxyRating'

type Tab = 'plantel' | 'invitados' | 'valorar' | 'equipos' | 'estadisticas' | 'historial' | 'usuarios'

function App() {
  const players = usePlayersStore((s) => s.players)
  const effectivePlayers = useEffectivePlayers()
  const addPlayer = usePlayersStore((s) => s.addPlayer)
  const updatePlayer = usePlayersStore((s) => s.updatePlayer)
  const removePlayer = usePlayersStore((s) => s.removePlayer)
  const loadPlayers = usePlayersStore((s) => s.load)
  const playersLoaded = usePlayersStore((s) => s.loaded)
  const loadLineups = useLineupsStore((s) => s.load)
  const lineups = useLineupsStore((s) => s.lineups)
  const loadAverages = useRatingsStore((s) => s.loadAverages)
  const loadRotation = useRotationStore((s) => s.load)
  const initAuth = useAuthStore((s) => s.init)
  const authReady = useAuthStore((s) => s.ready)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const isLinked = useAuthStore((s) => s.isLinked)
  const { isMyTurn } = useTurno()
  // Quién puede GENERAR/editar equipos (el del turno o admin).
  const puedeGenerar = isMyTurn || isAdmin
  // Alineación confirmada de la semana pendiente de resultado (visible para todos).
  const pendingLineup = [...lineups]
    .filter((l) => !l.resultado)
    .sort((a, b) => b.fecha - a.fecha)[0]
  // La pestaña Equipos se ve si puedes generar o si hay alineación confirmada que mostrar.
  const puedeEquipos = puedeGenerar || !!pendingLineup
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)
  const myPlayer = myPlayerId ? players.find((p) => p.id === myPlayerId) : undefined

  const [tab, setTab] = useState<Tab>('plantel')
  const [editing, setEditing] = useState<Player | null>(null)
  const [cargaError, setCargaError] = useState(false)

  useEffect(() => {
    initAuth()
    Promise.all([loadPlayers(), loadLineups(), loadAverages(), loadRotation()]).catch((e) => {
      console.error(e)
      setCargaError(true)
    })
  }, [initAuth, loadPlayers, loadLineups, loadAverages, loadRotation])

  // Si una pestaña restringida queda seleccionada y pierdes el permiso, vuelve a Plantel.
  useEffect(() => {
    if (!isAdmin && tab === 'usuarios') setTab('plantel')
    if (!isAdmin && tab === 'invitados') setTab('plantel')
    if (!isLinked && tab === 'valorar') setTab('plantel')
    if (!puedeEquipos && tab === 'equipos') setTab('plantel')
  }, [isAdmin, isLinked, puedeEquipos, tab])

  // Al cambiar de pestaña se descarta la edición en curso (no arrastrar un jugador
  // del Plantel al formulario de Invitados, ni viceversa).
  useEffect(() => setEditing(null), [tab])

  const handleSubmit = (input: PlayerInput) => {
    if (editing) {
      updatePlayer(editing.id, input)
      setEditing(null)
    } else {
      addPlayer(input)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">⚽ Alineaciones F7</h1>
          <p className="text-sm text-slate-400">Equipos equilibrados para la pachanga</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AccountBar />
          <DataIO />
        </div>
      </header>

      {/* Sin sesión: solo se puede registrar/entrar. Nada de datos para los cotillas. */}
      {!authReady && <p className="p-8 text-center text-slate-500">Cargando…</p>}

      {authReady && !isLoggedIn && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-8 text-center">
          <p className="text-lg font-medium text-slate-200">Acceso solo para el grupo</p>
          <p className="mt-1 text-sm text-slate-400">
            Regístrate o entra (botones de arriba) para ver el plantel, las alineaciones y las
            estadísticas. El admin te emparejará con tu jugador.
          </p>
        </div>
      )}

      {authReady && isLoggedIn && cargaError && (
        <p className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-center text-red-300">
          No se pudo conectar con la nube. Revisa tu conexión y recarga la página.
        </p>
      )}

      {authReady && isLoggedIn && !playersLoaded && !cargaError && (
        <p className="p-8 text-center text-slate-500">Cargando datos…</p>
      )}

      {authReady && isLoggedIn && playersLoaded && (
        <>
          {/* Turno: por encima de las pestañas para que no pase desapercibido */}
          <RotationBanner />

          {/* Pestañas */}
          <nav className="flex gap-1 border-b border-slate-700">
            <TabButton active={tab === 'plantel'} onClick={() => setTab('plantel')}>
              Plantel
            </TabButton>
            {isAdmin && (
              <TabButton active={tab === 'invitados'} onClick={() => setTab('invitados')}>
                Invitados
              </TabButton>
            )}
            {isLinked && (
              <TabButton active={tab === 'valorar'} onClick={() => setTab('valorar')}>
                Valorar
              </TabButton>
            )}
            {puedeEquipos && (
              <TabButton active={tab === 'equipos'} onClick={() => setTab('equipos')}>
                Equipos
              </TabButton>
            )}
            <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
              Partidos
            </TabButton>
            <TabButton active={tab === 'estadisticas'} onClick={() => setTab('estadisticas')}>
              Estadísticas
            </TabButton>
            {isAdmin && (
              <TabButton active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>
                Usuarios
              </TabButton>
            )}
          </nav>

          {tab === 'plantel' && (
            <>
              {/* Autoservicio: el usuario vinculado (no admin) edita sus propios datos. */}
              {isLinked && !isAdmin && myPlayer && (
                <PlayerForm
                  key={myPlayer.id}
                  initial={myPlayer}
                  mode="identity"
                  onSubmit={(input) => updatePlayer(myPlayer.id, input)}
                />
              )}
              <PlayerList
                players={effectivePlayers.filter((p) => !p.invitado)}
                onEdit={(p) => setEditing(players.find((r) => r.id === p.id) ?? p)}
                onRemove={removePlayer}
                isAdmin={isAdmin}
              />
              {isAdmin && (
                <PlayerForm
                  key={editing?.id ?? 'nuevo'}
                  initial={editing ?? undefined}
                  onSubmit={handleSubmit}
                  onCancel={editing ? () => setEditing(null) : undefined}
                />
              )}
            </>
          )}
          {tab === 'invitados' && isAdmin && (
            <>
              <p className="text-sm text-slate-400">
                Gente de fuera del grupo (sin cuenta, no hacen alineaciones). Los{' '}
                <b>habituales</b> los vota el grupo y cuentan en estadísticas; los{' '}
                <b>puntuales</b> van con datos estimados y sin rastro en estadísticas. Para pasar a
                uno al plantel, vincúlale una cuenta en «Usuarios».
              </p>
              <PlayerList
                players={effectivePlayers.filter((p) => p.invitado)}
                onEdit={(p) => setEditing(players.find((r) => r.id === p.id) ?? p)}
                onRemove={removePlayer}
                isAdmin={isAdmin}
                noun="invitados"
              />
              <PlayerForm
                key={editing?.id ?? 'nuevo-invitado'}
                kind="invitado"
                initial={editing ?? undefined}
                onSubmit={handleSubmit}
                onCancel={editing ? () => setEditing(null) : undefined}
              />
            </>
          )}
          {tab === 'valorar' && isLinked && <RatePlayers />}
          {tab === 'equipos' &&
            (puedeGenerar ? (
              <TeamGenerator />
            ) : pendingLineup ? (
              <ConfirmedLineupView lineup={pendingLineup} />
            ) : null)}
          {tab === 'estadisticas' && <StatsPanel />}
          {tab === 'historial' && <HistoryList />}
          {tab === 'usuarios' && isAdmin && (
            <div className="flex flex-col gap-6">
              <UsersPanel />
              <AdminProxyRating />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TabButton({
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
        'border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
        (active
          ? 'border-emerald-500 text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200')
      }
    >
      {children}
    </button>
  )
}

export default App
