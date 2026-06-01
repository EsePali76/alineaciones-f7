import { useEffect, useState } from 'react'
import { usePlayersStore } from './store/playersStore'
import type { PlayerInput } from './store/playersStore'
import type { Player } from './domain/types'
import { useLineupsStore } from './store/lineupsStore'
import { useAuthStore } from './store/authStore'
import { PlayerForm } from './components/PlayerForm'
import { PlayerList } from './components/PlayerList'
import { TeamGenerator } from './components/TeamGenerator'
import { HistoryList } from './components/HistoryList'
import { DataIO } from './components/DataIO'
import { AdminBar } from './components/AdminBar'

type Tab = 'plantel' | 'equipos' | 'historial'

function App() {
  const players = usePlayersStore((s) => s.players)
  const addPlayer = usePlayersStore((s) => s.addPlayer)
  const updatePlayer = usePlayersStore((s) => s.updatePlayer)
  const removePlayer = usePlayersStore((s) => s.removePlayer)
  const loadPlayers = usePlayersStore((s) => s.load)
  const playersLoaded = usePlayersStore((s) => s.loaded)
  const loadLineups = useLineupsStore((s) => s.load)
  const initAuth = useAuthStore((s) => s.init)
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const [tab, setTab] = useState<Tab>('plantel')
  const [editing, setEditing] = useState<Player | null>(null)
  const [cargaError, setCargaError] = useState(false)

  useEffect(() => {
    initAuth()
    Promise.all([loadPlayers(), loadLineups()]).catch((e) => {
      console.error(e)
      setCargaError(true)
    })
  }, [initAuth, loadPlayers, loadLineups])

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
          <h1 className="text-2xl font-bold">⚽ alineaciones F7</h1>
          <p className="text-sm text-slate-400">Equipos equilibrados para la pachanga</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AdminBar />
          <DataIO />
        </div>
      </header>

      {cargaError && (
        <p className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-center text-red-300">
          No se pudo conectar con la nube. Revisa tu conexión y recarga la página.
        </p>
      )}

      {!playersLoaded && !cargaError && (
        <p className="p-8 text-center text-slate-500">Cargando datos…</p>
      )}

      {playersLoaded && (
        <>
          {/* Pestañas */}
          <nav className="flex gap-1 border-b border-slate-700">
            <TabButton active={tab === 'plantel'} onClick={() => setTab('plantel')}>
              Plantel
            </TabButton>
            <TabButton active={tab === 'equipos'} onClick={() => setTab('equipos')}>
              Equipos
            </TabButton>
            <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
              Historial
            </TabButton>
          </nav>

          {tab === 'plantel' && (
            <>
              <PlayerList
                players={players}
                onEdit={setEditing}
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
          {tab === 'equipos' && <TeamGenerator />}
          {tab === 'historial' && <HistoryList />}
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
